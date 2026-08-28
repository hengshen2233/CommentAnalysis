"""
BERT模型训练
1. 情感分析模型：用于分类评论情感（差评、中评、好评）并预测情感分值
2. 观点词提取模型：用于提取评论中的观点词
"""

import os
import re
import sys
import time
import argparse
import pandas as pd
import torch
import torch.nn as nn
from torch.optim import AdamW
from torch.utils.data import DataLoader, Dataset
from transformers import AutoTokenizer, BertModel, BertForTokenClassification
from tqdm import tqdm
from pathlib import Path
import matplotlib.pyplot as plt

# 获取绝对路径
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent

# 配置参数
MAX_LEN = 128          # 最大序列长度
BATCH_SIZE = 16        # 批处理大小
EPOCHS = 30            # 训练轮数
LR = 2e-5              # 学习率
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")  # 设备选择

# 模型保存路径
EMOTION_MODEL_PATH = ROOT_DIR / "emotion.pth"      # 情感分析模型路径
OPINION_MODEL_PATH = ROOT_DIR / "opinion.pth"      # 观点词提取模型路径

# 训练数据路径
EMOTION_TRAIN_PATH = BASE_DIR / "train_emotion.csv"  # 情感分析训练数据
OPINION_TRAIN_PATH = BASE_DIR / "train_opinion.csv"  # 观点词提取训练数据


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
        model_path = ROOT_DIR / model_name
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
    用于加载和处理情感分析的训练数据
    """
    def __init__(self, df, tokenizer, max_len=128):
        # 初始化数据集
        self.df = df.reset_index(drop=True)
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        # 返回数据集长度
        return len(self.df)

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

        return {
            'input_ids': encoding['input_ids'].flatten(),
            'attention_mask': encoding['attention_mask'].flatten(),
            'label': torch.tensor(label, dtype=torch.long),
            'score': torch.tensor(score, dtype=torch.float)
        }


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
                labels_ids.append(-100)  # 忽略损失
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


def prepare_opinion_data(df):
    """
    准备观点词提取的训练数据
    将原始数据转换为NER任务所需的格式，标记观点词的位置
    """
    content_col = '评论内容'
    target_col = '观点词'
    df[target_col] = df[target_col].astype(str)

    clean_texts, clean_labels = [], []
    count_valid = 0

    # 遍历每一行数据
    for _, row in df.iterrows():
        text = str(row[content_col])
        labels = ['O'] * len(text)  # 初始化标签为'O'
        
        # 提取观点词并过滤空值
        # 确保转换为字符串，处理NaN情况
        opinion_str = str(row[target_col]).strip()
        opinion_words = []
        if opinion_str and opinion_str.lower() != 'nan':
            opinion_words = [op.strip() for op in opinion_str.split(',') if op.strip() and op.lower() != 'nan']

        # 按长度降序排列，防止短词覆盖长词的一部分（如“好”覆盖“非常好”）
        opinion_words = sorted(list(set(opinion_words)), key=len, reverse=True)

        found_in_this_row = False
        for op in opinion_words:
            # 使用正则转义，防止观点词包含特殊字符导致报错
            pattern = re.escape(op)
            for match in re.finditer(pattern, text):
                start, end = match.span()
                # 检查该区域是否已被标注（防止重叠标注）
                if all(labels[i] == 'O' for i in range(start, end)):
                    labels[start] = 'B-OP'  # 观点词开始
                    for i in range(start + 1, end):
                        labels[i] = 'I-OP'  # 观点词内部
                    found_in_this_row = True

        # 只有真正匹配到观点词的文本才进入训练集，避免模型学废了
        if found_in_this_row:
            clean_texts.append(text)
            clean_labels.append(labels)
            count_valid += 1

    print(f"原始数据 {len(df)} 条，成功匹配并转换 {count_valid} 条。")
    return clean_texts, clean_labels


def train_emotion_model(args):
    # 训练情感分析模型
    print("=== 开始训练情感分析模型 ===")
    
    # 加载tokenizer
    tokenizer = AutoTokenizer.from_pretrained(str(ROOT_DIR / 'bert-base-chinese'))
    
    # 加载训练数据
    print("正在加载训练数据...")
    df_train = pd.read_csv(EMOTION_TRAIN_PATH, encoding='utf-8')
    
    # 创建数据集和数据加载器
    dataset = ReviewDataset(df_train, tokenizer, max_len=MAX_LEN)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    
    # 初始化模型
    model = BertForSentimentMultiTask().to(DEVICE)
    optimizer = AdamW(model.parameters(), lr=args.lr)
    
    # 损失函数
    criterion_cls = nn.CrossEntropyLoss()  # 分类损失
    criterion_reg = nn.MSELoss()           # 回归损失
    
    # 训练日志
    train_losses = []   # 总损失
    cls_losses = []     # 分类损失
    reg_losses = []     # 回归损失
    best_loss = float('inf')  # 最佳损失
    
    # 训练循环
    print(f"开始训练 (共 {args.epochs} 轮)...")
    for epoch in range(args.epochs):
        model.train()  # 设置为训练模式
        total_loss = 0
        total_cls_loss = 0
        total_reg_loss = 0
        
        # 进度条
        loop = tqdm(dataloader, desc=f"Epoch {epoch + 1}/{args.epochs}")
        for batch in loop:
            optimizer.zero_grad()  # 清零梯度
            
            # 准备数据
            input_ids = batch['input_ids'].to(DEVICE)
            attention_mask = batch['attention_mask'].to(DEVICE)
            labels = batch['label'].to(DEVICE)
            scores_true = batch['score'].to(DEVICE)
            
            # 前向传播
            logits, scores_pred = model(input_ids, attention_mask)
            
            # 计算损失
            loss_cls = criterion_cls(logits, labels)
            loss_reg = criterion_reg(scores_pred, scores_true)
            total_batch_loss = loss_cls + loss_reg
            
            # 反向传播
            total_batch_loss.backward()
            optimizer.step()
            
            # 累计损失
            total_loss += total_batch_loss.item()
            total_cls_loss += loss_cls.item()
            total_reg_loss += loss_reg.item()
            
            # 更新进度条
            loop.set_postfix({
                'loss': total_batch_loss.item(),
                'cls_loss': loss_cls.item(),
                'reg_loss': loss_reg.item()
            })
        
        # 计算平均损失
        avg_loss = total_loss / len(dataloader)
        avg_cls_loss = total_cls_loss / len(dataloader)
        avg_reg_loss = total_reg_loss / len(dataloader)
        
        # 记录日志
        train_losses.append(avg_loss)
        cls_losses.append(avg_cls_loss)
        reg_losses.append(avg_reg_loss)
        
        print(f"Epoch {epoch + 1}/{args.epochs}")
        print(f"  总损失: {avg_loss:.4f}")
        print(f"  分类损失: {avg_cls_loss:.4f}")
        print(f"  回归损失: {avg_reg_loss:.4f}")
        
        # 保存最佳模型
        if avg_loss < best_loss:
            best_loss = avg_loss
            torch.save(model.state_dict(), EMOTION_MODEL_PATH)
            print(f"  保存最佳模型，损失: {best_loss:.4f}")
    
    # 绘制训练曲线
    plt.figure(figsize=(12, 6))
    plt.plot(range(1, args.epochs + 1), train_losses, label='Total Loss')
    plt.plot(range(1, args.epochs + 1), cls_losses, label='Classification Loss')
    plt.plot(range(1, args.epochs + 1), reg_losses, label='Regression Loss')
    plt.title('Emotion Model Training Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    plt.grid(True)
    plt.savefig(str(BASE_DIR / 'emotion_training_loss.png'))
    plt.show()
    
    print(f"\n情感分析模型训练完成！")
    print(f"最佳模型已保存至: {EMOTION_MODEL_PATH}")
    return model


def train_opinion_model(args):
    # 训练观点词提取模型
    print("\n=== 开始训练观点词提取模型 ===")
    
    # 标签配置
    LABEL_LIST = ['O', 'B-OP', 'I-OP']  # O: 非观点词, B-OP: 观点词开始, I-OP: 观点词内部
    L2I = {l: i for i, l in enumerate(LABEL_LIST)}  # 标签到ID的映射
    
    # 加载tokenizer
    tokenizer = AutoTokenizer.from_pretrained(str(ROOT_DIR / 'bert-base-chinese'))
    
    # 加载训练数据
    print("正在加载训练数据...")
    df_train = pd.read_csv(OPINION_TRAIN_PATH, encoding='utf-8')
    
    # 准备数据
    train_texts, train_labels = prepare_opinion_data(df_train)
    print(f"准备了 {len(train_texts)} 条训练数据")
    
    # 创建数据集和数据加载器
    dataset = OpinionNERDataset(train_texts, train_labels, tokenizer, L2I, max_len=MAX_LEN)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    
    # 初始化模型
    model = BertForTokenClassification.from_pretrained(
        str(ROOT_DIR / 'bert-base-chinese'),
        num_labels=len(LABEL_LIST)
    ).to(DEVICE)
    
    optimizer = AdamW(model.parameters(), lr=args.lr)
    
    # 训练日志
    train_losses = []
    best_loss = float('inf')
    
    # 训练循环
    print(f"开始训练 (共 {args.epochs} 轮)...")
    for epoch in range(args.epochs):
        model.train()  # 设置为训练模式
        total_loss = 0
        
        # 进度条
        loop = tqdm(dataloader, desc=f"Epoch {epoch + 1}/{args.epochs}")
        for batch in loop:
            optimizer.zero_grad()  # 清零梯度
            
            # 准备数据
            input_ids = batch['input_ids'].to(DEVICE)
            attention_mask = batch['attention_mask'].to(DEVICE)
            labels = batch['labels'].to(DEVICE)
            
            # 前向传播
            outputs = model(input_ids, attention_mask=attention_mask, labels=labels)
            loss = outputs.loss
            
            # 反向传播
            loss.backward()
            optimizer.step()
            
            # 累计损失
            total_loss += loss.item()
            
            # 更新进度条
            loop.set_postfix({'loss': loss.item()})
        
        # 计算平均损失
        avg_loss = total_loss / len(dataloader)
        train_losses.append(avg_loss)
        
        print(f"Epoch {epoch + 1}/{args.epochs}")
        print(f"  损失: {avg_loss:.4f}")
        
        # 保存最佳模型
        if avg_loss < best_loss:
            best_loss = avg_loss
            torch.save(model.state_dict(), OPINION_MODEL_PATH)
            print(f"  保存最佳模型，损失: {best_loss:.4f}")
    
    # 绘制训练曲线
    plt.figure(figsize=(12, 6))
    plt.plot(range(1, args.epochs + 1), train_losses, label='Training Loss')
    plt.title('Opinion Model Training Loss')
    plt.xlabel('Epoch')
    plt.ylabel('Loss')
    plt.legend()
    plt.grid(True)
    plt.savefig(str(BASE_DIR / 'opinion_training_loss.png'))
    plt.show()
    
    print(f"\n观点词提取模型训练完成！")
    print(f"最佳模型已保存至: {OPINION_MODEL_PATH}")
    return model


def main():
    # 解析命令行参数，训练模型
    parser = argparse.ArgumentParser(description='BERT模型训练脚本')
    parser.add_argument('--lr', type=float, default=LR, help='学习率')
    parser.add_argument('--batch-size', type=int, default=BATCH_SIZE, help='批处理大小')
    parser.add_argument('--epochs', type=int, default=EPOCHS, help='训练轮数')
    parser.add_argument('--max-len', type=int, default=MAX_LEN, help='最大序列长度')
    parser.add_argument('--emotion-only', action='store_true', help='只训练情感分析模型')
    parser.add_argument('--opinion-only', action='store_true', help='只训练观点词提取模型')
    args = parser.parse_args()
    
    print("=== BERT模型训练脚本 ===")
    print(f"设备: {DEVICE}")
    print(f"学习率: {args.lr}")
    print(f"批处理大小: {args.batch_size}")
    print(f"训练轮数: {args.epochs}")
    print(f"最大序列长度: {args.max_len}")
    print()
    
    start_time = time.time()

    # # 训练模型
    # if not args.opinion_only:
    #     train_emotion_model(args)
    
    if not args.emotion_only:
        train_opinion_model(args)
    
    end_time = time.time()
    total_time = end_time - start_time
    
    print(f"\n=== 训练完成 ===")
    print(f"总训练时间: {total_time:.2f} 秒")
    # print(f"情感分析模型: {EMOTION_MODEL_PATH}")
    print(f"观点词提取模型: {OPINION_MODEL_PATH}")


if __name__ == "__main__":
    main()
