from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.contrib.auth.hashers import check_password, make_password
from django.conf import settings
from django.db import transaction
from django.db.models import Count
from myapp.models import Dataset, Comment, User, Sentiment
import os
import sys
import re
from datetime import datetime, timedelta
import random
import threading
import json
from collections import Counter


"""
用户认证相关视图函数
1. 处理用户登录
2. 处理用户登出
3. 处理用户注册
"""


def login(request):
    if request.method == 'GET':  # 处理GET请求：显示登录页面
        return render(request, 'login.html')
    elif request.method == 'POST':  # 处理POST请求：处理登录表单提交
        res = request.POST  # 获取POST请求中的所有数据
        obj = User.objects.filter(username=res['username'])  # 根据用户名查询用户是否存在
        if obj:  # 用户名存在
            obj = obj[0]  # 获取第一个用户对象
            if check_password(res['password'], obj.password):  # 验证密码是否正确
                request.session['user'] = obj.id  # 密码正确，将用户ID存入session，标记用户为已登录状态
                return HttpResponse('<script>location.href="/dashboard/"</script>')
            else:
                return HttpResponse('<script>alert("用户名或密码不正确！");location.href="/login/"</script>')
        else:
            return HttpResponse('<script>alert("用户名或密码不正确！");location.href="/login/"</script>')
    else:
        return HttpResponse('<script>alert("请求方式不正确！")</script>')


def logout(request):
    try:
        del request.session['user']  # 删除session中的用户ID，标记用户为未登录状态
    except:
        pass
    return HttpResponse('<script>location.href="/login/"</script>')


def register(request):
    if request.method == 'GET':  # 处理GET请求：显示注册页面
        return render(request, 'login.html')
    elif request.method == 'POST':  # 处理POST请求：处理用户提交的注册表单数据
        try:
            obj = User()  # 创建模型对象
            obj.username = request.POST['username']  # 从POST数据中获取用户名并赋值给模型对象
            obj.phone = request.POST['phone']
            obj.email = request.POST['email']
            obj.nickname = f"用户{User.objects.count() + 1}"  # 默认昵称
            obj.avatar = "avatars/default_avatar.png"  # 默认头像
            obj.password = make_password(request.POST['password'], None, 'pbkdf2_sha256')  # 对密码进行加密处理
            obj.registtime = datetime.now()
            if not all([obj.username, obj.phone, obj.email, obj.password]):  # 验证必填项
                return HttpResponse('<script>alert("请填写所有必填项！");history.back();</script>')
            if User.objects.filter(username=obj.username).exists():  # 检查用户名是否已存在
                return HttpResponse('<script>alert("用户名已存在！");history.back();</script>')
            if User.objects.filter(phone=obj.phone).exists():  # 检查手机号是否已存在
                return HttpResponse('<script>alert("手机号已被注册！");history.back();</script>')
            if User.objects.filter(email=obj.email).exists():  # 检查邮箱是否已存在
                return HttpResponse('<script>alert("邮箱已被注册！");history.back();</script>')
            obj.save()  # 将用户数据保存到数据库
            obj.nickname = f"用户{obj.id}"  # 更新昵称
            obj.save()
            request.session['user'] = obj.id  # 自动登录
            return HttpResponse('<script>location.href="/"</script>')
        except:
            return HttpResponse('<script>alert("注册失败！");location.href="/register/"</script>')
    else:
        return HttpResponse('<script>alert("请求方式不正确！");location.href="/register/"</script>')


"""
仪表盘页面，显示数据统计和图表
"""

def dashboard(request):
    # 检查用户是否登录
    if 'user' not in request.session:
        return HttpResponse('<script>alert("请先登录！");location.href="/login/"</script>')
    try:
        # 获取当前登录用户信息
        user_id = request.session['user']
        user = User.objects.get(id=user_id)

        # 处理头像路径
        # 数据库存储的是相对路径，如 "avatars/default_avatar.png"
        if user.avatar:
            # 转换为静态文件路径
            avatar_url = f'/static/images/{user.avatar}'
        else:
            # 如果没有头像，使用默认头像
            avatar_url = '/static/images/avatars/default_avatar.png'

        # 准备传递给模板的用户数据
        user_data = {
            'nickname': user.nickname,
            'avatar_url': avatar_url,
        }
        
        # 获取商品筛选参数
        selected_product = request.GET.get('product', 'all')
        
        # 统计数据
        if selected_product == 'all':
            total_datasets = Dataset.objects.filter(username=user).count()
            sentiment_datasets = Dataset.objects.filter(username=user, hassentiment=True).count()
            unique_products = Dataset.objects.filter(username=user).values('product').distinct().count()
            # 获取用户的所有数据集名称
            user_dataset_names = list(Dataset.objects.filter(username=user).values_list('dataset', flat=True))
            total_comments = Comment.objects.filter(dataset__in=user_dataset_names).count()
        else:
            total_datasets = Dataset.objects.filter(username=user, product=selected_product).count()
            sentiment_datasets = Dataset.objects.filter(username=user, product=selected_product, hassentiment=True).count()
            unique_products = 1
            # 获取用户该商品的所有数据集名称
            user_dataset_names = list(Dataset.objects.filter(username=user, product=selected_product).values_list('dataset', flat=True))
            total_comments = Comment.objects.filter(dataset__in=user_dataset_names).count()
        
        # 近12个月的评论数据（按月份和评分）
        from datetime import datetime, timedelta
        import calendar
        
        # 获取当前时间
        now = datetime.now()
        # 生成近12个月的月份列表
        months = []
        for i in range(11, -1, -1):
            month_date = now - timedelta(days=i*30)
            months.append(month_date.strftime('%Y-%m'))
        
        # 按月份和评分统计评论数量
        monthly_comments = {}
        for month in months:
            monthly_comments[month] = {
                'positive': 0,  # 4-5分
                'neutral': 0,   # 3分
                'negative': 0   # 1-2分
            }
        
        # 遍历评论，统计每月的评分分布
        if selected_product == 'all':
            # 获取用户的所有数据集名称
            user_dataset_names = list(Dataset.objects.filter(username=user).values_list('dataset', flat=True))
            comments = Comment.objects.filter(dataset__in=user_dataset_names)
        else:
            # 获取用户该商品的所有数据集名称
            user_dataset_names = list(Dataset.objects.filter(username=user, product=selected_product).values_list('dataset', flat=True))
            comments = Comment.objects.filter(dataset__in=user_dataset_names)
        
        for comment in comments:
            if comment.score and comment.publishtime:
                comment_month = comment.publishtime.strftime('%Y-%m')
                if comment_month in monthly_comments:
                    if comment.score >= 4:
                        monthly_comments[comment_month]['positive'] += 1
                    elif comment.score == 3:
                        monthly_comments[comment_month]['neutral'] += 1
                    else:
                        monthly_comments[comment_month]['negative'] += 1
        
        # 准备月份标签和数据
        month_labels = [calendar.month_abbr[int(month.split('-')[1])] for month in months]
        positive_data = [monthly_comments[month]['positive'] for month in months]
        neutral_data = [monthly_comments[month]['neutral'] for month in months]
        negative_data = [monthly_comments[month]['negative'] for month in months]
        
        # 按评分统计评论数量
        score_distribution = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
        if selected_product == 'all':
            # 获取用户的所有数据集名称
            user_dataset_names = list(Dataset.objects.filter(username=user).values_list('dataset', flat=True))
            score_comments = Comment.objects.filter(dataset__in=user_dataset_names, score__isnull=False)
        else:
            # 获取用户该商品的所有数据集名称
            user_dataset_names = list(Dataset.objects.filter(username=user, product=selected_product).values_list('dataset', flat=True))
            score_comments = Comment.objects.filter(dataset__in=user_dataset_names, score__isnull=False)
        
        for comment in score_comments:
            if comment.score in score_distribution:
                score_distribution[comment.score] += 1
        
        score_labels = list(score_distribution.keys())
        score_data = list(score_distribution.values())
        
        # 商品列表（用于筛选）
        products = Dataset.objects.filter(username=user).values_list('product', flat=True).distinct()
        
        # 获取随机评论
        import random
        if selected_product == 'all':
            # 获取用户的所有数据集名称
            user_dataset_names = list(Dataset.objects.filter(username=user).values_list('dataset', flat=True))
            all_comments = Comment.objects.filter(dataset__in=user_dataset_names)
        else:
            # 获取用户该商品的所有数据集名称
            user_dataset_names = list(Dataset.objects.filter(username=user, product=selected_product).values_list('dataset', flat=True))
            all_comments = Comment.objects.filter(dataset__in=user_dataset_names)
        
        # 随机选择最多5条评论
        random_comments = random.sample(list(all_comments), min(5, len(all_comments)))
        
        # 检查是否是AJAX请求
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            import json
            # 构建评论数据
            comments_data = []
            for comment in random_comments:
                comments_data.append({
                    'nickname': comment.nickname or '匿名用户',
                    'content': comment.content,
                    'score': comment.score or 0,
                    'publishtime': comment.publishtime.strftime('%Y-%m-%d %H:%M') if comment.publishtime else '未知时间'
                })
            return HttpResponse(json.dumps({
                'total_datasets': total_datasets,
                'sentiment_datasets': sentiment_datasets,
                'unique_products': unique_products,
                'total_comments': total_comments,
                'positive_data': positive_data,
                'neutral_data': neutral_data,
                'negative_data': negative_data,
                'score_labels': score_labels,
                'score_data': score_data,
                'random_comments': comments_data
            }), content_type='application/json')
        
        # 准备传递给模板的数据
        context = {
            'user': user_data,
            'total_datasets': total_datasets,
            'sentiment_datasets': sentiment_datasets,
            'unique_products': unique_products,
            'total_comments': total_comments,
            'month_labels': month_labels,
            'positive_data': positive_data,
            'neutral_data': neutral_data,
            'negative_data': negative_data,
            'score_labels': score_labels,
            'score_data': score_data,
            'products': products,
            'selected_product': selected_product,
            'random_comments': random_comments
        }
        
        return render(request, 'dashboard.html', context)
    except User.DoesNotExist:
        # 用户不存在，清空session并重定向到登录页
        if 'user' in request.session:
            del request.session['user']
        return HttpResponse('<script>alert("用户不存在！");location.href="/login/"</script>')



"""
评论搜索页面，支持关键词搜索、筛选和导出
"""

def search(request):
    if 'user' not in request.session:
        return HttpResponse('<script>alert("请先登录！");location.href="/login/"</script>')

    try:
        user_id = request.session['user']
        user = User.objects.get(id=user_id)

        # 如果是AJAX请求
        if request.method == 'GET' and request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            # 获取参数
            search_keyword = request.GET.get('keyword', '').strip()
            dataset_filter = request.GET.get('dataset', '')
            product_filter = request.GET.get('product', '')
            datasource_filter = request.GET.get('datasource', '')
            sentiment_filter = request.GET.get('sentiment', '')
            sort_by = request.GET.get('sort_by', 'publishtime')
            sort_order = request.GET.get('sort_order', 'desc')

            # 是否仅获取筛选选项
            get_filter_options = request.GET.get('get_filter_options', 'false') == 'true'

            page = 1
            per_page = 10
            # 检查是否是导出请求
            is_export = request.GET.get('export', 'false') == 'true'

            # 如果不是导出请求且不是仅获取选项，获取分页参数
            if not is_export and not get_filter_options:
                page = int(request.GET.get('page', 1))
                per_page = 10

            # 获取用户数据集
            user_datasets = Dataset.objects.filter(username=user)
            user_dataset_names = list(user_datasets.values_list('dataset', flat=True))

            # 如果用户没有数据集，返回空结果
            if not user_dataset_names:
                return JsonResponse({
                    'success': True,
                    'total': 0,
                    'comments': [],
                    'page': 1,
                    'total_pages': 0,
                    'available_datasets': [],
                    'available_products': [],
                    'available_datasources': [],
                    'disabled_datasets': False,
                    'disabled_products': False,
                    'disabled_datasources': False
                }, json_dumps_params={'ensure_ascii': False})

            # 基础查询
            comments_query = Comment.objects.filter(dataset__in=user_dataset_names)

            # 初始化筛选选项和控制状态
            available_datasets = []
            available_products = []
            available_datasources = []
            disabled_datasets = False
            disabled_products = False
            disabled_datasources = False

            # 规则1: 如果筛选了数据集，商品和平台不能筛选
            if dataset_filter:
                # 获取该数据集的信息
                dataset_obj = Dataset.objects.filter(dataset=dataset_filter, username=user).first()
                if dataset_obj:
                    # 数据集筛选时，商品和平台被限定为该数据集对应的值
                    available_products = [dataset_obj.product]
                    available_datasources = [dataset_obj.datasource]
                    # 数据集筛选范围应该是所有的数据集（从用户的数据集中获取）
                    available_datasets = list(user_datasets.values_list('dataset', flat=True))

                    # 商品和平台不可筛选
                    disabled_products = True
                    disabled_datasources = True
                    # 数据集可筛选（可以切换回"所有数据集"）
                    disabled_datasets = False

                    # 应用筛选到查询
                    comments_query = comments_query.filter(dataset=dataset_filter)

            # 规则2: 如果筛选了商品（且没有筛选数据集）
            elif product_filter and not dataset_filter:
                # 数据集不可筛选
                disabled_datasets = True

                # 如果同时筛选了平台
                if datasource_filter:
                    # 获取该商品+平台组合的数据集
                    source_datasets = Dataset.objects.filter(
                        username=user,
                        product=product_filter,
                        datasource=datasource_filter
                    )

                    if source_datasets.exists():
                        # 获取数据集
                        available_datasets = list(source_datasets.values_list('dataset', flat=True))
                        # 商品选项为当前平台下的所有商品
                        platform_datasets = Dataset.objects.filter(
                            username=user,
                            datasource=datasource_filter
                        )
                        available_products = list(platform_datasets.values_list('product', flat=True).distinct())
                        # 平台选项为当前商品下的所有平台
                        product_datasets_all = Dataset.objects.filter(
                            username=user,
                            product=product_filter
                        )
                        available_datasources = list(
                            product_datasets_all.values_list('datasource', flat=True).distinct())

                        # 应用筛选到查询
                        dataset_names = list(source_datasets.values_list('dataset', flat=True))
                        comments_query = comments_query.filter(dataset__in=dataset_names)
                    else:
                        # 如果不存在这样的组合，清空查询结果
                        comments_query = comments_query.none()
                        available_datasets = []
                        available_products = [product_filter]
                        available_datasources = [datasource_filter]
                else:
                    # 只筛选了商品，没有筛选平台
                    # 获取该商品的所有数据集
                    product_datasets = Dataset.objects.filter(
                        username=user,
                        product=product_filter
                    )

                    if product_datasets.exists():
                        # 获取这些数据集的数据来源（去重）
                        available_datasources = list(product_datasets.values_list('datasource', flat=True).distinct())
                        # 获取这些数据集的名称
                        available_datasets = list(product_datasets.values_list('dataset', flat=True))
                        # 商品选项：所有商品（因为平台是"所有平台"）
                        available_products = list(user_datasets.values_list('product', flat=True).distinct())

                        # 应用筛选到查询
                        dataset_names = list(product_datasets.values_list('dataset', flat=True))
                        comments_query = comments_query.filter(dataset__in=dataset_names)

            # 规则3: 如果筛选了平台（且没有筛选数据集）
            elif datasource_filter and not dataset_filter:
                # 数据集不可筛选
                disabled_datasets = True

                # 如果同时筛选了商品
                if product_filter:
                    # 获取该平台+商品组合的数据集
                    product_source_datasets = Dataset.objects.filter(
                        username=user,
                        product=product_filter,
                        datasource=datasource_filter
                    )

                    if product_source_datasets.exists():
                        # 获取数据集
                        available_datasets = list(product_source_datasets.values_list('dataset', flat=True))
                        # 商品选项为当前平台下的所有商品
                        platform_datasets = Dataset.objects.filter(
                            username=user,
                            datasource=datasource_filter
                        )
                        available_products = list(platform_datasets.values_list('product', flat=True).distinct())
                        # 平台选项为当前商品下的所有平台
                        product_datasets_all = Dataset.objects.filter(
                            username=user,
                            product=product_filter
                        )
                        available_datasources = list(
                            product_datasets_all.values_list('datasource', flat=True).distinct())

                        # 应用筛选到查询
                        dataset_names = list(product_source_datasets.values_list('dataset', flat=True))
                        comments_query = comments_query.filter(dataset__in=dataset_names)
                    else:
                        # 如果不存在这样的组合，清空查询结果
                        comments_query = comments_query.none()
                        available_datasets = []
                        available_products = [product_filter]
                        available_datasources = [datasource_filter]
                else:
                    # 只筛选了平台，没有筛选商品
                    # 获取该平台的所有数据集
                    source_datasets = Dataset.objects.filter(
                        username=user,
                        datasource=datasource_filter
                    )

                    if source_datasets.exists():
                        # 获取这些数据集的商品（去重）
                        available_products = list(source_datasets.values_list('product', flat=True).distinct())
                        # 获取这些数据集的名称
                        available_datasets = list(source_datasets.values_list('dataset', flat=True))
                        # 平台选项：所有平台（因为商品是"所有商品"）
                        available_datasources = list(user_datasets.values_list('datasource', flat=True).distinct())

                        # 应用筛选到查询
                        dataset_names = list(source_datasets.values_list('dataset', flat=True))
                        comments_query = comments_query.filter(dataset__in=dataset_names)

            # 规则4: 如果商品和平台都没有筛选（或者都是"所有"），数据集可以筛选
            else:
                # 获取所有可用的选项
                available_datasets = list(user_datasets.values_list('dataset', flat=True))
                available_products = list(user_datasets.values_list('product', flat=True).distinct())
                available_datasources = list(user_datasets.values_list('datasource', flat=True).distinct())

                # 所有筛选条件都可以使用
                disabled_datasets = False
                disabled_products = False
                disabled_datasources = False

            # 搜索关键词
            if search_keyword:
                comments_query = comments_query.filter(content__icontains=search_keyword)

            # 如果只是获取筛选选项，直接返回选项数据和禁用状态
            if get_filter_options:
                return JsonResponse({
                    'success': True,
                    'available_datasets': available_datasets,
                    'available_products': available_products,
                    'available_datasources': available_datasources,
                    'disabled_datasets': disabled_datasets,
                    'disabled_products': disabled_products,
                    'disabled_datasources': disabled_datasources
                }, json_dumps_params={'ensure_ascii': False})
            if sentiment_filter and sentiment_filter != 'all':
                # 转换情感筛选值为后端存储的格式
                sentiment_map = {
                    'positive': '好评',
                    'neutral': '中评',
                    'negative': '差评'
                }
                emotype = sentiment_map.get(sentiment_filter, sentiment_filter)
                # 首先获取符合情感状态的评论ID
                sentiment_comment_ids = Sentiment.objects.filter(emotype=emotype).values_list('comment_id', flat=True)
                # 然后筛选评论
                comments_query = comments_query.filter(id__in=sentiment_comment_ids)
            
            # 统计符合条件的评论总数
            total = comments_query.count()

            # 排序
            if sort_by == 'publishtime':  # 按发布时间排序
                if sort_order == 'asc':  # 升序排序
                    comments_query = comments_query.order_by('publishtime')
                else:
                    comments_query = comments_query.order_by('-publishtime')
            else:  # 按评分排序
                if sort_order == 'asc':  # 升序排序
                    comments_query = comments_query.order_by('score', 'publishtime')
                else:
                    comments_query = comments_query.order_by('-score', '-publishtime')

            # 如果是导出请求，获取所有数据
            if is_export:
                comments = list(comments_query)
            else:
                # 分页
                start = (page - 1) * per_page
                comments = list(comments_query[start:start + per_page])

            # 构建评论数据
            comments_data = []

            # 收集所有需要用到的数据集名称
            dataset_names_needed = []
            for comment in comments:
                dataset_str = comment.dataset.dataset
                dataset_names_needed.append(dataset_str)

            # 一次性获取所有数据集信息
            dataset_info_map = {}
            if dataset_names_needed:
                from django.db.models import Q
                from functools import reduce
                import operator

                # 创建查询条件
                query_conditions = reduce(
                    operator.or_,
                    [Q(dataset=name) for name in set(dataset_names_needed)]
                )

                datasets_info = Dataset.objects.filter(
                    username=user
                ).filter(query_conditions)

                for dataset_obj in datasets_info:
                    dataset_info_map[dataset_obj.dataset] = {
                        'product': dataset_obj.product,
                        'datasource': dataset_obj.datasource
                    }

            # 收集所有评论ID
            comment_ids = [comment.id for comment in comments]
            
            # 一次性获取所有评论的情感分析结果
            sentiment_map = {}
            if comment_ids:
                sentiments = Sentiment.objects.filter(comment_id__in=comment_ids)
                for sentiment in sentiments:
                    sentiment_map[sentiment.comment_id] = sentiment.emotype
                    sentiment_map[str(sentiment.comment_id) + '_score'] = sentiment.emoscore

            for comment in comments:
                dataset_name = comment.dataset.dataset

                # 获取关联信息
                if dataset_name in dataset_info_map:
                    dataset_info = dataset_info_map[dataset_name]
                    product = dataset_info['product']
                    source = dataset_info['datasource']
                else:
                    # 如果找不到，尝试直接查询
                    try:
                        dataset_obj = Dataset.objects.get(dataset=dataset_name, username=user)
                        product = dataset_obj.product
                        source = dataset_obj.datasource
                    except:
                        product = "未知"
                        source = "未知"

                # 获取情感状态
                sentiment = sentiment_map.get(comment.id, '暂无')
                sentiment_emoscore = sentiment_map.get(str(comment.id) + '_score', '暂无')

                comments_data.append({
                    'id': comment.id,
                    'nickname': comment.nickname or "匿名用户",
                    'content': comment.content,
                    'publishtime': comment.publishtime.strftime('%Y-%m-%d') if comment.publishtime else "",
                    'score': comment.score if comment.score is not None else "暂无",
                    'dataset': dataset_name,
                    'product': product,
                    'datasource': source,
                    'sentiment': sentiment,
                    'sentimentscore': sentiment_emoscore
                })

            if is_export:
                return JsonResponse({
                    'success': True,
                    'total': total,
                    'comments': comments_data
                }, json_dumps_params={'ensure_ascii': False})
            else:
                return JsonResponse({
                    'success': True,
                    'total': total,
                    'comments': comments_data,
                    'page': page,
                    'total_pages': (total + per_page - 1) // per_page if total > 0 else 0,
                    'available_datasets': available_datasets,
                    'available_products': available_products,
                    'available_datasources': available_datasources,
                    'disabled_datasets': disabled_datasets,
                    'disabled_products': disabled_products,
                    'disabled_datasources': disabled_datasources
                }, json_dumps_params={'ensure_ascii': False})

        # 渲染页面 - 初始加载时获取所有选项
        user_datasets = Dataset.objects.filter(username=user)

        # 获取所有可用的选项
        all_datasets = list(user_datasets.values_list('dataset', flat=True))
        all_products = list(user_datasets.values_list('product', flat=True).distinct())
        all_datasources = list(user_datasets.values_list('datasource', flat=True).distinct())

        user_data = {
            'nickname': user.nickname,
            'avatar_url': f'/static/images/{user.avatar}' if user.avatar else '/static/images/avatars/default_avatar.png',
        }

        return render(request, 'search.html', {
            'user': user_data,
            'datasets': all_datasets,
            'products': all_products,
            'datasources': all_datasources
        })

    except Exception as e:
        print(f"搜索错误: {e}")
        import traceback
        traceback.print_exc()
        if request.headers.get('X-Requested-With') == 'XMLHttpRequest':
            return JsonResponse({
                'success': False,
                'error': str(e)
            }, status=500, json_dumps_params={'ensure_ascii': False})
        return HttpResponse('<script>alert("系统错误！");location.href="/dashboard/"</script>')


"""
用户设置页面，处理个人信息更新和头像上传
"""

def setting(request):
    if 'user' not in request.session:
        return HttpResponse('<script>alert("请先登录！");location.href="/login/"</script>')
    try:
        user_id = request.session['user']
        user = User.objects.get(id=user_id)

        # 如果是 POST 请求，处理表单提交
        if request.method == 'POST':
            try:
                # 获取表单数据
                nickname = request.POST.get('nickname', '').strip()
                email = request.POST.get('email', '').strip()
                phone = request.POST.get('phone', '').strip()
                current_password = request.POST.get('currentPassword', '')
                new_password = request.POST.get('newPassword', '')
                reset_avatar = request.POST.get('reset_avatar', 'false') == 'true'  # 获取重置头像标志

                # 验证必填字段
                if not all([nickname, email, phone]):
                    return JsonResponse({'success': False, 'message': '请填写所有必填项'})

                # 验证邮箱格式
                if not re.match(r'^[^\s@]+@[^\s@]+\.[^\s@]+$', email):
                    return JsonResponse({'success': False, 'message': '邮箱格式不正确'})

                # 验证手机号格式
                if not re.match(r'^1[3-9]\d{9}$', phone):
                    return JsonResponse({'success': False, 'message': '手机号格式不正确'})

                # 检查邮箱是否已被其他用户使用
                if User.objects.filter(email=email).exclude(id=user_id).exists():
                    return JsonResponse({'success': False, 'message': '邮箱已被其他用户使用'})

                # 检查手机号是否已被其他用户使用
                if User.objects.filter(phone=phone).exclude(id=user_id).exists():
                    return JsonResponse({'success': False, 'message': '手机号已被其他用户使用'})

                # 更新用户信息
                user.nickname = nickname
                user.email = email
                user.phone = phone

                # 如果提供了新密码，验证并更新密码
                if new_password:
                    if not current_password:
                        return JsonResponse({'success': False, 'message': '修改密码需要输入当前密码'})

                    # 验证当前密码
                    if not check_password(current_password, user.password):
                        return JsonResponse({'success': False, 'message': '当前密码不正确'})

                    # 验证新密码长度
                    if len(new_password) < 6:
                        return JsonResponse({'success': False, 'message': '新密码至少需要6个字符'})

                    # 更新密码
                    user.password = make_password(new_password, None, 'pbkdf2_sha256')

                # 处理头像上传
                if 'avatar' in request.FILES:
                    avatar_file = request.FILES['avatar']
                    # 验证文件类型
                    if not avatar_file.name.lower().endswith(('.png', '.jpg', '.jpeg', '.gif')):
                        return JsonResponse({'success': False, 'message': '只支持PNG、JPG、JPEG、GIF格式的图片'})

                    # 验证文件大小（限制为2MB）
                    if avatar_file.size > 2 * 1024 * 1024:
                        return JsonResponse({'success': False, 'message': '图片大小不能超过2MB'})

                    # 保存到 static/images/avatars 目录下，命名为 avatar_用户id.扩展名
                    # 获取文件扩展名
                    file_ext = os.path.splitext(avatar_file.name)[1]
                    filename = f'avatar_{user_id}{file_ext}'

                    # 确保目录存在
                    avatar_dir = os.path.join(settings.BASE_DIR, 'static', 'images', 'avatars')
                    os.makedirs(avatar_dir, exist_ok=True)

                    # 保存文件
                    avatar_path = os.path.join(avatar_dir, filename)
                    with open(avatar_path, 'wb+') as destination:
                        for chunk in avatar_file.chunks():
                            destination.write(chunk)

                    # 更新数据库中的头像路径
                    user.avatar = f'avatars/{filename}'
                elif reset_avatar:
                    # 设置默认头像
                    user.avatar = 'avatars/default_avatar.png'
                user.save()
                # 构建头像URL
                if user.avatar:
                    avatar_url = f'/static/images/{user.avatar}'
                else:
                    avatar_url = '/static/images/avatars/default_avatar.png'

                return JsonResponse({
                    'success': True,
                    'message': '个人信息更新成功',
                    'data': {
                        'nickname': user.nickname,
                        'email': user.email,
                        'phone': user.phone,
                        'avatar_url': avatar_url
                    }
                })

            except Exception as e:
                print(f"保存失败: {e}")  # 添加调试输出
                return JsonResponse({'success': False, 'message': '保存失败，请检查数据格式'})

        # 如果是 GET 请求，显示页面
        user_data = {
            'username': user.username,
            'nickname': user.nickname,
            'email': user.email,
            'phone': user.phone,
            'avatar_url': f'/static/images/{user.avatar}' if user.avatar else '/static/images/avatars/default_avatar.png',
        }

        return render(request, 'setting.html', {
            'user': user_data,
            'request': request
        })

    except User.DoesNotExist:
        if 'user' in request.session:
            del request.session['user']
        return HttpResponse('<script>alert("用户不存在！");location.href="/login/"</script>')
    except Exception as e:
        print(f"设置页面错误: {e}")
        return HttpResponse('<script>alert("系统错误！");location.href="/dashboard/"</script>')


"""
数据获取页面，处理评论数据的抓取
"""

def acquisition(request):
    if 'user' not in request.session:
        return HttpResponse('<script>alert("请先登录！");location.href="/login/"</script>')
    try:
        user_id = request.session['user']
        user = User.objects.get(id=user_id)
        user_data = {
            'nickname': user.nickname,
            'avatar_url': f'/static/images/{user.avatar}' if user.avatar else '/static/images/avatars/default_avatar.png',
        }
        # 处理 POST 请求 - 开始数据获取
        if request.method == 'POST':
            try:
                # 获取表单数据
                datasource = request.POST.get('datasource')
                dataset_name = request.POST.get('dataset')
                product_name = request.POST.get('product')
                product_url = request.POST.get('productUrl')
                max_pages = int(request.POST.get('maxPages'))
                # 检查数据集是否已存在
                if Dataset.objects.filter(dataset=dataset_name, username=user).exists():
                    return JsonResponse({
                        'success': False,
                        'error': '数据集名称已存在，请使用其他名称'
                    })
                # 创建新数据集记录
                dataset_obj = Dataset.objects.create(
                    dataset=dataset_name,
                    product=product_name,
                    creationtime=datetime.now(),
                    datasource=datasource,
                    username=user
                )
                dataset_obj.save()
                sys.path.append(os.path.join(settings.BASE_DIR, 'spiders', 'spider'))

                # 启动后台线程进行数据获取
                def crawl_task():
                    try:
                        from spiders.tosql import save_to_csv, csv_to_sql
                        if datasource == '京东':
                            from spiders.spider.jd import jd_getdata
                            # 调用京东函数
                            rows = jd_getdata(product_url, dataset_name, max_pages)
                            # 保存到CSV
                            count = save_to_csv(rows)
                            if count > 0:
                                csv_to_sql()
                            else:
                                raise Exception("未获取到任何评论数据")
                            print(f"一共{count}条评论数据")
                        elif datasource == '淘宝':
                            from spiders.spider.taobao import taobao_getdata
                            # 调用淘宝函数
                            rows = taobao_getdata(product_url, dataset_name, max_pages)
                            # 保存到CSV
                            count = save_to_csv(rows)
                            if count > 0:
                                csv_to_sql()
                            else:
                                raise Exception("未获取到任何评论数据")
                            print(f"一共{count}条评论数据")
                        elif datasource == '拼多多':
                            from spiders.spider.pdd import pdd_getdata
                            # 调用拼多多函数
                            rows = pdd_getdata(product_url, dataset_name, max_pages)
                            # 保存到CSV
                            count = save_to_csv(rows)
                            if count > 0:
                                csv_to_sql()
                            else:
                                raise Exception("未获取到任何评论数据")
                            print(f"一共{count}条评论数据")
                    except:
                        print("获取数据失败！")
                        dataset_obj.delete()
                        return JsonResponse({
                            'success': False,
                            'error': '获取失败！'
                        })

                # 启动线程
                thread = threading.Thread(target=crawl_task)
                thread.daemon = True
                thread.start()
                return JsonResponse({
                    'success': True,
                    'message': '数据获取任务结束',
                })
            except Exception as e:
                return JsonResponse({
                    'success': False,
                    'error': f'获取失败: {str(e)}'
                })
        elif request.method == 'GET' and 'dataset_name' in request.GET:
            try:
                dataset_name = request.GET.get('dataset_name')
                dataset_obj = Dataset.objects.get(dataset=dataset_name, username=user)
                comments_count = Comment.objects.filter(dataset=dataset_obj).count()
                return JsonResponse({
                    'success': True,
                    'total_comments': comments_count,
                })
            except Dataset.DoesNotExist:
                return JsonResponse({
                    'success': False,
                    'error': '数据集不存在'
                })
        return render(request, 'dataset/acquisition.html', {
            'user': user_data,
            'request': request
        })
    except User.DoesNotExist:
        if 'user' in request.session:
            del request.session['user']
        return HttpResponse('<script>alert("用户不存在！");location.href="/login/"</script>')


"""
数据管理页面，处理数据集的获取、更新和删除
"""

def management(request):
    if 'user' not in request.session:
        return HttpResponse('<script>alert("请先登录！");location.href="/login/"</script>')
    try:
        user_id = request.session['user']
        user = User.objects.get(id=user_id)
        # 处理数据集操作
        if request.method == 'POST':
            action = request.POST.get('action')
            if action == 'get_datasets':
                # 获取用户的所有数据集
                datasets = Dataset.objects.filter(username=user).order_by('-creationtime')
                datasets_list = []
                for dataset in datasets:
                    # 获取每个数据集的评论数量
                    comments_count = Comment.objects.filter(dataset=dataset).count()
                    datasets_list.append({
                        'id': dataset.id,
                        'dataset': dataset.dataset,
                        'product': dataset.product,
                        'creationtime': dataset.creationtime.strftime('%Y-%m-%d %H:%M:%S'),
                        'datasource': dataset.datasource,
                        'comments_count': comments_count
                    })
                return JsonResponse({
                    'success': True,
                    'datasets': datasets_list
                })
            elif action == 'update':
                # 更新数据集
                dataset_id = request.POST.get('id')
                new_dataset_name = request.POST.get('dataset')
                new_product_name = request.POST.get('product')
                try:
                    dataset = Dataset.objects.get(id=dataset_id, username=user)
                    old_dataset_name = dataset.dataset
                    old_product_name = dataset.product
                    if old_dataset_name == new_dataset_name and old_product_name == new_product_name:
                        return JsonResponse({
                            'success': False,
                            'message': '数据集名称和商品名称未修改'
                        })
                    if old_dataset_name == new_dataset_name and old_product_name != new_product_name:
                        # 仅更新商品名称
                        dataset.product = new_product_name
                        dataset.save()
                        return JsonResponse({
                            'success': True,
                            'message': '更新成功'
                        })
                    if old_dataset_name != new_dataset_name:
                        # 检查新数据集名称是否重复（同一用户内不能重复）
                        if Dataset.objects.filter(username=user, dataset=new_dataset_name).exclude(
                                id=dataset_id).exists():
                            return JsonResponse({
                                'success': False,
                                'message': '数据集名称已存在，请使用其他名称'
                            })
                    with transaction.atomic():
                        if old_dataset_name != new_dataset_name:  # 如果数据集名称改变，更新所有相关评论的dataset字段
                            if old_dataset_name.lower() == new_dataset_name.lower():  # 数据集名称小写相同，不更新
                                return JsonResponse({
                                    'success': False,
                                    'message': '数据集名称不区分大小写'
                                })
                            # 创建新的数据集对象
                            new_dataset = Dataset.objects.create(
                                dataset=new_dataset_name,
                                product=new_product_name,
                                creationtime=dataset.creationtime,
                                datasource=dataset.datasource,
                                username=user
                            )
                            new_dataset.save()
                            # 获取所有相关评论
                            comments = Comment.objects.filter(dataset=dataset)
                            # 批量更新评论的 dataset 字段值
                            comments.update(dataset=new_dataset_name)
                            dataset.delete()
                    return JsonResponse({
                        'success': True,
                        'message': '更新成功'
                    })
                except Dataset.DoesNotExist:
                    return JsonResponse({
                        'success': False,
                        'message': '数据集不存在'
                    })
            elif action == 'delete':
                # 删除数据集
                dataset_id = request.POST.get('id')
                try:
                    dataset = Dataset.objects.get(id=dataset_id, username=user)
                    dataset_name = dataset.dataset
                    # 删除数据集（级联删除评论）
                    dataset.delete()
                    return JsonResponse({
                        'success': True,
                        'message': f'数据集 "{dataset_name}" 已删除'
                    })
                except Dataset.DoesNotExist:
                    return JsonResponse({
                        'success': False,
                        'message': '数据集不存在'
                    })
        user_data = {
            'nickname': user.nickname,
            'avatar_url': f'/static/images/{user.avatar}' if user.avatar else '/static/images/avatars/default_avatar.png',
        }
        return render(request, 'dataset/management.html', {
            'user': user_data,
            'request': request
        })
    except User.DoesNotExist:
        if 'user' in request.session:
            del request.session['user']
        return HttpResponse('<script>alert("用户不存在！");location.href="/login/"</script>')


"""
情感分析页面，处理评论数据的情感分析和结果展示
"""

def emotion(request):
    if 'user' not in request.session:
        return HttpResponse('<script>alert("请先登录！");location.href="/login/"</script>')
    try:
        user_id = request.session['user']
        user = User.objects.get(id=user_id)
        user_data = {
            'nickname': user.nickname,
            'avatar_url': f'/static/images/{user.avatar}' if user.avatar else '/static/images/avatars/default_avatar.png',
        }
    except User.DoesNotExist:
        return HttpResponse('<script>alert("用户不存在！");location.href="/login/"</script>')

    if request.method == 'GET':
        # 加载当前用户的数据集供选择
        datasets = Dataset.objects.filter(username=user)
        return render(request, 'analysis/emotion.html', {
            'user': user_data,
            'datasets': datasets,
            'request': request
        })
    elif request.method == 'POST':
        data = json.loads(request.body)
        dataset_name = data.get('dataset_name')
        try:
            target_ds = Dataset.objects.get(dataset=dataset_name, username=user)
            # 1. 如果没分析过，运行模型脚本
            if target_ds.hassentiment == 0:
                try:
                    # 添加BERT模型路径到系统路径
                    sys.path.append(os.path.join(settings.BASE_DIR, 'bert'))
                    from bert.emotion import run_emotion
                    from bert.opinion import run_opinion

                    # 运行情感分析和观点提取
                    emotion_success = run_emotion(dataset_name)
                    opinion_success = run_opinion(dataset_name)
                    if emotion_success and opinion_success:
                        target_ds.hassentiment = 1
                        target_ds.save()
                    else:
                        raise Exception("情感分析失败")
                except Exception as e:
                    return JsonResponse({'status': 'error', 'msg': f'分析脚本执行失败: {str(e)}'})
            # 2. 从数据库提取分析结果进行统计
            # 第一步：找到该数据集下的所有评论 ID
            comment_ids = Comment.objects.filter(dataset=dataset_name).values_list('id', flat=True)
            # 第二步：根据评论 ID 找到对应的情感分析结果
            sentiments = Sentiment.objects.filter(comment_id__in=comment_ids)
            if not sentiments.exists():
                return JsonResponse({'status': 'error', 'msg': '该数据集下暂无情感分析结果。'})
            # A. 饼图数据 (emotype)
            pie_counts = sentiments.values('emotype').annotate(count=Count('id'))
            pie_data = [{'emotype': item['emotype'], 'count': item['count']} for item in pie_counts]
            # B. 折线图数据 (emoscore)
            bins = []
            for i in range(-15, 17):  # -3.0 到 3.0，共31个区间
                bins.append(i * 0.2)
            # 初始化每个区间的计数
            bin_counts = [0] * (len(bins) - 1)
            # 统计每个区间的评论数
            for sentiment in sentiments:
                emoscore = float(sentiment.emoscore) if sentiment.emoscore is not None else 0.0
                # 将情感权重分配到对应的区间
                for i in range(len(bins) - 1):
                    if bins[i] <= emoscore < bins[i + 1]:
                        bin_counts[i] += 1
                        break
                    # 处理正好等于3.0的情况
                    elif emoscore == 3.0:
                        bin_counts[i] += 1
            # 构建横轴标签和纵轴数据
            line_data = []
            for i in range(len(bin_counts)):
                # 区间中点作为横坐标
                x_value = bins[i]
                line_data.append({
                    'bin': round(x_value, 2),  # 区间中点
                    'count': bin_counts[i]  # 该区间的评论数
                })
            # C. 观点词词云与高频词统计 (opinion)
            all_opinions = []
            opinion_scores = {}
            for s in sentiments:
                if s.opinion and s.opinion != '暂无':
                    # 假设多个词以逗号分隔
                    words = [w.strip() for w in s.opinion.replace('，', ',').split(',') if w.strip()]
                    all_opinions.extend(words)
                    # 记录每个观点词对应的情感权重
                    for word in words:
                        if word not in opinion_scores:
                            opinion_scores[word] = []
                        opinion_scores[word].append(s.emoscore)
            word_counts = Counter(all_opinions)
            # 过滤出现次数 > 1 的高频观点词用于柱状图
            high_freq_data = {k: v for k, v in word_counts.items() if v > 1}
            # 排序取前 15 个，避免图表过挤
            sorted_high_freq = dict(sorted(high_freq_data.items(), key=lambda x: x[1], reverse=True)[:15])
            # D. 展示指标
            total = sentiments.count()
            good_count = sentiments.filter(emotype='好评').count()
            good_rate = round((good_count / total * 100), 2) if total > 0 else 0
            best_word = "暂无"
            worst_word = "暂无"
            if opinion_scores:
                # 计算每个观点词的平均情感权重
                word_avg_scores = {}
                for word, scores in opinion_scores.items():
                    if scores:
                        word_avg_scores[word] = sum(scores) / len(scores)
                # 核心优势：平均情感权重最高的观点词（正数）
                positive_words = {k: v for k, v in word_avg_scores.items() if v > 0}
                if positive_words:
                    best_word = max(positive_words.items(), key=lambda x: x[1])[0]
                # 主要痛点：平均情感权重最低的观点词（负数）
                negative_words = {k: v for k, v in word_avg_scores.items() if v < 0}
                if negative_words:
                    worst_word = min(negative_words.items(), key=lambda x: x[1])[0]
            return JsonResponse({
                'status': 'success',
                'pie_data': pie_data,  # 情感类型分布饼图数据
                'line_data': line_data,  # 情感强度分布折线图数据
                'word_cloud': [{'name': k, 'value': v} for k, v in word_counts.items()],  # 词云数据
                'high_freq': sorted_high_freq,  # 高频观点词数据
                'metrics': {
                    'total_comments': total,  # 总评论数
                    'good_rate': good_rate,  # 好评率
                    'best_word': best_word,  # 核心优势词
                    'worst_word': worst_word,  # 主要痛点词
                }
            })
        except Dataset.DoesNotExist:
            return JsonResponse({'status': 'error', 'msg': '找不到指定的数据集'})
        except Exception as e:
            return JsonResponse({'status': 'error', 'msg': f'系统错误: {str(e)}'})
    else:
        return JsonResponse({'status': 'error', 'msg': '请求错误'})


"""
主题词分析页面，使用LDA模型提取评论数据中的主题词
"""

def keywords(request):
    if 'user' not in request.session:
        return HttpResponse('<script>alert("请先登录！");location.href="/login/"</script>')
    try:
        user_id = request.session['user']
        user = User.objects.get(id=user_id)
        user_data = {
            'nickname': user.nickname,
            'avatar_url': f'/static/images/{user.avatar}' if user.avatar else '/static/images/avatars/default_avatar.png',
        }
    except User.DoesNotExist:
        if 'user' in request.session:
            del request.session['user']
        return HttpResponse('<script>alert("用户不存在！");location.href="/login/"</script>')

    if request.method == 'GET':
        # 加载当前用户的数据集供选择
        datasets = Dataset.objects.filter(username=user)
        return render(request, 'analysis/keywords.html', {
            'user': user_data,
            'datasets': datasets,
            'request': request
        })
    elif request.method == 'POST':
        data = json.loads(request.body)
        dataset_name = data.get('dataset_name')
        num_topics = data.get('num_topics', 5)  # 主题数量，默认为5
        top_n = data.get('top_n', 50)  # 每个主题的关键词数量，默认为50

        try:
            # 验证数据集是否属于当前用户
            Dataset.objects.get(dataset=dataset_name, username=user)
            
            # 导入LDA模型
            sys.path.append(os.path.join(settings.BASE_DIR, 'lda'))
            from lda.lda_main import LDA, simple_segment, load_stopwords, guess_pos

            # 加载停用词表
            STOP_WORDS = load_stopwords()

            # 获取数据集中的所有评论
            comments = Comment.objects.filter(dataset=dataset_name)
            if not comments.exists():
                return JsonResponse({'status': 'error', 'msg': '该数据集下暂无评论数据'})

            total_comments = comments.count()

            # 准备语料库
            corpus = []
            for comment in comments:
                if comment.content:
                    # 对评论内容进行分词
                    words = simple_segment(comment.content)
                    # 过滤停用词和长度小于等于1的词
                    words = [w for w in words if w not in STOP_WORDS and len(w) > 1]
                    if words:
                        corpus.append(words)

            if not corpus:
                return JsonResponse({'status': 'error', 'msg': '未能提取到有效词汇，请检查数据'})

            # 训练LDA模型
            lda = LDA(num_topics=int(num_topics), iterations=100)
            lda.fit(corpus)
            # 获取每个主题的关键词
            topics = lda.get_topic_words(top_n=top_n)

            # 构建主题分布数据
            topic_distribution = []
            for topic in topics:
                topic_distribution.append({
                    'topic_id': topic['topic_id'],
                    'weight': topic['weight']  # 主题权重
                })

            # 构建关键词列表并统计真实词频
            all_keywords = []
            seen_words = set()
            # 统计真实词频
            word_freq_counter = Counter()
            for comment in comments:
                if comment.content:
                    words = simple_segment(comment.content)
                    words = [w for w in words if w not in STOP_WORDS and len(w) > 1]
                    word_freq_counter.update(words)
            
            # 计算总词频
            total_word_count = sum(word_freq_counter.values())

            # 构建词云数据
            word_cloud = []
            for topic in topics:
                for keyword in topic['keywords']:
                    real_freq = word_freq_counter.get(keyword['word'], 0)
                    word_cloud.append({
                        'word': keyword['word'],
                        'weight': keyword['weight'],
                        'freq': real_freq,  # 使用真实词频
                        'topic': topic['topic_id']
                    })
            
            # 构建关键词列表
            for topic in topics:
                for keyword in topic['keywords']:
                    if keyword['word'] not in seen_words:
                        seen_words.add(keyword['word'])
                        real_freq = word_freq_counter.get(keyword['word'], 0)
                        percentage = round((real_freq / total_word_count * 100) if total_word_count > 0 else 0, 2)
                        all_keywords.append({
                            'word': keyword['word'],
                            'freq': real_freq,  # 真实词频
                            'score': keyword['weight'],  # 主题权重
                            'pos': guess_pos(keyword['word']),  # 词性
                            'percentage': percentage  # 词频占比
                        })

            # 按权重排序
            all_keywords.sort(key=lambda x: x['score'], reverse=True)

            # 计算统计数据
            total_keywords = len(all_keywords)
            top_keyword = all_keywords[0]['word'] if all_keywords else '--'
            avg_freq = round(sum(k['freq'] for k in all_keywords) / total_keywords, 2) if total_keywords > 0 else 0
            
            # 生成最近7天的日期
            dates = []
            for i in range(6, -1, -1):
                date = datetime.now() - timedelta(days=i)
                dates.append(date.strftime('%m-%d'))

            # 为每个主题生成趋势数据
            topic_trend = {
                'labels': dates,
                'datasets': []
            }

            for topic in topics:
                data = []
                base_weight = topic['weight']
                for _ in range(7):
                    # 添加随机波动
                    variation = random.uniform(0.8, 1.2)
                    data.append(base_weight * variation)
                
                topic_trend['datasets'].append({
                    'topic_id': topic['topic_id'],
                    'data': data
                })

            return JsonResponse({
                'status': 'success',
                'metrics': {
                    'total_comments': total_comments,  # 总评论数
                    'total_keywords': total_keywords,  # 关键词总数
                    'top_keyword': top_keyword,  # 权重最高的关键词
                    'avg_freq': avg_freq  # 平均词频
                },
                'keywords': all_keywords,  # 关键词列表
                'topics': topics,  # 主题及其关键词
                'topic_distribution': topic_distribution,  # 主题分布
                'topic_trend': topic_trend,  # 主题趋势
                'word_cloud': word_cloud  # 词云数据
            })

        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'status': 'error', 'msg': f'分析失败: {str(e)}'})
    else:
        return JsonResponse({'status': 'error', 'msg': '请求方式错误'})


"""
多平台竞品分析页面，处理多平台和多产品的对比分析
"""

def competing(request):
    if 'user' not in request.session:
        return HttpResponse('<script>alert("请先登录！");location.href="/login/"</script>')
    try:
        user_id = request.session['user']
        user = User.objects.get(id=user_id)
        user_data = {
            'nickname': user.nickname,
            'avatar_url': f'/static/images/{user.avatar}' if user.avatar else '/static/images/avatars/default_avatar.png',
        }
        
        # 获取hassentiment=1的产品列表（去重）
        products = Dataset.objects.filter(hassentiment=1, username=user).values_list('product', flat=True).distinct()
        
        # 获取hassentiment=1的数据集列表
        datasets = Dataset.objects.filter(hassentiment=1, username=user)
        
        # 处理分析请求
        if request.method == 'POST':
            analysis_type = request.POST.get('analysis_type')
            
            if analysis_type == 'platform':
                # 多平台分析
                product = request.POST.get('product')
                # 获取该商品的所有数据集
                product_datasets = Dataset.objects.filter(product=product, hassentiment=1, username=user)
                
                # 计算每个平台的好评率和词云数据
                platform_data = {
                    'platforms': [],
                    'goodRates': [],
                    'commentCounts': [],
                    'monthlyGoodCounts': {},
                    'goodWords': {},
                    'badWords': {},
                    'suggestions': []
                }
                
                for ds in product_datasets:
                    platform = ds.datasource
                    platform_data['platforms'].append(platform)
                    
                    # 计算好评率
                    comments = Comment.objects.filter(dataset=ds.dataset)
                    total_comments = comments.count()
                    good_comments = 0
                    good_words = []
                    bad_words = []
                    
                    for comment in comments:
                        sentiments = Sentiment.objects.filter(comment=comment)
                        if sentiments.exists():
                            positive = False
                            for sentiment in sentiments:
                                if sentiment.emotype == '好评' or (sentiment.emoscore and sentiment.emoscore > 0.5):
                                    positive = True
                                    if sentiment.opinion and sentiment.opinion != '暂无':
                                        good_words.append(sentiment.opinion)
                                else:
                                    if sentiment.opinion and sentiment.opinion != '暂无':
                                        bad_words.append(sentiment.opinion)
                            if positive:
                                good_comments += 1
                    
                    # 计算好评率
                    good_rate = (good_comments / total_comments * 100) if total_comments > 0 else 0
                    platform_data['goodRates'].append(round(good_rate, 2))
                    platform_data['commentCounts'].append(total_comments)
                    
                    # 统计词频
                    from collections import Counter
                    good_word_counts = Counter(good_words)
                    bad_word_counts = Counter(bad_words)
                    
                    # 取前40个高频词
                    platform_data['goodWords'][platform] = [(word, count) for word, count in good_word_counts.most_common(40)]
                    platform_data['badWords'][platform] = [(word, count) for word, count in bad_word_counts.most_common(40)]
                    
                    # 分析该平台的优势词汇（好评词）
                    top_good_words = [word for word, _ in good_word_counts.most_common(3)]
                    
                    # 分析该平台的劣势词汇（差评词）
                    top_bad_words = [word for word, _ in bad_word_counts.most_common(3)]
                    
                    # 生成具体的改进建议
                    suggestion_content = f'当前平台好评率为{round(good_rate, 2)}%。'
                    
                    if top_bad_words:
                        suggestion_content += f'主要问题点：{"、".join(top_bad_words)}。'
                    
                    if top_good_words:
                        suggestion_content += f'优势方面：{"、".join(top_good_words)}。'
                    
                    if good_rate < 70:
                        suggestion_content += '建议重点优化产品质量和服务体验，提高用户满意度。'
                    elif good_rate < 85:
                        suggestion_content += '建议进一步优化用户体验，提升服务质量，提高好评率。'
                    else:
                        suggestion_content += '建议保持现有优势，持续创新，维持市场竞争力。'
                    
                    # 生成改进建议
                    suggestion = {
                        'title': f'{platform}改进建议',
                        'content': suggestion_content,
                        'priority': 'high' if good_rate < 70 else 'medium' if good_rate < 85 else 'low'
                    }
                    platform_data['suggestions'].append(suggestion)
                    
                    # 计算近12个月的好评数
                    from datetime import timedelta
                    from django.utils import timezone
                    monthly_good_counts = {}
                    today = timezone.now()
                    
                    # 生成近12个月的月份标签
                    for i in range(11, -1, -1):
                        month_date = today - timedelta(days=i*30)
                        month_key = month_date.strftime('%Y-%m')
                        
                        # 筛选该月份的评论
                        month_start = month_date.replace(day=1)
                        if month_start.month == 12:
                            month_end = month_start.replace(year=month_start.year + 1, month=1)
                        else:
                            month_end = month_start.replace(month=month_start.month + 1)
                        
                        month_comments = comments.filter(publishtime__gte=month_start, publishtime__lt=month_end)
                        month_good = 0
                        
                        for comment in month_comments:
                            sentiments = Sentiment.objects.filter(comment=comment)
                            if sentiments.exists():
                                for sentiment in sentiments:
                                    if sentiment.emotype == '好评' or (sentiment.emoscore and sentiment.emoscore > 0.5):
                                        month_good += 1
                                        break
                        
                        # 存储该月好评数
                        monthly_good_counts[month_key] = month_good
                    
                    platform_data['monthlyGoodCounts'][platform] = monthly_good_counts
                
                return JsonResponse(platform_data)
                
            elif analysis_type == 'competitive':
                # 竞品分析
                selected_datasets = request.POST.getlist('datasets[]')
                if len(selected_datasets) < 2 or len(selected_datasets) > 4:
                    return JsonResponse({'error': '请选择2-4个数据集'})
                
                # 检查商品是否存在重复
                products = []
                for dataset_name in selected_datasets:
                    try:
                        ds = Dataset.objects.get(dataset=dataset_name, hassentiment=1, username=user)
                        products.append(ds.product)
                    except Dataset.DoesNotExist:
                        return JsonResponse({'error': f'数据集 {dataset_name} 不存在'})
                
                if len(products) != len(set(products)):
                    return JsonResponse({'error': '商品存在相同'})
                
                # 计算每个数据集的好评率和词云数据
                competitive_data = {
                    'products': selected_datasets,
                    'goodRates': [],
                    'goodWords': {},
                    'badWords': {},
                    'suggestions': []
                }
                
                for dataset_name in selected_datasets:
                    try:
                        ds = Dataset.objects.get(dataset=dataset_name, hassentiment=1, username=user)
                        
                        # 计算好评率
                        comments = Comment.objects.filter(dataset=dataset_name)
                        total_comments = comments.count()
                        good_comments = 0
                        good_words = []
                        bad_words = []
                        
                        for comment in comments:
                            sentiments = Sentiment.objects.filter(comment=comment)
                            if sentiments.exists():
                                positive = False
                                for sentiment in sentiments:
                                    if sentiment.emotype == '好评' or (sentiment.emoscore and sentiment.emoscore > 0.5):
                                        positive = True
                                        if sentiment.opinion and sentiment.opinion != '暂无':
                                            good_words.append(sentiment.opinion)
                                    else:
                                        if sentiment.opinion and sentiment.opinion != '暂无':
                                            bad_words.append(sentiment.opinion)
                                if positive:
                                    good_comments += 1
                        
                        # 计算好评率
                        good_rate = (good_comments / total_comments * 100) if total_comments > 0 else 0
                        competitive_data['goodRates'].append(round(good_rate, 2))
                        
                        # 统计词频
                        from collections import Counter
                        good_word_counts = Counter(good_words)
                        bad_word_counts = Counter(bad_words)
                        
                        # 取前50个高频词
                        competitive_data['goodWords'][dataset_name] = [(word, count) for word, count in good_word_counts.most_common(50)]
                        competitive_data['badWords'][dataset_name] = [(word, count) for word, count in bad_word_counts.most_common(50)]
                    except Dataset.DoesNotExist:
                        pass
                
                # 生成改进建议（针对每个商品）
                if selected_datasets and len(selected_datasets) > 0:
                    # 计算平均好评率
                    avg_good_rate = sum(competitive_data['goodRates']) / len(competitive_data['goodRates']) if competitive_data['goodRates'] else 0
                    
                    # 为每个商品生成改进建议
                    for i, dataset_name in enumerate(selected_datasets):
                        good_rate = competitive_data['goodRates'][i] if i < len(competitive_data['goodRates']) else 0
                        
                        # 分析该商品的优势词汇（好评词）
                        good_words = competitive_data['goodWords'].get(dataset_name, [])
                        top_good_words = [word for word, _ in good_words[:3]]
                        
                        # 分析该商品的劣势词汇（差评词）
                        bad_words = competitive_data['badWords'].get(dataset_name, [])
                        top_bad_words = [word for word, _ in bad_words[:3]]
                        
                        # 找出表现最好的竞品
                        best_index = competitive_data['goodRates'].index(max(competitive_data['goodRates'])) if competitive_data['goodRates'] else 0
                        best_dataset = selected_datasets[best_index] if best_index < len(selected_datasets) else dataset_name
                        best_good_rate = competitive_data['goodRates'][best_index] if best_index < len(competitive_data['goodRates']) else 0
                        
                        # 生成具体的改进建议
                        suggestion_content = f'与竞品相比，当前好评率为{good_rate}%，平均好评率为{round(avg_good_rate, 2)}%，最佳竞品{best_dataset}好评率为{best_good_rate}%。'
                        
                        if top_bad_words:
                            suggestion_content += f'主要问题点：{"、".join(top_bad_words)}。'
                        
                        if top_good_words:
                            suggestion_content += f'优势方面：{"、".join(top_good_words)}。'
                        
                        if good_rate < avg_good_rate:
                            suggestion_content += '建议重点优化产品质量和服务体验，参考表现较好的竞品，提高用户满意度。'
                        else:
                            suggestion_content += '建议保持现有优势，进一步提升用户体验，扩大市场份额。'
                        
                        suggestion = {
                            'title': f'{dataset_name}改进建议',
                            'content': suggestion_content,
                            'priority': 'high' if good_rate < avg_good_rate - 5 else 'medium' if good_rate < avg_good_rate else 'low'
                        }
                        competitive_data['suggestions'].append(suggestion)
                        
                        # 生成基于竞品对比的具体建议
                        if len(selected_datasets) > 1:
                            competitive_analysis = f'与竞品对比分析：'
                            for j, other_dataset in enumerate(selected_datasets):
                                if j != i:
                                    other_good_rate = competitive_data['goodRates'][j] if j < len(competitive_data['goodRates']) else 0
                                    rate_diff = other_good_rate - good_rate
                                    if rate_diff > 5:
                                        competitive_analysis += f'{other_dataset}好评率高出{round(rate_diff, 2)}个百分点，建议参考其优势。'
                                    elif rate_diff < -5:
                                        competitive_analysis += f'相比{other_dataset}有{round(abs(rate_diff), 2)}个百分点的优势，建议保持。'
                            
                            if competitive_analysis != '与竞品对比分析：':
                                suggestion3 = {
                                    'title': f'{dataset_name}竞品对比建议',
                                    'content': competitive_analysis,
                                    'priority': 'medium'
                                }
                                competitive_data['suggestions'].append(suggestion3)
                
                return JsonResponse(competitive_data)
        
        return render(request, 'analysis/competing.html', {
            'user': user_data,
            'products': products,
            'datasets': datasets,
            'request': request
        })
    except User.DoesNotExist:
        if 'user' in request.session:
            del request.session['user']
        return HttpResponse('<script>alert("用户不存在！");location.href="/login/"</script>')
