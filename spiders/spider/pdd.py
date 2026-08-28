"""
拼多多评论爬虫
1. 数据清洗功能
2. 拼多多评论数据获取功能
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
def pdd_getdata(product_url, dataset, max_scroll):
    """
    从拼多多商品页面获取评论数据
    """
    rows = []
    # 打开浏览器
    dp = ChromiumPage()
    # 访问网站
    dp.get(product_url)
    # 监听数据包
    dp.listen.start('mall_certificates.html')
    # 定位拼多多商品详情的“该商品所属店铺评价”按钮（元素定位）
    dp.ele('css:.QzD16Hhm').click()
    # 延时等待（数据包延迟问题）
    time.sleep(2)
    # 等待数据包加载
    resp = dp.listen.wait()
    # 获取响应数据内容
    json_data = resp.response.body
    # 从响应中提取 window.rawData 的内容
    raw_data = re.search(r'window\.rawData\s*=\s*({.*?});', json_data, re.DOTALL).group(1)
    raw_data = json.loads(raw_data)
    data = raw_data['store']['commentLists']["0"]
    for index in data:
        try:
            nickname = index['name']
            content = index['comment']
            publishtime = datetime.strptime(index['timeText'], "%Y.%m.%d").strftime("%Y-%m-%d 12:00:00")
            score = index['descScore']
            if content:
                rows.append([nickname, content, publishtime, score, dataset])

        except:
            pass
    print(f'滚动第 1 次')
    # 停止监听原数据包
    dp.listen.stop()
    # 监听新数据包
    dp.listen.start('mobile.pinduoduo.com/proxy/api/api/selene/mall/review/label/list')
    # 设置最大滚动次数或页数
    scroll_count = 1
    while scroll_count < max_scroll:
        # 执行滚动操作，加载更多评论
        script = """
            ele=document.getElementsByClassName("pdd-list-view_dsNed4s4");
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
        data = json_data['comment_result']['data']
        # data为空，提前结束
        if not data:
            print('数据获取提前结束！')
            return rows
        for index in data:
            try:
                # 提取具体数据内容
                nickname = index['name']
                content = clean_text(index['comment'])
                publishtime = datetime.strptime(index['time_text'], "%Y.%m.%d").strftime("%Y-%m-%d 12:00:00")
                score = int(index['desc_score'])
                if content:
                    rows.append([nickname, content, publishtime, score, dataset])
            except:
                pass
        scroll_count += 1
        print(f'滚动第 {scroll_count} 次')
    return rows
