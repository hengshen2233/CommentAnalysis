"""
数据存储
1. 将数据保存到CSV文件
2. 将CSV文件数据导入到MySQL数据库
"""

import os
import csv
import pandas as pd
from sqlalchemy import create_engine
from pathlib import Path

# 获取绝对路径
BASE_DIR = Path(__file__).resolve().parent


# 保存数据到CSV文件
def save_to_csv(rows):
    """
    将评论数据保存到CSV文件
    """
    if not rows:
        return 0
    filename = BASE_DIR / "comments.csv"  # CSV文件路径
    # 清空文件内容
    with open(filename, 'w', encoding='utf-8') as f:
        f.write('')  # 写入空字符串
    fieldnames = ['nickname', 'content', 'creationTime', 'score', 'dataset']  # CSV文件头
    file_exists = os.path.isfile(filename)  # 检查文件是否存在，决定是否写入表头
    with open(filename, 'a', newline='', encoding='utf-8-sig') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        if not file_exists:
            writer.writeheader()
        for row in rows:
            if isinstance(row, list) and len(row) == 5:  # 将列表转换为字典
                row_dict = {
                    'nickname': row[0],
                    'content': row[1],
                    'creationTime': row[2],
                    'score': row[3],
                    'dataset': row[4]
                }
                writer.writerow(row_dict)
            elif isinstance(row, dict):  # 如果已经是字典，直接写入
                writer.writerow(row)
            else:
                print(f"跳过无效数据行: {row}")
    print(f"数据已保存到 {filename}")
    return len(rows)


def csv_to_sql():
    """
    将CSV文件数据导入到MySQL数据库
    """
    csv_path = BASE_DIR / 'comments.csv'
    # 读取CSV文件，指定列名
    df = pd.read_csv(csv_path, names=['nickname', 'content', 'publishtime', 'score', 'dataset'])
    # 删除空值
    df.dropna(inplace=True)
    # 创建数据库引擎
    engine = create_engine("mysql://root:ma20040809@localhost/comment_analysis?charset=utf8mb4")
    print(df)
    # 将数据写入数据库表
    df.to_sql('myapp_comment', con=engine, if_exists='append', index=False)

