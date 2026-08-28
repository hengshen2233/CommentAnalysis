"""
情感分析预测
1. 从数据库读取评论数据
2. 使用预训练的BERT模型预测情感
3. 将结果保存回数据库
"""

import os
import traceback
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from transformers import AutoTokenizer, BertModel
from tqdm import tqdm
from sqlalchemy import create_engine
from pathlib import Path

# 获取绝对路径
BASE_DIR = Path(__file__).resolve().parent
model_path = BASE_DIR / 'emotion.pth'      # 情感分析模型路径
input_file = BASE_DIR / 'comments.csv'     # 输入文件路径
output_file = BASE_DIR / 'emotion.csv'     # 输出文件路径


class BertForSentimentMultiTask(nn.Module):
    """
    多任务情感分析模型
    任务1：情感分类 (0:差评, 1:中评, 2:好评)
    任务2：情感分值回归 (连续数值)
    """
    def __init__(self, model_name='bert-base-chinese'):
        # 初始化模型
        super(BertForSentimentMultiTask, self).__init__()
        
        # 加载预训练的 BERT 底座，优先使用本地文件
        base_dir = Path(__file__).resolve().parent
        model_path = base_dir / model_name
        if os.path.exists(model_path):
            self.bert = BertModel.from_pretrained(str(model_path))
        else:
            self.bert = BertModel.from_pretrained(model_name)
        
        self.dropout = nn.Dropout(0.1)  # Dropout层，防止过拟合

        # 任务1：情感分类 (0:差评, 1:中评, 2:好评)
        self.classifier = nn.Linear(768, 3)

        # 任务2：情感分值回归 (连续数值)
        self.regressor = nn.Linear(768, 1)

    def forward(self, input_ids, attention_mask):
        # 前向传播
        # 获取BERT的输出
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)

        # pooled_output 用于整句级别的分类和回归 (batch, 768)
        pooled_output = outputs[1]
        pooled_output = self.dropout(pooled_output)

        # 分类任务输出
        logits = self.classifier(pooled_output)
        # 回归任务输出（压缩维度）
        score = self.regressor(pooled_output).squeeze(-1)

        return logits, score


class ReviewDataset(Dataset):
    """
    情感分析数据集
    用于加载和处理情感分析的预测数据
    """
    def __init__(self, df, tokenizer, max_len=128, is_train=True):
        # 初始化数据集
        self.df = df.reset_index(drop=True)
        self.tokenizer = tokenizer
        self.max_len = max_len
        self.is_train = is_train

    def __len__(self):
        return len(self.df)  # 返回数据集长度

    def __getitem__(self, item):
        # 获取单个样本
        row = self.df.iloc[item]
        review = str(row['评论内容'])

        # 分词并编码
        encoding = self.tokenizer(
            review,
            add_special_tokens=True,  # 添加[CLS]和[SEP]
            max_length=self.max_len,  # 最大长度
            padding='max_length',     # 填充到最大长度
            truncation=True,          # 截断过长序列
            return_tensors='pt'       # 返回PyTorch张量
        )

        res = {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
        }

        if self.is_train:
            # 情感分类标签转换
            if '评分' in row:
                # 评分转换为分类标签：<=2为差评(0)，=3为中评(1)，>=4为好评(2)
                label = 0 if row['评分'] <= 2 else (1 if row['评分'] == 3 else 2)
                # 情感回归得分：将1-5映射到约-3到3的区间
                score = (row['评分'] - 3) * 1.5
            else:
                # 无评分时默认为中评
                label = 1
                score = 0.0

            res.update({
                'label': torch.tensor(label, dtype=torch.long),
                'score': torch.tensor(score, dtype=torch.float)
            })

        return res


def predict(test_csv, output_path):
    # 预测情感分析结果
    DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # 使用本地路径加载tokenizer
    model_dir = BASE_DIR / 'bert-base-chinese'
    tokenizer = AutoTokenizer.from_pretrained(str(model_dir))

    # 加载模型
    model = BertForSentimentMultiTask()
    model.load_state_dict(torch.load(model_path, map_location=DEVICE))
    model.to(DEVICE).eval()

    # 读取测试数据
    df_test = pd.read_csv(test_csv, encoding='utf-8', header=None, names=['id', 'content'])
    df_test_for_ds = df_test.rename(columns={'content': '评论内容'})

    # 创建数据集和数据加载器
    dataset = ReviewDataset(df_test_for_ds, tokenizer, is_train=False)
    loader = DataLoader(dataset, batch_size=8, shuffle=False)

    results = []
    label_map = {0: "差评", 1: "中评", 2: "好评"}  # 标签映射

    print("开始预测...")
    with torch.no_grad():
        idx = 0
        for batch in tqdm(loader):
            # 准备数据
            ids = batch['input_ids'].to(DEVICE)
            mask = batch['attention_mask'].to(DEVICE)
            
            # 前向传播
            logits, scores = model(ids, mask)

            # 获取预测结果
            preds = torch.argmax(logits, dim=1).cpu().numpy()
            reg_scores = scores.cpu().numpy()

            # 处理每个样本的结果
            for p, s in zip(preds, reg_scores):
                current_id = df_test.iloc[idx]['id']
                results.append({
                    'emotype': label_map[p],  # 情感类型
                    'emoscore': round(max(min(float(s), 3.0), -3.0), 2),  # 情感分值（限制范围）
                    'comment_id': current_id,  # 评论ID
                    'opinion': '暂无'  # 观点词（暂时为空）
                })
                idx += 1

    # 保存结果
    pd.DataFrame(results).to_csv(output_path, index=False, encoding='utf-8-sig')
    print(f"处理完成！结果已存入 {output_path}")


def run_emotion(dataset_name):
    """
    运行情感分析
    从数据库读取评论数据，预测情感，然后将结果保存回数据库
    """
    try:
        # 连接数据库
        engine = create_engine("mysql://root:ma20040809@localhost/comment_analysis?charset=utf8mb4")
        
        # 读取评论数据
        query = f"SELECT id, content FROM myapp_comment WHERE dataset = '{dataset_name}'"
        df_comments = pd.read_sql(query, engine)
        
        if df_comments.empty:
            print("未找到评论数据")
            return False
        
        # 检查是否已存在情感分析结果
        df_sentiment = pd.read_sql("SELECT comment_id FROM myapp_sentiment", engine)
        comment_ids = set(df_comments['id'].astype(str).tolist())
        sentiment_comment_ids = set(df_sentiment['comment_id'].astype(str).tolist())
        all_exist = comment_ids.issubset(sentiment_comment_ids)
        
        if all_exist:
            print("所有评论已存在情感分析结果")
            return True
        
        # 准备输入文件
        with open(input_file, 'w', encoding='utf-8') as f:
            f.write('')  # 写入空字符串
        df_comments[['id', 'content']].to_csv(input_file, index=False, header=False, encoding='utf-8')
        
        # 执行预测
        predict(input_file, output_file)
        
        # 读取输出文件，尝试多种编码
        try:
            df_emotion = pd.read_csv(output_file, encoding='utf-8')
            print(f"成功读取输出文件，行数: {len(df_emotion)}")
        except Exception as e:
            print(f"读取输出文件失败(utf-8): {e}")
            try:
                df_emotion = pd.read_csv(output_file, encoding='utf-8-sig')
                print(f"成功读取输出文件(utf-8-sig)，行数: {len(df_emotion)}")
            except Exception as e2:
                print(f"读取输出文件失败(utf-8-sig): {e2}")
                return False
        
        # 处理数据
        df_emotion.dropna(inplace=True)  # 移除空值
        
        # 数据类型转换
        try:
            df_emotion['comment_id'] = df_emotion['comment_id'].astype(int)
            df_emotion['emoscore'] = df_emotion['emoscore'].astype(float)
            print("数据类型转换成功")
        except Exception as e:
            print(f"数据类型转换失败: {e}")
            return False
        
        # 数据库插入
        try:
            df_emotion.to_sql('myapp_sentiment', con=engine, if_exists='append', index=False)
            print(f"成功插入 {len(df_emotion)} 条数据到数据库")
            return True
        except Exception as e:
            print(f"数据库插入失败: {e}")
            traceback.print_exc()
            return False
    except Exception as e:
        print(f"运行失败: {e}")
        traceback.print_exc()
        return False
