from myapp import views
from django.urls import path

urlpatterns = [
    path('', views.login, name='login'),  # 登录
    path('login/', views.login, name='login'),  # 登录
    path('register/', views.register, name='register'),  # 注册
    path('logout/', views.logout, name='logout'),  # 登出
    path('dashboard/', views.dashboard, name='dashboard'),  # 数据总览
    path('search/', views.search, name='search'),  # 评论管理
    path('setting/', views.setting, name='setting'),  # 设置
    path('acquisition/', views.acquisition, name='acquisition'),  # 数据采集
    path('management/', views.management, name='management'),  # 数据管理
    path('emotion/', views.emotion, name='emotion'),  # 情感分析
    path('keywords/', views.keywords, name='keywords'),  # 主题词分析
    path('competing/', views.competing, name='competing'),  # 多平台竞品分析
]
