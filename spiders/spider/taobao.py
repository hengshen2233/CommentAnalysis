"""
淘宝评论爬虫
1. 数据清洗功能
2. 淘宝评论数据获取功能
"""

# 配置浏览器路径
# from DrissionPage import ChromiumOptions
#
# path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
# ChromeOptions = ChromiumOptions().set_browser_path(path).save()

# 导入自动化
from DrissionPage import ChromiumPage
from datetime import datetime
import time
import re
import json
import pyautogui as pg


# 数据清洗
def clean_text(text):
    """
    清洗文本数据
    """
    if not text:
        return ''
    # 去除多余的空格和换行符
    text = re.sub(r'\s+', ' ', text.strip())
    # 处理特殊字符
    text = text.replace('\n', ' ').replace('\r', ' ')
    # 移除过多的空格
    text = ' '.join(text.split())
    return text


# 数据获取
def taobao_getdata(product_url, dataset, max_pages):
    """
    从淘宝商品页面获取评论数据
    """
    rows = []
    # 打开浏览器
    dp = ChromiumPage()
    # 访问网站
    dp.get(product_url)
    time.sleep(1)
    # 监听数据包
    dp.listen.start('6.0/?jsv=2.7.5&appKey=12574478')
    # 定位淘宝商品详情的“查看全部评价”按钮（元素定位）
    dp.ele('css:.ShowButton--fMu7HZNs').click()
    # 延时等待（数据包延迟问题）
    time.sleep(2)
    # 设置最大滚动次数或页数
    max_pages = max_pages / 2
    scroll_count = 0
    while scroll_count < max_pages:
        # 滚动条元素无法控制，使用鼠标滚动
        # script = """
        #   ele=document.getElementsByClassName("comments--ChxC7GEN");
        #   ele[0].scrollIntoView({behavior:"smooth", block:"end", inline:"nearest"});
        # """
        # dp.run_js(script)

        # 网页必须在最顶部且最大化，才可实现（强制鼠标滚动）
        pg.moveTo(543, 648, duration=1)
        for i in range(28):
            pg.scroll(-300)

        # 等待数据包加载
        resp = dp.listen.wait()
        # 等待加载
        time.sleep(2)
        # 获取响应数据内容
        jsonp_data = resp.response.body
        try:
            # 格式转换，提取JSON数据
            json_data = json.loads(re.match(".*?({.*}).*", jsonp_data, re.S).group(1))
            # 字典取值：提取评论列表
            data = json_data['data']['rateList']
        except:
            data = []
        # data为空，提前结束
        if not data:
            print('数据获取提前结束！')
            return rows
        for index in data:
            try:
                # 提取具体数据内容
                nickname = index['userNick']
                content = clean_text(index['feedback'])
                publishtime = datetime.strptime(index['feedbackDate'], "%Y年%m月%d日").strftime("%Y-%m-%d 12:00:00")
                score = int(index['extraInfoMap']['userGrade'])
                if content:
                    rows.append([nickname, content, publishtime, score, dataset])
            except:
                pass
        scroll_count += 1
        print(f'滚动第 {scroll_count} 次')
    return rows
