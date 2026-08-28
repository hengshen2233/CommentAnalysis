/**
 * 情感分析页面JavaScript代码
 * 功能：处理情感分析请求、数据展示、图表生成等
 */

document.addEventListener('DOMContentLoaded', function () {
    /**
     * 基础设置和变量声明
     */
    
    // DOM元素变量
    const analyzeBtn = document.getElementById('analyzeBtn'); // 分析按钮
    const datasetSelect = document.getElementById('datasetSelect'); // 数据集选择框
    const customSelectOptions = document.getElementById('customSelectOptions'); // 自定义选择下拉选项
    const welcomeSection = document.getElementById('welcomeSection'); // 欢迎区域
    const toolbar = document.getElementById('mainToolbar'); // 工具栏
    const loading = document.getElementById('loading'); // 加载状态
    const resultsArea = document.getElementById('resultsArea'); // 结果展示区域
    const errorMessage = document.getElementById('errorMessage'); // 错误信息
    const errorText = document.getElementById('errorText'); // 错误文本

    // 图表实例对象
    const charts = {
        pie: null, // 饼图实例
        line: null, // 折线图实例
        bar: null // 柱状图实例
    };

    /**
     * 事件监听器和初始化部分
     */
    
    // 初始化自定义选择框
    function initCustomSelect() {
        const options = datasetSelect.querySelectorAll('option');
        customSelectOptions.innerHTML = '';

        options.forEach((option) => {
            if (option.value !== '') {
                const div = document.createElement('div');
                div.className = 'select-option';
                div.textContent = option.textContent;
                div.dataset.value = option.value;

                div.addEventListener('click', function () {
                    datasetSelect.value = this.dataset.value;
                    datasetSelect.dispatchEvent(new Event('change'));
                    hideCustomOptions();

                    customSelectOptions.querySelectorAll('.select-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    this.classList.add('selected');
                });

                customSelectOptions.appendChild(div);
            }
        });
    }

    // 显示自定义选择下拉选项
    function showCustomOptions() {
        customSelectOptions.classList.add('show');
        const selectedOption = customSelectOptions.querySelector(`[data-value="${datasetSelect.value}"]`);
        if (selectedOption) {
            selectedOption.scrollIntoView({block: 'nearest'});
            selectedOption.classList.add('selected');
        }
    }

    // 隐藏自定义选择下拉选项
    function hideCustomOptions() {
        customSelectOptions.classList.remove('show');
    }

    // 点击数据集选择框显示/隐藏自定义下拉
    datasetSelect.addEventListener('click', function (e) {
        e.stopPropagation();
        if (customSelectOptions.classList.contains('show')) {
            hideCustomOptions();
        } else {
            showCustomOptions();
        }
    });

    // 点击数据集选择框时阻止默认行为
    datasetSelect.addEventListener('mousedown', function (e) {
        e.preventDefault();
    });

    // 点击页面其他地方隐藏下拉
    document.addEventListener('click', function (e) {
        if (!datasetSelect.contains(e.target) && !customSelectOptions.contains(e.target)) {
            hideCustomOptions();
        }
    });

    // 数据集选择框键盘导航
    datasetSelect.addEventListener('keydown', function (e) {
        const options = customSelectOptions.querySelectorAll('.select-option');
        const currentIndex = Array.from(options).findIndex(opt => opt.classList.contains('selected'));

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            const nextIndex = (currentIndex + 1) % options.length;
            selectOptionByIndex(nextIndex);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            const prevIndex = (currentIndex - 1 + options.length) % options.length;
            selectOptionByIndex(prevIndex);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (customSelectOptions.classList.contains('show')) {
                const selectedOption = customSelectOptions.querySelector('.selected');
                if (selectedOption) {
                    selectedOption.click();
                }
            } else {
                showCustomOptions();
            }
        } else if (e.key === 'Escape') {
            hideCustomOptions();
        }
    });

    // 根据索引选择选项
    function selectOptionByIndex(index) {
        const options = customSelectOptions.querySelectorAll('.select-option');
        if (options[index]) {
            options.forEach(opt => opt.classList.remove('selected'));
            options[index].classList.add('selected');
            options[index].scrollIntoView({block: 'nearest'});
        }
    }

    // 初始化自定义选择框
    initCustomSelect();

    // 显示错误信息
    function showError(message) {
        errorText.textContent = message;
        errorMessage.classList.remove('hidden');
        setTimeout(() => {
            errorMessage.classList.add('hidden');
        }, 5000);
    }

    // 隐藏错误信息
    function hideError() {
        errorMessage.classList.add('hidden');
    }

    // 分析按钮点击事件
    analyzeBtn.addEventListener('click', async () => {
        const datasetName = datasetSelect.value;
        if (!datasetName) {
            showError("请选择一个数据集进行分析");
            return;
        }

        hideError();
        loading.classList.remove('hidden');
        resultsArea.classList.add('hidden');

        try {
            // 发送情感分析请求
            const response = await fetch('/emotion/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({dataset_name: datasetName})
            });

            const data = await response.json();
            if (data.status === 'success') {
                // 隐藏欢迎区域，显示结果区域
                welcomeSection.classList.add('hidden');
                toolbar.classList.add('has-results');
                loading.classList.add('hidden');
                resultsArea.classList.remove('hidden');
                window.scrollTo({top: 0, behavior: 'smooth'});

                // 渲染分析结果
                setTimeout(() => {
                    renderResults(data);
                }, 100);
            } else {
                alert("分析失败: " + data.msg);
                loading.classList.add('hidden');
            }
        } catch (error) {
            console.error(error);
            loading.classList.add('hidden');
        }
    });

    /**
     * 情感分析相关函数
     */
    
    // 渲染分析结果
    function renderResults(data) {
        // 更新指标数据
        document.getElementById('total_comments').innerText = data.metrics.total_comments; // 总评论数
        document.getElementById('goodRate').innerText = data.metrics.good_rate + '%'; // 好评率
        document.getElementById('bestWord').innerText = data.metrics.best_word || '暂无'; // 最佳关键词
        document.getElementById('worstWord').innerText = data.metrics.worst_word || '暂无'; // 最差关键词

        // 初始化各种图表
        initPieChart(data.pie_data); // 初始化情感分布饼图
        initLineChart(data.line_data); // 初始化情感趋势折线图
        initBarChart(data.high_freq); // 初始化高频词柱状图
        initWordCloud(data.word_cloud); // 初始化词云图
        generateOptimizationSuggestions(data); // 生成优化建议
    }

    /**
     * 优化建议生成函数
     */
    
    // 生成优化建议
    function generateOptimizationSuggestions(data) {
        const suggestionsContainer = document.getElementById('optimizationSuggestions');
        const goodRate = parseFloat(data.metrics.good_rate);
        const bestWord = data.metrics.best_word;
        const worstWord = data.metrics.worst_word;
        const pieData = data.pie_data;
        const highFreq = data.high_freq;
        
        let suggestions = [];
        
        // 根据好评率生成建议
        if (goodRate < 60) {
            suggestions.push({
                title: '提高产品质量',
                content: '当前好评率较低，建议重点关注产品质量问题，特别是用户频繁提到的负面因素。',
                priority: 'high'
            });
        } else if (goodRate < 80) {
            suggestions.push({
                title: '优化用户体验',
                content: '好评率处于中等水平，建议进一步优化用户体验，提升产品竞争力。',
                priority: 'medium'
            });
        } else {
            suggestions.push({
                title: '保持优质服务',
                content: '好评率较高，建议保持现有优势，同时持续创新以维持市场领先地位。',
                priority: 'low'
            });
        }
        
        // 根据最差关键词生成建议
        if (worstWord) {
            suggestions.push({
                title: '改进' + worstWord + '方面',
                content: '用户频繁提到' + worstWord + '问题，建议重点改进这方面的产品或服务。',
                priority: 'high'
            });
        }
        
        // 根据高频词生成建议
        const topWords = Object.keys(highFreq).slice(0, 5);
        if (topWords.length > 0) {
            suggestions.push({
                title: '强化核心优势',
                content: '用户经常提到的关键词包括：' + topWords.join('、') + '，建议强化这些核心优势。',
                priority: 'medium'
            });
        }
        
        // 根据差评数量生成建议
        const badComments = pieData.find(item => item.emotype === '差评');
        if (badComments && badComments.count > 50) {
            suggestions.push({
                title: '分析差评原因',
                content: '差评数量较多，建议深入分析具体原因，制定针对性改进措施。',
                priority: 'high'
            });
        }
        
        // 通用建议
        suggestions.push({
            title: '收集用户反馈',
            content: '定期收集用户反馈，建立反馈机制，及时响应和解决用户问题。',
            priority: 'medium'
        });
        
        suggestions.push({
            title: '优化产品描述',
            content: '基于用户真实评价，优化产品描述，确保与实际体验一致，减少用户期望落差。',
            priority: 'low'
        });
        
        // 渲染建议
        if (suggestions.length > 0) {
            suggestionsContainer.innerHTML = suggestions.map(suggestion => `
                <div class="suggestion-item">
                    <h4>${suggestion.title}</h4>
                    <p>${suggestion.content}</p>
                    <span class="priority ${suggestion.priority}">${suggestion.priority === 'high' ? '高优先级' : suggestion.priority === 'medium' ? '中优先级' : '低优先级'}</span>
                </div>
            `).join('');
        } else {
            suggestionsContainer.innerHTML = '<p class="loading-text">暂无优化建议</p>';
        }
    }

    /**
     * 图表和词云生成函数
     */
    
    // 初始化情感分布饼图
    function initPieChart(pieData) {
        const ctx = document.getElementById('pieChart').getContext('2d');
        if (charts.pie) charts.pie.destroy();
        
        // 对饼图数据进行排序，按好评、中评、差评顺序
        const sortedPieData = pieData.sort((a, b) => {
            const order = {'好评': 1, '中评': 2, '差评': 3};
            return (order[a.emotype]) - (order[b.emotype]);
        });
        
        // 创建饼图
        charts.pie = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: sortedPieData.map(i => i.emotype),
                datasets: [{
                    data: sortedPieData.map(i => i.count),
                    backgroundColor: ['#2ecc71', '#f1c40f', '#e74c3c'], // 绿色-好评，黄色-中评，红色-差评
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function (context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    // 初始化情感趋势折线图
    function initLineChart(lineData) {
        const ctx = document.getElementById('lineChart').getContext('2d');
        if (charts.line) charts.line.destroy();

        // 提取数据
        const bins = lineData.map(item => item.bin);
        const counts = lineData.map(item => item.count);

        // 计算Y轴最大值
        const maxCount = Math.max(...counts);
        const yMax = Math.ceil(maxCount * 1.1);

        // 创建折线图
        charts.line = new Chart(ctx, {
            type: 'line',
            data: {
                labels: bins.map(bin => bin.toFixed(1)),
                datasets: [{
                    label: '评论数',
                    data: counts,
                    borderColor: '#3498db',
                    backgroundColor: 'rgba(52, 152, 219, 0.2)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointBackgroundColor: '#3498db',
                    pointBorderColor: '#fff',
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            title: function (tooltipItems) {
                                const index = tooltipItems[0].dataIndex;
                                const bin = bins[index];
                                return `情感权重: ${bin.toFixed(1)}`;
                            },
                            label: function (context) {
                                const count = context.raw;
                                const index = context.dataIndex;
                                const bin = bins[index];
                                const nextBin = index < bins.length - 1 ? bins[index + 1] : 3;
                                return `评论数: ${count} (${bin.toFixed(1)} ~ ${nextBin.toFixed(1)})`;
                            }
                        }
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        }
                    }
                },
                scales: {
                    y: {
                        title: {
                            display: true,
                            text: '评论数',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        },
                        beginAtZero: true,
                        min: 0,
                        max: yMax,
                        ticks: {
                            stepSize: Math.ceil(yMax / 10),
                            callback: function (value) {
                                if (value % 1 === 0) {
                                    return value;
                                }
                            },
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '情感权重',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        },
                        type: 'linear',
                        min: -3,
                        max: 3,
                        ticks: {
                            stepSize: 0.5,
                            callback: function (value) {
                                if (value % 0.5 === 0) {
                                    return value.toFixed(1);
                                }
                                return '';
                            },
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        }
                    }
                }
            }
        });
    }

    // 初始化高频词柱状图
    function initBarChart(highFreq) {
        const ctx = document.getElementById('barChart').getContext('2d');
        if (charts.bar) charts.bar.destroy();
        
        // 创建柱状图
        charts.bar = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(highFreq),
                datasets: [{
                    label: '出现次数',
                    data: Object.values(highFreq),
                    backgroundColor: 'rgba(52,152,219,0.7)',
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
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
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        },
                        title: {
                            display: true,
                            text: '出现次数',
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        },
                        title: {
                            display: true,
                            text: '关键词',
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        }
                    }
                }
            }
        });
    }

    // 初始化词云图
    function initWordCloud(words) {
        try {
            const container = document.getElementById('wordCloud');
            
            if (!container) {
                return;
            }

            // 设置词云容器高度
            if (!container.style.height || container.style.height === '0px') {
                container.style.height = '280px';
            }
            
            container.style.display = 'block';
            container.style.visibility = 'visible';
            
            // 获取容器尺寸
            const rect = container.getBoundingClientRect();
            
            // 如果容器尺寸为0，延迟初始化
            if (rect.width === 0 || rect.height === 0) {
                setTimeout(() => {
                    initWordCloud(words);
                }, 200);
                return;
            }

            // 初始化词云图
            const chart = echarts.init(container);
            
            // 检测是否为深色主题
            const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
            
            const option = {
                tooltip: {
                    show: true,
                    formatter: function (params) {
                        return `${params.name}: ${params.value}次`;
                    },
                    backgroundColor: isDarkTheme ? '#333' : 'rgba(255, 255, 255, 0.9)',
                    textStyle: {
                        color: isDarkTheme ? '#bdc3c7' : '#333'
                    }
                },
                series: [{
                    type: 'wordCloud',
                    shape: 'circle',
                    left: 'center',
                    top: 'center',
                    width: '90%',
                    height: '90%',
                    sizeRange: [12, 40],
                    rotationRange: [0, 0],
                    gridSize: 10,
                    drawOutOfBound: false,
                    textStyle: {
                        fontFamily: 'sans-serif',
                        fontWeight: 'bold',
                        color: function () {
                            if (isDarkTheme) {
                                return 'rgb(' + [
                                    Math.round(120 + Math.random() * 135),
                                    Math.round(120 + Math.random() * 135),
                                    Math.round(120 + Math.random() * 135)
                                ].join(',') + ')';
                            } else {
                                return 'rgb(' + [
                                    Math.round(Math.random() * 160),
                                    Math.round(Math.random() * 160),
                                    Math.round(Math.random() * 160)
                                ].join(',') + ')';
                            }
                        }
                    },
                    emphasis: {
                        focus: 'self',
                        textStyle: {
                            shadowBlur: 10,
                            shadowColor: isDarkTheme ? '#fff' : '#333'
                        }
                    },
                    data: words.slice(0, 150) // 只显示前150个词
                }]
            };

            chart.setOption(option);

            // 延迟调整图表大小
            setTimeout(() => {
                chart.resize();
            }, 300);

            // 窗口大小改变时调整图表大小
            window.addEventListener('resize', function () {
                chart.resize();
            });
            
        } catch (error) {
            console.error('词云图初始化失败:', error);
        }
    }

    /**
     * 数据处理和转换函数
     */
    
    // 获取cookie值
    function getCookie(name) {
        let cookieValue = null;
        if (document.cookie && document.cookie !== '') {
            const cookies = document.cookie.split(';');
            for (let i = 0; i < cookies.length; i++) {
                const cookie = cookies[i].trim();
                if (cookie.substring(0, name.length + 1) === (name + '=')) {
                    cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                    break;
                }
            }
        }
        return cookieValue;
    }
});