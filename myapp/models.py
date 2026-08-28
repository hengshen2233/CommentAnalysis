from django.db import models


class User(models.Model):  # 创建用户表
    username = models.CharField(max_length=50, unique=True, verbose_name='用户名')
    password = models.CharField(max_length=250, verbose_name='密码')
    nickname = models.CharField(max_length=50, verbose_name='昵称')
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True, verbose_name='头像',
                               default='avatars/default_avatar.png')
    email = models.EmailField(max_length=100, unique=True, verbose_name='邮箱')
    phone = models.CharField(max_length=15, verbose_name='电话')
    registtime = models.DateTimeField(verbose_name='注册时间')
    usertype = models.CharField(max_length=20, choices=[('normal', '普通用户'), ('admin', '管理员')], default='normal',
                                verbose_name='用户类型')

    def __str__(self):
        return self.username

    class Meta:
        db_table = 'myapp_user'
        verbose_name = verbose_name_plural = "用户表"


class Dataset(models.Model):  # 创建数据集表
    dataset = models.CharField(max_length=200, unique=True, verbose_name="数据集名称")
    product = models.CharField(max_length=200, verbose_name="商品名称")
    creationtime = models.DateTimeField(verbose_name="创建时间")
    hassentiment = models.BooleanField(verbose_name="是否有情感分析", default=False)
    datasource = models.CharField(max_length=50, verbose_name="数据来源")
    username = models.ForeignKey(User, to_field='username', db_column='username', on_delete=models.CASCADE,
                                 verbose_name="用户名")

    def __str__(self):
        return f"{self.dataset} - {self.product}"

    class Meta:
        db_table = 'myapp_dataset'
        verbose_name = verbose_name_plural = '数据集表'


class Comment(models.Model):  # 创建评论表
    nickname = models.CharField(max_length=100, null=True, blank=True, verbose_name="用户昵称")
    content = models.TextField(verbose_name="评论内容")
    publishtime = models.DateTimeField(verbose_name="发布时间")
    score = models.IntegerField(null=True, blank=True, verbose_name="评分")
    dataset = models.ForeignKey(Dataset, to_field='dataset', db_column='dataset', on_delete=models.CASCADE,
                                verbose_name="数据集名称")

    def __str__(self):
        return f"{self.dataset.product} - {self.nickname}"

    class Meta:
        db_table = 'myapp_comment'
        verbose_name = verbose_name_plural = '评论表'


class Sentiment(models.Model):  # 创建情感分析表
    emotype = models.CharField(max_length=50, null=True, blank=True, verbose_name='情感类别', default='暂无')
    emoscore = models.FloatField(null=True, blank=True, verbose_name='情感权重', default=0)
    opinion = models.CharField(max_length=100, null=True, blank=True, verbose_name='观点词', default='暂无')
    comment = models.ForeignKey(Comment, on_delete=models.CASCADE, db_column='comment_id', verbose_name='评论id')

    def __str__(self):
        return f"{self.emotype}"

    class Meta:
        db_table = 'myapp_sentiment'
        verbose_name = verbose_name_plural = "情感分析表"
