"""
观点词提取
1. 从数据库读取评论数据
2. 使用预训练的BERT模型提取观点词
3. 将结果保存回数据库
"""

import os
import re
import traceback
import pandas as pd
import torch
from torch.utils.data import Dataset
from transformers import BertTokenizer, BertForTokenClassification
from sqlalchemy import create_engine, text
from pathlib import Path

# 配置参数
MAX_LEN = 128          # 最大序列长度
BATCH_SIZE = 16        # 批处理大小
EPOCHS = 10            # 训练轮数
LR = 2e-5              # 学习率
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")  # 设备选择

# 获取绝对路径
BASE_DIR = Path(__file__).resolve().parent
MODEL_PATH = BASE_DIR / "opinion.pth"      # 观点词提取模型路径
input_file = BASE_DIR / "comments.csv"     # 输入文件路径
output_file = BASE_DIR / "opinion.csv"     # 输出文件路径

# 标签配置
LABEL_LIST = ['O', 'B-OP', 'I-OP']  # O: 非观点词, B-OP: 观点词开始, I-OP: 观点词内部
L2I = {l: i for i, l in enumerate(LABEL_LIST)}  # 标签到ID的映射
I2L = {i: l for i, l in enumerate(LABEL_LIST)}  # ID到标签的映射


class OpinionNERDataset(Dataset):
    """
    观点词提取数据集
    用于加载和处理观点词提取的训练数据，采用NER任务形式
    """
    
    def __init__(self, texts, all_labels, tokenizer, label2id, max_len=128):
        # 初始化数据集
        self.texts = texts
        self.all_labels = all_labels
        self.tokenizer = tokenizer
        self.label2id = label2id
        self.max_len = max_len

    def __len__(self):
        return len(self.texts)  # 返回数据集长度

    def __getitem__(self, item):
        # 获取单个样本
        text = str(self.texts[item])
        char_labels = self.all_labels[item]

        # 分词并编码，返回偏移量映射
        encoding = self.tokenizer(
            text,
            max_length=self.max_len,
            padding='max_length',
            truncation=True,
            return_offsets_mapping=True,  # 返回字符级偏移量
            return_tensors="pt"
        )

        labels_ids = []
        offset_mapping = encoding['offset_mapping'][0]

        # 将字符标签映射到 Token 标签
        for offset in offset_mapping:
            start, end = offset
            if start == end:  # [CLS], [SEP], [PAD]
                labels_ids.append(-100)  # 忽略这些位置的损失
            else:
                # 寻找该 Token 范围内最主要的标签
                chunk = char_labels[start:end]
                if 'B-OP' in chunk:
                    labels_ids.append(self.label2id['B-OP'])
                elif 'I-OP' in chunk:
                    labels_ids.append(self.label2id['I-OP'])
                else:
                    labels_ids.append(self.label2id['O'])

        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'labels': torch.tensor(labels_ids, dtype=torch.long)
        }


def get_bert_model(num_labels):
    # 获取BERT模型
    # 使用本地路径加载BERT模型
    base_dir = Path(__file__).resolve().parent
    model_path = base_dir / 'bert-base-chinese'
    if os.path.exists(model_path):
        return BertForTokenClassification.from_pretrained(str(model_path), num_labels=num_labels)
    else:
        return BertForTokenClassification.from_pretrained('bert-base-chinese', num_labels=num_labels)


def load_stopwords(path):
    # 加载停用词表
    if os.path.exists(path):
        with open(path, 'r', encoding='utf-8') as f:
            return set([line.strip() for line in f.readlines()])
    return set()


def predict_results(test_csv, model, tokenizer, stopwords, dataset_name):
    # 执行预测并生成结果
    print("正在生成预测结果...")
    # 读取测试数据
    test_df_raw = pd.read_csv(test_csv, header=None, encoding='utf-8')
    test_ids = test_df_raw[0].astype(str).tolist()
    test_texts = test_df_raw[1].astype(str).tolist()

    model.eval()
    final_results = []

    with torch.no_grad():
        for text in test_texts:
            # 跳过默认好评模板
            if "该用户" in text and ("好评" in text or "未填写" in text):
                final_results.append("")
                continue

            # 编码输入文本
            inputs = tokenizer(text, return_tensors="pt", truncation=True,
                               max_length=MAX_LEN, padding='max_length',
                               return_offsets_mapping=True).to(DEVICE)

            # 前向传播
            logits = model(inputs['input_ids'], attention_mask=inputs['attention_mask']).logits
            preds = torch.argmax(logits, dim=2).cpu().numpy()[0]
            offsets = inputs['offset_mapping'][0].cpu().numpy()

            # 提取观点词
            temp_ops = []
            curr_word = ""
            for i in range(len(preds)):
                s, e = offsets[i]
                if s == e: continue  # 跳过特殊标记
                label = I2L[preds[i]]

                if label == 'B-OP':
                    if curr_word: temp_ops.append(curr_word)
                    curr_word = text[s:e]
                elif label == 'I-OP' and curr_word:
                    curr_word += text[s:e]
                else:
                    if curr_word:
                        temp_ops.append(curr_word)
                        curr_word = ""
            if curr_word: temp_ops.append(curr_word)

            # 过滤逻辑
            valid_ops = []
            for word in temp_ops:
                word = word.strip()
                # 1. 仅去掉极其简短且无意义的单字
                if len(word) < 1:
                    continue

                # 2. 过滤停用词
                if word in stopwords:
                    continue

                # 3. 词性过滤：仅过滤掉明显的标点、数字、URL
                if word.isdigit() or len(re.sub(r'[^\w]', '', word)) == 0:
                    continue

                # 4. 排除数据集名称相关信息
                if word.lower() in dataset_name.lower():
                    continue

                if word not in valid_ops:
                    valid_ops.append(word)

            final_results.append(",".join(valid_ops))

    # 保存结果
    output_df = pd.DataFrame({'comment_id': test_ids, 'content': test_texts, 'opinion': final_results})
    output_df.to_csv(output_file, index=False, encoding='utf-8-sig')
    print("任务完成！结果已保存。")


def run_opinion(dataset_name):
    """
    运行观点词提取
    从数据库读取评论数据，提取观点词，然后将结果保存回数据库
    """
    # 使用本地路径加载tokenizer
    model_dir = BASE_DIR / 'bert-base-chinese'
    tokenizer = BertTokenizer.from_pretrained(str(model_dir))
    STOPWORDS = load_stopwords('cn_stopwords.txt')
    
    # 加载模型
    model = get_bert_model(len(LABEL_LIST))
    model.load_state_dict(torch.load(MODEL_PATH, map_location=DEVICE))
    model.to(DEVICE)
    
    try:
        # 执行预测
        predict_results(input_file, model, tokenizer, STOPWORDS, dataset_name)
        
        # 连接数据库
        engine = create_engine("mysql://root:ma20040809@localhost/comment_analysis?charset=utf8mb4")
        
        # 尝试多种编码读取结果
        try:
            df_opinion = pd.read_csv(output_file, encoding='utf-8')
        except:
            df_opinion = pd.read_csv(output_file, encoding='utf-8-sig')
        
        print(f"读取到 {len(df_opinion)} 条观点数据")
        
        # 处理数据
        df_opinion['opinion'] = df_opinion['opinion'].fillna('暂无')  # 填充空值
        # 限制观点文本长度，防止超过数据库字段限制
        max_opinion_length = 100  # 减小长度限制，确保符合数据库字段要求
        df_opinion['opinion'] = df_opinion['opinion'].apply(lambda x: x[:max_opinion_length] if isinstance(x, str) else x)
        
        # 更新数据库
        with engine.begin() as conn:  # begin() 会自动开启并提交事务
            query = text("UPDATE myapp_sentiment SET opinion = :opinion WHERE comment_id = :comment_id")
            # 构造参数字典
            data_to_update = [
                {"opinion": row['opinion'], "comment_id": row['comment_id']}
                for _, row in df_opinion.iterrows()
            ]
            print(f"准备更新 {len(data_to_update)} 条数据")
            if data_to_update:
                conn.execute(query, data_to_update)
                print(f"成功更新 {len(data_to_update)} 条观点数据。")
                return True
            else:
                print("没有数据需要更新")
                return True
    except Exception as e:
        print(f"观点提取失败: {e}")
        traceback.print_exc()
        return False