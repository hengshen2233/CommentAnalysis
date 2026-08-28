"""
LDA模型评估
1. 计算模型的困惑度
2. 计算主题的语义一致性
3. 评估不同主题数量的模型性能
4. 绘制评估结果图
"""

import matplotlib.pyplot as plt
from lda_main import LDA, simple_segment, STOP_WORDS
import math
import os
import pandas as pd
from sqlalchemy import create_engine
from collections import defaultdict


def compute_perplexity(lda_model, test_corpus):
    """
    计算LDA模型的困惑度
    困惑度越低，模型效果越好
    """
    if not test_corpus or not lda_model.vocabulary:
        return float('inf')
    
    total_words = 0
    log_likelihood = 0
    
    for doc in test_corpus:
        doc_len = len(doc)
        if doc_len == 0:
            continue
        
        total_words += doc_len
        
        # 计算文档的主题分布
        topic_probs = {}
        for topic in range(lda_model.num_topics):
            topic_prob = (lda_model.topic_counts[topic] + lda_model.alpha) / \
                       (sum(lda_model.topic_counts) + lda_model.num_topics * lda_model.alpha)
            topic_probs[topic] = topic_prob
        
        # 计算文档中每个词的概率
        for word in doc:
            word_prob = 0
            for topic, topic_prob in topic_probs.items():
                word_topic_count = lda_model.word_topic_counts.get(word, {}).get(topic, 0)
                word_in_topic_prob = (word_topic_count + lda_model.beta) / \
                                   (lda_model.topic_counts[topic] + len(lda_model.vocabulary) * lda_model.beta)
                word_prob += topic_prob * word_in_topic_prob
            
            if word_prob > 0:
                log_likelihood += math.log(word_prob)
    
    if total_words == 0:
        return float('inf')
    
    perplexity = math.exp(-log_likelihood / total_words)
    return perplexity


def compute_coherence(lda_model, top_n=10):
    """
    计算主题的语义一致性
    一致性越高，主题质量越好
    """
    topics = lda_model.get_topic_words(top_n)
    if not topics:
        return 0
    
    total_coherence = 0
    
    for topic in topics:
        keywords = [kw['word'] for kw in topic['keywords']]
        topic_coherence = 0
        count = 0
        
        # 计算关键词之间的共现得分
        for i in range(len(keywords)):
            for j in range(i + 1, len(keywords)):
                # 使用词频的倒数进行计算
                word1_freq = sum(lda_model.word_topic_counts.get(keywords[i], {}).values())
                word2_freq = sum(lda_model.word_topic_counts.get(keywords[j], {}).values())
                if word1_freq > 0 and word2_freq > 0:
                    topic_coherence += 1 / math.log(word1_freq + word2_freq)
                    count += 1
        
        if count > 0:
            total_coherence += topic_coherence / count
    
    return total_coherence / len(topics) if topics else 0


def evaluate_lda_models(corpus, test_corpus, topic_range=range(2, 11), top_n=10):
    """
    评估不同主题数量的LDA模型
    """
    perplexities = []
    coherences = []
    
    for num_topics in topic_range:
        print(f"正在评估主题数为 {num_topics} 的模型...")
        lda = LDA(num_topics=num_topics, iterations=100)
        lda.fit(corpus)
        
        # 计算困惑度
        perplexity = compute_perplexity(lda, test_corpus)
        perplexities.append(perplexity)
        
        # 计算语义一致性
        coherence = compute_coherence(lda, top_n)
        coherences.append(coherence)
        
        print(f"主题数: {num_topics}, 困惑度: {perplexity:.4f}, 一致性: {coherence:.4f}")
    
    return topic_range, perplexities, coherences


def plot_evaluation_results(topic_range, perplexities, coherences, save_path='lda/evaluation_results.png'):
    """
    绘制评估结果图
    """
    plt.figure(figsize=(12, 6))
    
    # 绘制困惑度图
    plt.subplot(1, 2, 1)
    plt.plot(topic_range, perplexities, marker='o', linestyle='-', color='blue')
    plt.title('LDA Model Perplexity')
    plt.xlabel('Number of Topics')
    plt.ylabel('Perplexity')
    plt.grid(True)
    
    # 绘制一致性图
    plt.subplot(1, 2, 2)
    plt.plot(topic_range, coherences, marker='o', linestyle='-', color='green')
    plt.title('LDA Model Coherence')
    plt.xlabel('Number of Topics')
    plt.ylabel('Coherence Score')
    plt.grid(True)
    
    plt.tight_layout()
    plt.savefig(save_path)
    print(f"评估结果图已保存至: {save_path}")


def extract_keywords(text, algorithm='tfidf', top_n=20):
    """
    从文本中提取关键词
    """
    if not text or not isinstance(text, str):
        return []
    
    # 分词
    words = simple_segment(text)
    
    # 过滤停用词和单字
    words = [word for word in words if word not in STOP_WORDS and len(word) > 1]
    
    if not words:
        return []
    
    if algorithm == 'tfidf':
        # 计算词频
        word_counts = defaultdict(int)
        for word in words:
            word_counts[word] += 1
        
        # 计算TF值（归一化词频）
        total_words = len(words)
        tf_scores = {word: count / total_words for word, count in word_counts.items()}
        
        # 由于没有文档集合，使用简化的IDF计算（基于词频的倒数）
        # 词频越低，IDF越高
        idf_scores = {}
        for word, count in word_counts.items():
            # 使用对数平滑的IDF
            idf_scores[word] = math.log((1 + total_words) / (1 + count)) + 1
        
        # 计算TF-IDF得分
        tfidf_scores = {word: tf_scores[word] * idf_scores[word] for word in word_counts}
        
        # 排序并取Top N
        sorted_words = sorted(tfidf_scores.items(), key=lambda x: x[1], reverse=True)[:top_n]
        return [{'word': word, 'weight': weight} for word, weight in sorted_words]
    
    else:
        # 默认使用词频
        word_counts = defaultdict(int)
        for word in words:
            word_counts[word] += 1
        
        sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)[:top_n]
        return [{'word': word, 'weight': count} for word, count in sorted_words]


def prepare_corpus(texts):
    """
    准备语料库
    """
    corpus = []
    for text in texts:
        if text and isinstance(text, str):
            keywords = extract_keywords(text, algorithm='tfidf', top_n=50)
            words = [kw['word'] for kw in keywords]
            if words:
                corpus.append(words)
    return corpus


def get_comments_from_db():
    """
    从数据库获取所有评论
    """
    try:
        # 创建数据库引擎，参考tosql.py中的连接方式
        engine = create_engine("mysql://root:ma20040809@localhost/comment_analysis?charset=utf8mb4")
        # 查询所有评论内容
        query = "SELECT content FROM myapp_comment WHERE content IS NOT NULL AND content != ''"
        df = pd.read_sql(query, engine)
        # 提取评论文本
        comment_texts = df['content'].tolist()
        print(f"从数据库获取到 {len(comment_texts)} 条评论")
        return comment_texts
    except Exception as e:
        print(f"从数据库获取评论时出错: {e}")
        return []


if __name__ == '__main__':
    # 从数据库获取所有评论
    comment_texts = get_comments_from_db()
    # 准备语料库
    corpus = prepare_corpus(comment_texts)
    # 分割训练集和测试集
    train_size = int(len(corpus) * 0.8)
    train_corpus = corpus[:train_size]
    test_corpus = corpus[train_size:]
    # 评估不同主题数量的模型
    topic_range, perplexities, coherences = evaluate_lda_models(train_corpus, test_corpus, topic_range=range(2, 11))
    # 绘制并保存评估结果图
    current_dir = os.path.dirname(os.path.abspath(__file__))
    save_path = os.path.join(current_dir, 'evaluation_results.png')
    plot_evaluation_results(topic_range, perplexities, coherences, save_path=save_path)
