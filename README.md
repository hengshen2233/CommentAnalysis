# 电商商品评论分析系统

基于 **Django + BERT + LDA** 的电商商品评论分析系统，支持评论数据采集、情感分析、观点词抽取、主题词挖掘与多平台竞品分析，并提供可视化 Web 界面。

## 目录

- [项目介绍](#项目介绍)
- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [目录结构](#目录结构)
- [环境要求](#环境要求)
- [安装与运行](#安装与运行)
- [数据库配置](#数据库配置)
- [模型文件说明](#模型文件说明)

---

## 项目介绍

本系统面向电商运营与数据分析场景，围绕“商品评论”这一核心数据，提供从采集、存储到分析、可视化的完整流程：

1. **数据采集**：通过爬虫自动抓取京东、拼多多、淘宝三大平台的商品评论；
2. **数据管理**：对采集到的评论进行存储、检索与分类管理；
3. **情感分析**：基于 BERT 模型对评论进行情感分类（好评/中评/差评），并抽取观点词；
4. **主题词分析**：基于 LDA 主题模型挖掘评论中的高频主题与关键词；
5. **竞品分析**：对多平台、多商品的评论进行对比分析。

## 功能特性

| 模块 | 路由 | 说明 |
|------|------|------|
| 登录/注册/登出 | `/login` `/register` `/logout` | 用户账户管理，密码加密存储 |
| 数据总览 | `/dashboard` | 评论数据统计与可视化看板 |
| 评论管理 | `/search` | 评论检索、筛选与管理 |
| 数据采集 | `/acquisition` | 京东/拼多多/淘宝评论爬虫 |
| 数据管理 | `/management` | 数据集的新增、删除与维护 |
| 情感分析 | `/emotion` | BERT 情感分类 + 观点词抽取 |
| 主题词分析 | `/keywords` | LDA 主题模型与关键词提取 |
| 竞品分析 | `/competing` | 多平台竞品评论对比 |

## 技术栈

- **后端框架**：Django 5.2
- **数据库**：MySQL（通过 SQLAlchemy 与 Django ORM 访问）
- **深度学习**：PyTorch + HuggingFace Transformers（BERT）
- **预训练模型**：`bert-base-chinese`
- **主题模型**：LDA（自实现）
- **爬虫**：DrissionPage（浏览器自动化）
- **数据处理**：pandas、numpy
- **可视化**：matplotlib + 前端 ECharts

## 目录结构

```
电商商品评论分析系统/
├── manage.py                          # Django 项目管理入口
├── .gitignore                         # Git 忽略规则
│
├── CommentAnalysis/                   # Django 项目配置包
│   ├── settings.py                    # 全局配置（数据库、密钥等，⚠️ 需自行修改）
│   ├── urls.py                        # 根路由
│   ├── asgi.py                        # ASGI 部署入口
│   └── wsgi.py                        # WSGI 部署入口
│
├── myapp/                             # 核心业务应用
│   ├── models.py                      # 数据模型（用户/数据集/评论/情感分析表）
│   ├── views.py                       # 视图与核心业务逻辑
│   ├── urls.py                        # 应用路由
│   ├── admin.py                       # Django 后台管理
│   ├── tests.py                       # 单元测试
│   └── migrations/                    # 数据库迁移文件
│
├── bert/                              # BERT 情感分析与观点抽取模块
│   ├── emotion.py                     # 评论情感分类
│   ├── opinion.py                     # 观点词抽取（NER）
│   ├── train/
│   │   ├── train.py                   # 模型训练脚本
│   │   ├── accuracy.py                # 模型精度评估
│   │   ├── emotion_training_loss.png  # 情感模型训练损失曲线
│   │   └── opinion_training_loss.png  # 观点模型训练损失曲线
│   ├── cn_stopwords.txt               # 停用词表
│   ├── comments.csv                   # 评论数据集
│   ├── emotion.csv                    # 情感标注数据集
│   ├── opinion.csv                    # 观点词标注数据集
│   ├── emotion.pth                    # 训练好的情感模型权重（需自行准备）
│   ├── opinion.pth                    # 训练好的观点模型权重（需自行准备）
│   └── bert-base-chinese/             # 预训练模型（需自行下载）
│
├── lda/                               # LDA 主题模型模块
│   ├── lda_main.py                    # LDA 实现 + 关键词提取 + 中文分词
│   ├── lda_evaluation.py              # 主题数寻优与模型评估
│   ├── cn_stopwords.txt               # 停用词表
│   └── evaluation_results.png         # 评估结果可视化
│
├── spiders/                           # 电商评论爬虫模块
│   ├── spider/
│   │   ├── jd.py                      # 京东评论爬虫
│   │   ├── pdd.py                     # 拼多多评论爬虫
│   │   └── taobao.py                  # 淘宝评论爬虫
│   ├── tosql.py                       # 爬取数据入库
│   └── comments.csv                   # 示例数据
│
├── static/                            # 静态资源
│   ├── css/                           # 样式表
│   ├── js/                            # 前端脚本
│   └── images/                        # 图片资源（logo、头像、背景等）
│
└── templates/                         # 前端模板
    ├── login.html                     # 登录/注册页
    ├── dashboard.html                 # 数据总览页
    ├── search.html                    # 评论管理页
    ├── setting.html                   # 设置页
    ├── analysis/                      # 分析页面
    │   ├── emotion.html               # 情感分析页
    │   ├── keywords.html              # 主题词分析页
    │   └── competing.html             # 竞品分析页
    └── dataset/                       # 数据页面
        ├── acquisition.html           # 数据采集页
        └── management.html            # 数据管理页
```

## 环境要求

- **Python**：3.10 及以上（开发环境使用 3.10 / 3.13）
- **MySQL**：5.7 / 8.0（需创建数据库 `comment_analysis`）
- **CUDA**（可选）：训练 BERT 模型时建议使用 NVIDIA GPU，仅推理可用 CPU

主要依赖包：

```
Django>=5.2
pandas
numpy
torch
transformers
tqdm
matplotlib
sqlalchemy
mysqlclient            # Django 连接 MySQL 驱动
DrissionPage           # 爬虫浏览器自动化
pyautogui              # 淘宝爬虫辅助
```

> 更完整的环境可执行 `pip freeze > requirements.txt` 导出后共享。

## 安装与运行

1. **克隆项目**

   ```bash
   git clone https://github.com/hengshen2233/CommentAnalysis.git
   cd CommentAnalysis
   ```

2. **创建虚拟环境并安装依赖**

   ```bash
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # Linux / macOS
   source .venv/bin/activate

   pip install -r requirements.txt
   ```

3. **配置数据库（见 [数据库配置](#数据库配置)）**

   确保本机已安装并启动 MySQL，创建数据库：

   ```sql
   CREATE DATABASE comment_analysis DEFAULT CHARACTER SET utf8mb4;
   ```

4. **初始化数据库表**

   ```bash
   python manage.py migrate
   ```

5. **启动服务**

   ```bash
   python manage.py runserver
   ```

   浏览器访问 <http://127.0.0.1:8000> 即可。

## 数据库配置

数据库连接信息位于 `CommentAnalysis/settings.py` 的 `DATABASES` 配置块中：

```python
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.mysql",   # 数据库引擎
        "NAME": "comment_analysis",             # 数据库名称
        "USER": "root",                         # 数据库用户名
        "PASSWORD": "你的密码",                  # ⚠️ 改成你自己的 MySQL 密码
        "HOST": "localhost",
        "PORT": 3306,
    }
}
```

## 模型文件说明

由于 GitHub 单文件 100MB 限制，以下模型文件**未包含在仓库中**，需自行准备：

| 文件 | 大小 | 说明 | 获取方式 |
|------|------|------|----------|
| `bert/bert-base-chinese/` | ~1.6GB | 中文 BERT 预训练模型 | [HuggingFace 下载](https://huggingface.co/google-bert/bert-base-chinese) |
| `bert/emotion.pth` | ~390MB | 情感分类模型权重 | 运行 `bert/train/train.py` 训练生成 |
| `bert/opinion.pth` | ~388MB | 观点词抽取模型权重 | 运行 `bert/train/train.py` 训练生成 |

准备步骤：

1. 下载 `bert-base-chinese` 并解压到 `bert/bert-base-chinese/` 目录；
2. 使用 `bert/train/train.py` 在标注数据集上微调，生成 `.pth` 权重；
3. 也可将已有的 `.pth` 权重直接放入 `bert/` 目录。

## 常见问题

- **提示缺少依赖**：确认已激活虚拟环境并执行 `pip install -r requirements.txt`；
- **数据库连接失败**：检查 MySQL 是否启动、用户名密码是否正确、数据库 `comment_analysis` 是否已创建；
- **BERT 模型加载失败**：确认 `bert/bert-base-chinese/` 与 `.pth` 文件已按上文准备到位；
- **爬虫无法运行**：DrissionPage 依赖本机 Chrome/Edge 浏览器，请确认浏览器已安装。
