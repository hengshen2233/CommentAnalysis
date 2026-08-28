"""
京东评论爬虫
1. 数据清洗功能
2. 京东评论数据获取功能
"""

# 配置浏览器路径
# from DrissionPage import ChromiumOptions
#
# path = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
# ChromeOptions = ChromiumOptions().set_browser_path(path).save()

# 导入自动化
from DrissionPage import ChromiumPage
import time
import re


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
def jd_getdata(product_url, dataset, max_scroll):
    """
    从京东商品页面获取评论数据
    """
    rows = []
    # 打开浏览器
    dp = ChromiumPage()
    # 访问网站
    dp.get(product_url)
    # 延时等待（数据包延迟问题）
    time.sleep(2)
    # 监听数据包
    dp.listen.start('client.action')
    # 定位京东商品详情的“全部评价”按钮（元素定位）
    dp.ele('css:.all-btn').click()
    # 设置最大滚动次数或页数
    scroll_count = 0
    while scroll_count < max_scroll:
        # 执行滚动操作，加载更多评论
        script = """
            ele=document.getElementsByClassName("_list_1ygkr_67");
            ele[0].scrollIntoView({behavior:"smooth", block:"end", inline:"nearest"});
        """
        dp.run_js(script)
        # 等待数据包加载
        resp = dp.listen.wait()
        # 等待加载
        time.sleep(3)
        # 获取响应数据内容
        json_data = resp.response.body
        # 字典取值：提取评论列表
        data = json_data['result']['floors'][2]['data']
        # data为空，提前结束
        if not data:
            print('数据获取提前结束！')
            return rows
        for index in data:
            try:
                # 提取具体数据内容
                nickname = index['commentInfo']['userNickName']
                content = clean_text(index['commentInfo']['commentData'])
                publishtime = index['commentInfo']['commentDate']
                score = int(index['commentInfo']['commentScore'])
                if content:
                    rows.append([nickname, content, publishtime, score, dataset])
            except:
                pass
        scroll_count += 1
        print(f'滚动第 {scroll_count} 次')
    return rows
