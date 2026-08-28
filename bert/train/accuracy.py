"""
模型准确率测试
1. 从train_emotion.csv和train_opinion.csv数据集中分别随机提取30%作为测试样本
2. 重复随机抽样过程三次（可复现）
3. 使用训练好的emotion模型和opinion模型进行预测
4. 计算并输出结构化的准确率结果表格
"""

import os
import sys
import random
import numpy as np
import pandas as pd
import torch
import torch.nn as nn
from torch.utils.data import DataLoader, Dataset
from transformers import AutoTokenizer, BertModel, BertForTokenClassification
from pathlib import Path

def print_flush(msg):
    """
    打印并刷新输出
    """
    print(msg)
    sys.stdout.flush()

# 获取绝对路径
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent

# 配置参数
MAX_LEN = 128          # 最大序列长度
BATCH_SIZE = 64        # 批处理大小
DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")  # 设备选择

# 模型保存路径
EMOTION_MODEL_PATH = ROOT_DIR / "emotion.pth"      # 情感分析模型路径
OPINION_MODEL_PATH = ROOT_DIR / "opinion.pth"      # 观点词提取模型路径

# 训练数据路径
EMOTION_TRAIN_PATH = BASE_DIR / "train_emotion.csv"  # 情感分析训练数据
OPINION_TRAIN_PATH = BASE_DIR / "train_opinion.csv"  # 观点词提取训练数据

# 随机种子（确保可复现）
SEED = 42


class BertForSentimentMultiTask(nn.Module):
    """
    多任务情感分析模型
    """
    def __init__(self, model_name='bert-base-chinese'):
        super(BertForSentimentMultiTask, self).__init__()
        
        model_path = ROOT_DIR / model_name
        if os.path.exists(model_path):
            self.bert = BertModel.from_pretrained(str(model_path))
        else:
            self.bert = BertModel.from_pretrained(model_name)
        
        self.dropout = nn.Dropout(0.1)
        self.classifier = nn.Linear(768, 3)
        self.regressor = nn.Linear(768, 1)

    def forward(self, input_ids, attention_mask):
        outputs = self.bert(input_ids=input_ids, attention_mask=attention_mask)
        pooled_output = outputs[1]
        pooled_output = self.dropout(pooled_output)
        logits = self.classifier(pooled_output)
        score = self.regressor(pooled_output).squeeze(-1)
        return logits, score


class ReviewDataset(Dataset):
    """
    情感分析数据集
    """
    def __init__(self, df, tokenizer, max_len=128):
        self.df = df.reset_index(drop=True)
        self.tokenizer = tokenizer
        self.max_len = max_len

    def __len__(self):
        return len(self.df)

    def __getitem__(self, item):
        row = self.df.iloc[item]
        review = str(row['评论内容'])

        encoding = self.tokenizer(
            review,
            add_special_tokens=True,
            max_length=self.max_len,
            padding='max_length',
            truncation=True,
            return_tensors='pt'
        )

        if '评分' in row:
            label = 0 if row['评分'] <= 2 else (1 if row['评分'] == 3 else 2)
            score = (row['评分'] - 3) * 1.5
        else:
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
    """
    def __init__(self, texts, all_labels, tokenizer, label2id, max_len=128):
        self.texts = texts
        self.all_labels = all_labels
        self.tokenizer = tokenizer
        self.label2id = label2id
        self.max_len = max_len

    def __len__(self):
        return len(self.texts)

    def __getitem__(self, item):
        text = str(self.texts[item])
        char_labels = self.all_labels[item]

        encoding = self.tokenizer(
            text,
            max_length=self.max_len,
            padding='max_length',
            truncation=True,
            return_offsets_mapping=True,
            return_tensors="pt"
        )

        labels_ids = []
        offset_mapping = encoding['offset_mapping'][0]

        for offset in offset_mapping:
            start, end = offset
            if start == end:
                labels_ids.append(-100)
            else:
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
    准备观点词提取数据
    """
    import re
    content_col = '评论内容'
    target_col = '观点词'
    df[target_col] = df[target_col].astype(str)

    clean_texts, clean_labels = [], []
    count_valid = 0

    for _, row in df.iterrows():
        text = str(row[content_col])
        labels = ['O'] * len(text)
        
        # 确保观点词列是字符串类型
        opinion_str = str(row[target_col])
        opinion_words = [op.strip() for op in opinion_str.split(',') if op.strip() and op.lower() != 'nan']
        opinion_words = sorted(list(set(opinion_words)), key=len, reverse=True)

        found_in_this_row = False
        for op in opinion_words:
            pattern = re.escape(op)
            for match in re.finditer(pattern, text):
                start, end = match.span()
                if all(labels[i] == 'O' for i in range(start, end)):
                    labels[start] = 'B-OP'
                    for i in range(start + 1, end):
                        labels[i] = 'I-OP'
                    found_in_this_row = True

        if found_in_this_row:
            clean_texts.append(text)
            clean_labels.append(labels)
            count_valid += 1

    return clean_texts, clean_labels


def set_seed(seed):
    """
    设置随机种子以确保可复现性
    """
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def split_data(df, test_ratio=0.3, seed=42):
    """
    按比例随机划分数据集
    """
    np.random.seed(seed)
    indices = np.random.permutation(len(df))
    test_size = int(len(df) * test_ratio)
    test_indices = indices[:test_size]
    train_indices = indices[test_size:]
    
    return df.iloc[train_indices].reset_index(drop=True), df.iloc[test_indices].reset_index(drop=True)


def load_emotion_model():
    """
    加载情感分析模型
    """
    model = BertForSentimentMultiTask().to(DEVICE)
    model.load_state_dict(torch.load(EMOTION_MODEL_PATH, map_location=DEVICE, weights_only=True))
    model.eval()
    return model


def load_opinion_model():
    """
    加载观点词提取模型
    """
    LABEL_LIST = ['O', 'B-OP', 'I-OP']
    model = BertForTokenClassification.from_pretrained(
        str(ROOT_DIR / 'bert-base-chinese'),
        num_labels=len(LABEL_LIST)
    ).to(DEVICE)
    model.load_state_dict(torch.load(OPINION_MODEL_PATH, map_location=DEVICE, weights_only=True))
    model.eval()
    return model


def test_emotion_model(model, test_df, tokenizer):
    """
    测试情感分析模型
    """
    dataset = ReviewDataset(test_df, tokenizer, max_len=MAX_LEN)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    correct = 0
    total = 0
    
    with torch.no_grad():
        for batch in dataloader:
            input_ids = batch['input_ids'].to(DEVICE)
            attention_mask = batch['attention_mask'].to(DEVICE)
            labels = batch['label'].to(DEVICE)
            
            logits, _ = model(input_ids, attention_mask)
            preds = torch.argmax(logits, dim=1)
            
            correct += (preds == labels).sum().item()
            total += labels.size(0)
    
    accuracy = correct / total if total > 0 else 0.0
    return accuracy, total


def test_opinion_model(model, test_texts, test_labels, tokenizer):
    """
    测试观点词提取模型
    """
    LABEL_LIST = ['O', 'B-OP', 'I-OP']
    L2I = {l: i for i, l in enumerate(LABEL_LIST)}
    
    dataset = OpinionNERDataset(test_texts, test_labels, tokenizer, L2I, max_len=MAX_LEN)
    dataloader = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=False)
    
    correct = 0
    total = 0
    
    with torch.no_grad():
        for batch in dataloader:
            input_ids = batch['input_ids'].to(DEVICE)
            attention_mask = batch['attention_mask'].to(DEVICE)
            labels = batch['labels'].to(DEVICE)
            
            outputs = model(input_ids, attention_mask=attention_mask)
            logits = outputs.logits
            preds = torch.argmax(logits, dim=2)
            
            # 只计算非-100标签的准确率（忽略[CLS], [SEP], [PAD]）
            mask = (labels != -100)
            correct += ((preds == labels) & mask).sum().item()
            total += mask.sum().item()
    
    accuracy = correct / total if total > 0 else 0.0
    return accuracy, len(test_texts)


def print_results_table(results):
    """
    打印结构化的结果表格
    """
    print("\n" + "="*80)
    print("                    模型准确率测试结果")
    print("="*80)
    
    # 情感分析模型结果
    print("\n【情感分析模型】")
    print("-" * 60)
    print(f"{'测试次数':<10} {'样本量':<10} {'准确率':<15}")
    print("-" * 60)
    for i, (sample_size, acc) in enumerate(results['emotion'], 1):
        print(f"{f'第{i}次':<10} {sample_size:<10} {f'{acc:.4%}':<15}")
    
    # 计算平均值
    emotion_avg_acc = sum(acc for _, acc in results['emotion']) / len(results['emotion'])
    emotion_avg_size = sum(size for size, _ in results['emotion']) / len(results['emotion'])
    print("-" * 60)
    print(f"{'平均值':<10} {int(emotion_avg_size):<10} {f'{emotion_avg_acc:.4%}':<15}")
    
    # 观点词提取模型结果
    print("\n【观点词提取模型】")
    print("-" * 60)
    print(f"{'测试次数':<10} {'样本量':<10} {'准确率':<15}")
    print("-" * 60)
    for i, (sample_size, acc) in enumerate(results['opinion'], 1):
        print(f"{f'第{i}次':<10} {sample_size:<10} {f'{acc:.4%}':<15}")
    
    # 计算平均值
    opinion_avg_acc = sum(acc for _, acc in results['opinion']) / len(results['opinion'])
    opinion_avg_size = sum(size for size, _ in results['opinion']) / len(results['opinion'])
    print("-" * 60)
    print(f"{'平均值':<10} {int(opinion_avg_size):<10} {f'{opinion_avg_acc:.4%}':<15}")
    
    print("\n" + "="*80)


def main():
    print_flush("=== 模型准确率测试 ===")
    print_flush(f"设备: {DEVICE}")
    print_flush(f"测试次数: 3")
    print_flush(f"测试集比例: 30%")
    print_flush(f"随机种子: {SEED}")
    print_flush("")
    
    # 加载tokenizer
    print_flush("1/5 正在加载Tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(str(ROOT_DIR / 'bert-base-chinese'))
    print_flush("   Tokenizer加载完成")
    
    # 加载模型
    print_flush("2/5 正在加载情感分析模型...")
    emotion_model = load_emotion_model()
    print_flush("   情感分析模型加载完成")
    
    print_flush("   正在加载观点词提取模型...")
    opinion_model = load_opinion_model()
    print_flush("   观点词提取模型加载完成")
    
    # 加载数据集
    print_flush("3/5 正在加载数据集...")
    try:
        emotion_df = pd.read_csv(EMOTION_TRAIN_PATH, encoding='utf-8')
        print_flush(f"   情感分析数据集加载完成，共 {len(emotion_df)} 条")
    except Exception as e:
        print_flush(f"   UTF-8编码读取失败，尝试GBK编码...")
        emotion_df = pd.read_csv(EMOTION_TRAIN_PATH, encoding='gbk')
        print_flush(f"   情感分析数据集加载完成，共 {len(emotion_df)} 条")
    
    try:
        opinion_df = pd.read_csv(OPINION_TRAIN_PATH, encoding='utf-8')
        print_flush(f"   观点词提取数据集加载完成，共 {len(opinion_df)} 条")
    except Exception as e:
        print_flush(f"   UTF-8编码读取失败，尝试GBK编码...")
        opinion_df = pd.read_csv(OPINION_TRAIN_PATH, encoding='gbk')
        print_flush(f"   观点词提取数据集加载完成，共 {len(opinion_df)} 条")
    
    results = {
        'emotion': [],  # 存储(样本量, 准确率)
        'opinion': []   # 存储(样本量, 准确率)
    }
    
    # 进行三次随机抽样测试
    print_flush("4/5 开始进行测试...")
    for trial in range(1, 4):
        print_flush(f"\n--- 第 {trial} 次测试 ---")
        
        # 设置不同的种子确保每次抽样不同，但又可复现
        current_seed = SEED + trial
        
        # 测试情感分析模型
        print_flush("   测试情感分析模型...")
        set_seed(current_seed)
        _, test_emotion_df = split_data(emotion_df, test_ratio=0.3, seed=current_seed)
        print_flush(f"     抽样完成，测试样本量: {len(test_emotion_df)}")
        acc, sample_size = test_emotion_model(emotion_model, test_emotion_df, tokenizer)
        results['emotion'].append((sample_size, acc))
        print_flush(f"     准确率: {acc:.4%}")
        
        # 测试观点词提取模型
        print_flush("   测试观点词提取模型...")
        set_seed(current_seed)
        _, test_opinion_df = split_data(opinion_df, test_ratio=0.3, seed=current_seed)
        print_flush(f"     抽样完成，原始样本量: {len(test_opinion_df)}")
        test_texts, test_labels = prepare_opinion_data(test_opinion_df)
        print_flush(f"     数据预处理完成，有效样本量: {len(test_texts)}")
        acc, sample_size = test_opinion_model(opinion_model, test_texts, test_labels, tokenizer)
        results['opinion'].append((sample_size, acc))
        print_flush(f"     准确率: {acc:.4%}")
    
    # 输出结构化表格
    print_flush("\n5/5 输出测试结果...")
    print_results_table(results)
    
    print_flush("\n测试完成！")


if __name__ == "__main__":
    main()