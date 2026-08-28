"""
LDA主题模型和关键词提取
1. 关键词提取
2. 简单的中文分词实现
3. 词性猜测
4. LDA主题模型的实现
5. 关键词趋势数据生成
"""

import random
from collections import Counter, defaultdict


def load_stopwords():
    """
    加载停用词表
    """
    stopwords = set()
    try:
        with open('lda/cn_stopwords.txt', 'r', encoding='utf-8') as f:
            for line in f:
                word = line.strip()
                if word:
                    stopwords.add(word)
    except Exception as e:
        print(f"加载停用词表失败: {e}")
    return stopwords

# 加载停用词表
STOP_WORDS = load_stopwords()

# 词性映射
POS_MAP = {
    'n': '名词', 'nr': '名词', 'ns': '名词', 'nt': '名词', 'nw': '名词', 'nz': '名词',
    'v': '动词', 'vd': '动词', 'vn': '动词', 'vf': '动词', 'vx': '动词', 'vi': '动词', 'vl': '动词', 'vg': '动词',
    'a': '形容词', 'ad': '形容词', 'an': '形容词', 'ag': '形容词', 'al': '形容词',
    'd': '副词', 'df': '副词', 'dg': '副词',
    'm': '其他', 'q': '其他', 'r': '其他', 'p': '其他', 'c': '其他', 'u': '其他', 'e': '其他', 'y': '其他', 'o': '其他', 'w': '其他'
}

def simple_segment(text):
    """
    中文分词
    基于词典和最大匹配算法
    """
    # 定义一些常见的词典词
    dict_words = {
        '手机', '电脑', '笔记本', '平板', '耳机', '充电器', '数据线', '屏幕', '电池', '摄像头',
        '外观', '设计', '颜色', '尺寸', '重量', '手感', '材质', '做工', '精致', '漂亮',
        '性能', '速度', '流畅', '卡顿', '发热', '续航', '待机', '充电', '耗电',
        '拍照', '照片', '像素', '清晰', '模糊', '对焦', '美颜', '滤镜', '视频',
        '价格', '便宜', '贵', '划算', '性价比', '优惠', '促销', '活动', '折扣',
        '物流', '快递', '发货', '送货', '配送', '包装', '完好', '破损', '速度',
        '服务', '客服', '售后', '态度', '耐心', '专业', '及时', '周到', '满意',
        '质量', '品质', '正品', '假货', '山寨', '耐用', '可靠', '稳定', '问题',
        '体验', '感受', '觉得', '认为', '感觉', '总体', '整体', '综合', '值得',
        '推荐', '好评', '差评', '中评', '五星', '一星', '点赞', '吐槽', '建议'
    }
    words = []
    i = 0
    text_len = len(text)

    while i < text_len:
        # 尝试匹配词典中的词（最长匹配）
        matched = False
        for length in range(min(6, text_len - i), 0, -1):
            substr = text[i:i + length]
            if substr in dict_words:
                words.append(substr)
                i += length
                matched = True
                break

        if not matched:
            # 检查是否是中文
            char = text[i]
            if '\u4e00' <= char <= '\u9fff':
                words.append(char)
            i += 1
    return words


def guess_pos(word):
    """
    猜测词性
    """
    # 基于词尾和常见模式猜测词性
    # 名词后缀
    if word.endswith(('性', '度', '率', '力', '化', '学', '术', '论', '法', '理', '品', '牌', '机', '器', '备', '件', '子', '物', '人', '员', '家', '者', '师', '生', '友', '客', '户', '商', '店', '场', '所', '处', '室', '厅', '楼', '房', '车', '船', '机', '具', '器', '材', '料', '品', '种', '类', '型', '式', '样', '款', '式', '版', '本', '代', '级', '别', '位', '置', '点', '面', '线', '体', '形', '状', '态', '势', '力', '量', '度', '数', '量', '质', '量', '性', '能', '力', '率', '度', '比', '例', '率', '数', '据', '息', '信', '号', '码', '号', '字', '符', '号', '名', '称', '号', '码', '号', '牌', '号', '码', '号', '码')):
        return '名词'
    # 形容词后缀
    elif word.endswith(('的', '地', '得', '好', '坏', '大', '小', '高', '低', '长', '短', '宽', '窄', '厚', '薄', '深', '浅', '远', '近', '快', '慢', '新', '旧', '老', '少', '多', '少', '大', '小', '强', '弱', '硬', '软', '冷', '热', '凉', '暖', '甜', '苦', '酸', '辣', '咸', '淡', '香', '臭', '美', '丑', '胖', '瘦', '高', '矮', '长', '短', '宽', '窄', '厚', '薄', '深', '浅', '远', '近', '快', '慢', '新', '旧', '老', '少', '多', '少', '大', '小', '强', '弱', '硬', '软', '冷', '热', '凉', '暖', '甜', '苦', '酸', '辣', '咸', '淡', '香', '臭', '美', '丑', '胖', '瘦')):
        return '形容词'
    # 动词后缀
    elif word.endswith(('了', '着', '过', '是', '有', '在', '为', '到', '来', '去', '上', '下', '进', '出', '回', '开', '关', '买', '卖', '用', '看', '听', '说', '读', '写', '做', '干', '办', '搞', '弄', '打', '击', '拍', '敲', '推', '拉', '扯', '拽', '拖', '扛', '抬', '抱', '背', '提', '拿', '抓', '握', '捏', '摸', '碰', '触', '接', '触', '打', '击', '拍', '敲', '推', '拉', '扯', '拽', '拖', '扛', '抬', '抱', '背', '提', '拿', '抓', '握', '捏', '摸', '碰', '触', '接', '触')):
        return '动词'
    # 副词后缀
    elif word.endswith(('很', '极', '最', '更', '太', '非常', '特别', '十分', '非常', '特别', '十分', '很', '极', '最', '更', '太', '非常', '特别', '十分', '很', '极', '最', '更', '太', '非常', '特别', '十分')):
        return '副词'
    # 常见名词
    elif any(w in word for w in ['手机', '电脑', '产品', '商品', '东西', '设备', '机器', '耳机', '充电器', '数据线', '屏幕', '电池', '摄像头', '外观', '设计', '颜色', '尺寸', '重量', '手感', '材质', '做工', '性能', '速度', '续航', '拍照', '照片', '像素', '价格', '物流', '快递', '服务', '客服', '售后', '质量', '品质', '体验', '感受']):
        return '名词'
    # 常见形容词
    elif any(w in word for w in ['好', '大', '小', '高', '低', '快', '慢', '新', '旧', '漂亮', '精致', '流畅', '卡顿', '发热', '清晰', '模糊', '便宜', '贵', '划算', '满意', '喜欢', '推荐', '好评', '差评', '耐用', '可靠', '稳定']):
        return '形容词'
    # 常见动词
    elif any(w in word for w in ['买', '用', '看', '说', '做', '打', '发', '送', '收', '寄', '拍', '照', '充', '电', '玩', '游戏', '听', '歌', '看', '电影', '浏览', '网页', '下载', '安装', '卸载', '升级', '降级', '重启', '关机', '开机']):
        return '动词'
    # 常见副词
    elif any(w in word for w in ['很', '非常', '特别', '十分', '太', '最', '更', '比较', '相当', '特别', '尤其', '格外', '分外', '非常', '特别', '十分', '很', '极', '最', '更', '太']):
        return '副词'
    else:
        # 根据词长和结构判断
        if len(word) == 1:
            return '其他'
        # 两个字的词，根据常见组合判断
        elif len(word) == 2:
            # 形+名
            if word[0] in '大小高矮胖瘦新旧好坏美丑冷热软硬强弱':
                return '形容词'
            # 动+名
            elif word[0] in '买卖用看听读写做干办搞弄打':
                return '动词'
            else:
                return '名词'
        else:
            return '名词'


class LDA:
    """
    LDA主题模型
    """
    
    def __init__(self, num_topics, alpha=0.1, beta=0.1, iterations=100):
        """
        初始化LDA模型
        """
        self.num_topics = num_topics
        self.alpha = alpha  # 主题分布的先验参数
        self.beta = beta    # 词分布的先验参数
        self.iterations = iterations
        self.topic_assignments = []  # 每个词的主题分配
        self.topic_counts = []       # 每个主题的词计数
        self.word_topic_counts = defaultdict(lambda: defaultdict(int))  # 词-主题计数
        self.vocabulary = set()      # 词汇表
        self.word2id = {}            # 词到ID的映射
        self.id2word = {}            # ID到词的映射
        self.corpus = []             # 语料库

    def fit(self, corpus):
        """
        训练LDA模型
        """
        # 构建词汇表
        self.corpus = corpus
        for doc in corpus:
            for word in doc:
                self.vocabulary.add(word)
        
        # 构建词映射
        for i, word in enumerate(self.vocabulary):
            self.word2id[word] = i
            self.id2word[i] = word
        
        # 初始化
        self.topic_assignments = []
        self.topic_counts = [0] * self.num_topics
        self.word_topic_counts = defaultdict(lambda: defaultdict(int))
        
        # 随机初始化主题分配
        for doc in corpus:
            doc_topics = []
            for word in doc:
                topic = random.randint(0, self.num_topics - 1)
                doc_topics.append(topic)
                self.topic_counts[topic] += 1
                self.word_topic_counts[word][topic] += 1
            self.topic_assignments.append(doc_topics)
        
        # 吉布斯采样
        for _ in range(self.iterations):
            self._gibbs_sample()
    
    def _gibbs_sample(self):
        """
        吉布斯采样一次迭代
        """
        for doc_idx, doc in enumerate(self.corpus):
            for word_idx, word in enumerate(doc):
                # 移除当前词的主题分配
                old_topic = self.topic_assignments[doc_idx][word_idx]
                self.topic_counts[old_topic] -= 1
                self.word_topic_counts[word][old_topic] -= 1
                
                # 计算每个主题的概率
                topic_probs = []
                for topic in range(self.num_topics):
                    # 计算主题概率
                    topic_prob = (self.topic_counts[topic] + self.alpha) / \
                               (len(doc) - 1 + self.num_topics * self.alpha)
                    # 计算词在主题中的概率
                    word_prob = (self.word_topic_counts[word][topic] + self.beta) / \
                              (self.topic_counts[topic] + len(self.vocabulary) * self.beta)
                    topic_probs.append(topic_prob * word_prob)
                
                # 归一化概率
                total_prob = sum(topic_probs)
                topic_probs = [p / total_prob for p in topic_probs]
                
                # 采样新主题
                new_topic = self._sample(topic_probs)
                
                # 更新主题分配
                self.topic_assignments[doc_idx][word_idx] = new_topic
                self.topic_counts[new_topic] += 1
                self.word_topic_counts[word][new_topic] += 1
    
    def _sample(self, probabilities):
        """
        根据概率分布采样
        """
        r = random.random()
        cumulative = 0
        for i, prob in enumerate(probabilities):
            cumulative += prob
            if r <= cumulative:
                return i
        return len(probabilities) - 1
    
    def get_topic_words(self, top_n=10):
        """
        获取每个主题的Top N关键词
        """
        topics = []
        for topic in range(self.num_topics):
            # 计算每个词在该主题中的概率
            word_probs = {}
            for word in self.vocabulary:
                count = self.word_topic_counts[word].get(topic, 0)
                prob = (count + self.beta) / (self.topic_counts[topic] + len(self.vocabulary) * self.beta)
                word_probs[word] = prob
            
            # 排序并取Top N
            sorted_words = sorted(word_probs.items(), key=lambda x: x[1], reverse=True)[:top_n]
            topics.append({
                'topic_id': topic,
                'keywords': [{'word': word, 'weight': prob} for word, prob in sorted_words],
                'weight': self.topic_counts[topic] / sum(self.topic_counts)
            })
        return topics
    
    def get_document_topics(self, doc_idx):
        """
        获取文档的主题分布
        """
        doc_topics = self.topic_assignments[doc_idx]
        topic_counts = Counter(doc_topics)
        total = len(doc_topics)
        return {topic: count / total for topic, count in topic_counts.items()}