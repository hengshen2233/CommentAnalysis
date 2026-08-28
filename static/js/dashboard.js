/**
 * dashboard.js - 仪表盘页面功能
 * 包含图表初始化、数据处理和商品筛选功能
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function () {
    // 初始化所有图表
    initCharts();
    
    // 初始化商品筛选功能
    initProductFilter();
    
    // 初始化数字动画效果
    initNumberAnimations();
});

/**
 * 初始化所有图表
 */
function initCharts() {
    // 初始化近12个月评论情感分析图表（柱状图）
    initMonthlySentimentChart();
    
    // 初始化近12个月评论情感涨幅图表（折线图）
    initSentimentGrowthChart();
    
    // 初始化评论评分分布图表（饼图）
    initScoreDistributionChart();
}

/**
 * 初始化近12个月评论情感分析图表
 */
function initMonthlySentimentChart() {
    const monthlyCtx = document.getElementById('monthlySentimentChart').getContext('2d');
    
    // 创建柱状图
    window.monthlyChart = new Chart(monthlyCtx, {
        type: 'bar',
        data: {
            labels: month_labels, // 月份标签
            datasets: [
                {
                    label: '好评',
                    data: positive_data, // 好评数据
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1
                },
                {
                    label: '中评',
                    data: neutral_data, // 中评数据
                    backgroundColor: 'rgba(255, 206, 86, 0.6)',
                    borderColor: 'rgba(255, 206, 86, 1)',
                    borderWidth: 1
                },
                {
                    label: '差评',
                    data: negative_data, // 差评数据
                    backgroundColor: 'rgba(255, 99, 132, 0.6)',
                    borderColor: 'rgba(255, 99, 132, 1)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: '评论数量',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '月份',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

/**
 * 初始化近12个月评论情感涨幅图表
 */
function initSentimentGrowthChart() {
    const scoreCtx = document.getElementById('scoreDistributionChart').getContext('2d');
    
    // 计算各情感类型的涨幅
    const positiveGrowth = calculateGrowthRate(positive_data);
    const neutralGrowth = calculateGrowthRate(neutral_data);
    const negativeGrowth = calculateGrowthRate(negative_data);
    
    // 创建折线图
    window.scoreChart = new Chart(scoreCtx, {
        type: 'line',
        data: {
            labels: month_labels, // 月份标签
            datasets: [
                {
                    label: '好评涨幅',
                    data: positiveGrowth,
                    borderColor: 'rgba(75, 192, 192, 1)',
                    backgroundColor: 'rgba(75, 192, 192, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: '中评涨幅',
                    data: neutralGrowth,
                    borderColor: 'rgba(255, 206, 86, 1)',
                    backgroundColor: 'rgba(255, 206, 86, 0.1)',
                    tension: 0.3,
                    fill: true
                },
                {
                    label: '差评涨幅',
                    data: negativeGrowth,
                    borderColor: 'rgba(255, 99, 132, 1)',
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    tension: 0.3,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    title: {
                        display: true,
                        text: '涨幅数量',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: '月份',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                    }
                }
            },
            plugins: {
                legend: {
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

/**
 * 初始化评论评分分布图表
 */
function initScoreDistributionChart() {
    const sentimentCtx = document.getElementById('sentimentOverviewChart').getContext('2d');
    
    // 确保score_data长度为5，对应1-5分
    const scoreDistribution = [0, 0, 0, 0, 0];
    for (let i = 0; i < score_labels.length; i++) {
        const score = parseInt(score_labels[i]);
        if (score >= 1 && score <= 5) {
            scoreDistribution[score - 1] = score_data[i];
        }
    }
    
    // 创建饼图
    window.sentimentChart = new Chart(sentimentCtx, {
        type: 'pie',
        data: {
            labels: ['1分', '2分', '3分', '4分', '5分'],
            datasets: [{
                data: scoreDistribution,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.6)',  // 1分 - 红色
                    'rgba(255, 159, 64, 0.6)',  // 2分 - 橙色
                    'rgba(255, 205, 86, 0.6)',  // 3分 - 黄色
                    'rgba(75, 192, 192, 0.6)',  // 4分 - 青色
                    'rgba(54, 162, 235, 0.6)'   // 5分 - 蓝色
                ],
                borderColor: [
                    'rgba(255, 99, 132, 1)',
                    'rgba(255, 159, 64, 1)',
                    'rgba(255, 205, 86, 1)',
                    'rgba(75, 192, 192, 1)',
                    'rgba(54, 162, 235, 1)'
                ],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            }
        }
    });
}

/**
 * 计算数据的涨幅
 */
function calculateGrowthRate(data) {
    const growth = [];
    for (let i = 0; i < data.length; i++) {
        if (i === 0) {
            growth.push(0); // 第一个月没有上月数据，涨幅为0
        } else {
            growth.push(data[i] - data[i - 1]);
        }
    }
    return growth;
}

/**
 * 初始化商品筛选功能
 */
function initProductFilter() {
    const productFilter = document.getElementById('product-filter');
    if (productFilter) {
        productFilter.addEventListener('change', function() {
            const selectedProduct = this.value;
            
            // 发送AJAX请求，根据选择的商品更新图表数据
            fetch('/dashboard/?product=' + selectedProduct, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => response.json())
            .then(data => {
                // 更新数据卡片
                updateDataCards(data);
                
                // 更新近12个月评论情感分析图表
                updateMonthlyChart(data);
                
                // 更新近12个月评论情感涨幅图表
                updateGrowthChart(data);
                
                // 更新评论评分分布图表
                updateScoreChart(data);
                
                // 更新随机评论展示
                updateCommentsList(data);
            })
            .catch(error => {
                console.error('Error:', error);
            });
        });
    }
}

/**
 * 更新数据卡片
 */
function updateDataCards(data) {
    document.querySelectorAll('.amount')[0].textContent = data.total_datasets;
    document.querySelectorAll('.amount')[1].textContent = data.sentiment_datasets;
    document.querySelectorAll('.amount')[2].textContent = data.unique_products;
    document.querySelectorAll('.amount')[3].textContent = data.total_comments;
}

/**
 * 更新近12个月评论情感分析图表
 */
function updateMonthlyChart(data) {
    if (window.monthlyChart) {
        window.monthlyChart.data.datasets[0].data = data.positive_data;
        window.monthlyChart.data.datasets[1].data = data.neutral_data;
        window.monthlyChart.data.datasets[2].data = data.negative_data;
        window.monthlyChart.update();
    }
}

/**
 * 更新近12个月评论情感涨幅图表
 */
function updateGrowthChart(data) {
    if (window.scoreChart) {
        const newPositiveGrowth = calculateGrowthRate(data.positive_data);
        const newNeutralGrowth = calculateGrowthRate(data.neutral_data);
        const newNegativeGrowth = calculateGrowthRate(data.negative_data);
        
        window.scoreChart.data.datasets[0].data = newPositiveGrowth;
        window.scoreChart.data.datasets[1].data = newNeutralGrowth;
        window.scoreChart.data.datasets[2].data = newNegativeGrowth;
        window.scoreChart.update();
    }
}

/**
 * 更新评论评分分布图表
 */
function updateScoreChart(data) {
    if (window.sentimentChart) {
        const newScoreDistribution = [0, 0, 0, 0, 0];
        for (let i = 0; i < data.score_labels.length; i++) {
            const score = parseInt(data.score_labels[i]);
            if (score >= 1 && score <= 5) {
                newScoreDistribution[score - 1] = data.score_data[i];
            }
        }
        
        window.sentimentChart.data.datasets[0].data = newScoreDistribution;
        window.sentimentChart.update();
    }
}

/**
 * 更新随机评论展示
 */
function updateCommentsList(data) {
    const commentsList = document.getElementById('comments-list');
    if (commentsList) {
        commentsList.innerHTML = '';
        
        if (data.random_comments && data.random_comments.length > 0) {
            data.random_comments.forEach(comment => {
                const commentItem = document.createElement('div');
                commentItem.className = 'comment-item';
                commentItem.innerHTML = `
                    <div class="comment-header">
                        <span class="comment-nickname">${comment.nickname}</span>
                        <span class="comment-score">评分: ${comment.score}</span>
                    </div>
                    <div class="comment-content">${comment.content}</div>
                    <div class="comment-time">${comment.publishtime}</div>
                `;
                commentsList.appendChild(commentItem);
            });
        } else {
            commentsList.innerHTML = '<p class="no-comments">暂无评论数据</p>';
        }
    }
}

/**
 * 数字动画函数
 */
function animateValue(element, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const value = Math.floor(progress * (end - start) + start);
        element.textContent = value.toLocaleString();
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * 初始化数字动画效果
 */
function initNumberAnimations() {
    const amountElements = document.querySelectorAll('.amount');
    amountElements.forEach(element => {
        const text = element.textContent;
        const numericValue = parseInt(text.replace(/[^0-9]/g, ''));
        if (!isNaN(numericValue)) {
            animateValue(element, 0, numericValue, 800);
        }
    });
}