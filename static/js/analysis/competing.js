/**
 * 多平台竞品分析页面JavaScript代码
 * 功能：处理分析类型切换、数据选择、API调用、结果展示等
 */

document.addEventListener('DOMContentLoaded', function() {
    /**
     * 基础设置和变量声明
     */
    
    // 分析类型切换相关元素
    const platformAnalysisBtn = document.getElementById('platformAnalysisBtn'); // 平台分析按钮
    const competitiveAnalysisBtn = document.getElementById('competitiveAnalysisBtn'); // 竞争分析按钮
    const platformAnalysisSection = document.getElementById('platformAnalysisSection'); // 平台分析区域
    const competitiveAnalysisSection = document.getElementById('competitiveAnalysisSection'); // 竞争分析区域
    
    // 数据选择相关元素
    const productSelect = document.getElementById('productSelect'); // 商品选择框
    const customSelectOptions = document.getElementById('customSelectOptions'); // 自定义商品选择下拉选项
    const datasetSelects = [ // 数据集选择框数组
        document.getElementById('datasetSelect1'),
        document.getElementById('datasetSelect2'),
        document.getElementById('datasetSelect3'),
        document.getElementById('datasetSelect4')
    ];
    const customSelectOptionsList = [ // 自定义数据集选择下拉选项数组
        document.getElementById('customSelectOptions1'),
        document.getElementById('customSelectOptions2'),
        document.getElementById('customSelectOptions3'),
        document.getElementById('customSelectOptions4')
    ];
    const selectedCountElement = document.getElementById('selectedCount'); // 选择数据集数量显示
    
    // 按钮和状态相关元素
    const analyzeBtn = document.getElementById('analyzeBtn'); // 分析按钮
    const loading = document.getElementById('loading'); // 加载状态
    const errorMessage = document.getElementById('errorMessage'); // 错误信息
    const errorText = document.getElementById('errorText'); // 错误文本
    const resultsArea = document.getElementById('resultsArea'); // 结果展示区域
    
    // 结果展示相关元素
    const platformResults = document.getElementById('platformResults'); // 平台分析结果
    const competitiveResults = document.getElementById('competitiveResults'); // 竞争分析结果
    
    /**
     * 事件监听器和初始化部分
     */
    
    // 初始化自定义商品下拉框
    function initCustomSelect() {
        const options = productSelect.querySelectorAll('option');
        customSelectOptions.innerHTML = '';

        options.forEach((option, index) => {
            if (option.value !== '') {
                const div = document.createElement('div');
                div.className = 'select-option';
                div.textContent = option.textContent;
                div.dataset.value = option.value;

                div.addEventListener('click', function () {
                    productSelect.value = this.dataset.value;
                    productSelect.dispatchEvent(new Event('change'));
                    hideCustomOptions();

                    // 移除所有选中状态
                    customSelectOptions.querySelectorAll('.select-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    // 添加当前选中状态
                    this.classList.add('selected');
                });

                customSelectOptions.appendChild(div);
            }
        });
    }

    // 显示自定义商品下拉选项
    function showCustomOptions() {
        customSelectOptions.classList.add('show');
        // 滚动到选中的选项
        const selectedOption = customSelectOptions.querySelector(`[data-value="${productSelect.value}"]`);
        if (selectedOption) {
            selectedOption.scrollIntoView({block: 'nearest'});
            selectedOption.classList.add('selected');
        }
    }

    // 隐藏自定义商品下拉选项
    function hideCustomOptions() {
        customSelectOptions.classList.remove('show');
    }

    // 点击商品选择框显示/隐藏自定义下拉
    productSelect.addEventListener('click', function (e) {
        e.stopPropagation();
        if (customSelectOptions.classList.contains('show')) {
            hideCustomOptions();
        } else {
            showCustomOptions();
        }
    });

    // 点击商品选择框时阻止默认行为
    productSelect.addEventListener('mousedown', function (e) {
        e.preventDefault();
    });

    // 点击页面其他地方隐藏商品选择下拉
    document.addEventListener('click', function (e) {
        if (!productSelect.contains(e.target) && !customSelectOptions.contains(e.target)) {
            hideCustomOptions();
        }
    });

    // 商品选择框键盘导航
    productSelect.addEventListener('keydown', function (e) {
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

    // 根据索引选择商品选项
    function selectOptionByIndex(index) {
        const options = customSelectOptions.querySelectorAll('.select-option');
        if (options[index]) {
            options.forEach(opt => opt.classList.remove('selected'));
            options[index].classList.add('selected');
            options[index].scrollIntoView({block: 'nearest'});
        }
    }

    // 初始化自定义下拉框
    initCustomSelect();
    
    // 初始化数据集选择器
    initDatasetSelects();
    
    // 更新选择状态计数
    updateSelectedCount();
    
    // 初始化所有数据集选择器
    function initDatasetSelects() {
        datasetSelects.forEach((select, index) => {
            if (select) {
                initDatasetSelect(select, customSelectOptionsList[index]);
            }
        });
    }
    
    // 初始化单个数据集选择器
    function initDatasetSelect(select, optionsContainer) {
        // 初始化选项
        const options = select.querySelectorAll('option');
        optionsContainer.innerHTML = '';

        options.forEach((option, index) => {
            if (option.value !== '') {
                const div = document.createElement('div');
                div.className = 'select-option';
                div.textContent = option.textContent;
                div.dataset.value = option.value;

                div.addEventListener('click', function () {
                    select.value = this.dataset.value;
                    select.dispatchEvent(new Event('change'));
                    hideDatasetOptions(optionsContainer);

                    // 移除所有选中状态
                    optionsContainer.querySelectorAll('.select-option').forEach(opt => {
                        opt.classList.remove('selected');
                    });
                    // 添加当前选中状态
                    this.classList.add('selected');
                    
                    // 更新选择状态计数
                    updateSelectedCount();
                });

                optionsContainer.appendChild(div);
            }
        });

        // 点击选择框显示自定义下拉
        select.addEventListener('click', function (e) {
            e.stopPropagation();
            if (optionsContainer.classList.contains('show')) {
                hideDatasetOptions(optionsContainer);
            } else {
                showDatasetOptions(select, optionsContainer);
            }
        });

        // 点击选择框时阻止默认行为
        select.addEventListener('mousedown', function (e) {
            e.preventDefault();
        });

        // 选择变化时更新计数
        select.addEventListener('change', function () {
            updateSelectedCount();
        });
    }

    // 显示数据集选择器下拉选项
    function showDatasetOptions(select, optionsContainer) {
        // 隐藏所有其他下拉
        customSelectOptionsList.forEach(container => {
            container.classList.remove('show');
        });
        // 显示当前下拉
        optionsContainer.classList.add('show');
        // 滚动到选中的选项
        const selectedOption = optionsContainer.querySelector(`[data-value="${select.value}"]`);
        if (selectedOption) {
            selectedOption.scrollIntoView({block: 'nearest'});
            selectedOption.classList.add('selected');
        }
    }

    // 隐藏数据集选择器下拉选项
    function hideDatasetOptions(optionsContainer) {
        optionsContainer.classList.remove('show');
    }

    // 点击页面其他地方隐藏下拉
    document.addEventListener('click', function (e) {
        // 隐藏商品选择下拉
        if (!productSelect.contains(e.target) && !customSelectOptions.contains(e.target)) {
            hideCustomOptions();
        }
        // 隐藏数据集选择下拉
        datasetSelects.forEach((select, index) => {
            const optionsContainer = customSelectOptionsList[index];
            if (select && optionsContainer && !select.contains(e.target) && !optionsContainer.contains(e.target)) {
                hideDatasetOptions(optionsContainer);
            }
        });
    });

    // 更新选择状态计数
    function updateSelectedCount() {
        const selectedDatasets = getSelectedDatasets();
        selectedCountElement.textContent = `已选择 ${selectedDatasets.length} 个数据集`;
    }

    // 获取选中的数据集（去重）
    function getSelectedDatasets() {
        const selected = [];
        datasetSelects.forEach(select => {
            if (select && select.value) {
                selected.push(select.value);
            }
        });
        return [...new Set(selected)]; // 去重
    }
    
    // 分析类型切换逻辑 - 切换到平台分析
    platformAnalysisBtn.addEventListener('click', function() {
        platformAnalysisBtn.classList.add('active');
        platformAnalysisBtn.classList.remove('btn-secondary');
        platformAnalysisBtn.classList.add('btn-primary');
        competitiveAnalysisBtn.classList.remove('active');
        competitiveAnalysisBtn.classList.remove('btn-primary');
        competitiveAnalysisBtn.classList.add('btn-secondary');
        
        platformAnalysisSection.classList.remove('hidden');
        competitiveAnalysisSection.classList.add('hidden');
    });
    
    // 分析类型切换逻辑 - 切换到竞争分析
    competitiveAnalysisBtn.addEventListener('click', function() {
        competitiveAnalysisBtn.classList.add('active');
        competitiveAnalysisBtn.classList.remove('btn-secondary');
        competitiveAnalysisBtn.classList.add('btn-primary');
        platformAnalysisBtn.classList.remove('active');
        platformAnalysisBtn.classList.remove('btn-primary');
        platformAnalysisBtn.classList.add('btn-secondary');
        
        competitiveAnalysisSection.classList.remove('hidden');
        platformAnalysisSection.classList.add('hidden');
    });
    
    // 分析按钮点击事件
    analyzeBtn.addEventListener('click', function() {
        // 隐藏错误信息
        hideError();
        
        // 检查当前分析类型
        const isPlatformAnalysis = platformAnalysisBtn.classList.contains('active');
        
        if (isPlatformAnalysis) {
            // 多平台分析验证
            const selectedProduct = productSelect.value;
            if (!selectedProduct) {
                showError('请选择商品');
                return;
            }
            
            // 执行多平台分析
            performPlatformAnalysis(selectedProduct);
        } else {
            // 竞品分析验证
            // 先获取所有选中的数据集（包括重复的）
            const allSelected = [];
            datasetSelects.forEach(select => {
                if (select && select.value) {
                    allSelected.push(select.value);
                }
            });
            
            // 1. 检查是否存在重复的数据集
            if (allSelected.length !== new Set(allSelected).size) {
                showError('数据集存在相同');
                return;
            }
            
            // 2. 检查是否至少选择了两个数据集
            if (allSelected.length < 2) {
                showError('至少需要两个数据集进行竞品分析');
                return;
            }
            
            // 执行竞品分析
            performCompetitiveAnalysis(allSelected);
        }
    });
    
    /**
     * 平台分析相关函数
     */
    
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
    
    // 执行多平台分析
    function performPlatformAnalysis(product) {
        showLoading();
        
        // 发送POST请求到后端
        fetch('/competing/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: `analysis_type=platform&product=${encodeURIComponent(product)}`
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            
            if (data.error) {
                showError(data.error);
                return;
            }
            
            // 显示结果
            showPlatformResults(data);
        })
        .catch(error => {
            hideLoading();
            showError('分析失败，请重试');
            console.error('Error:', error);
        });
    }
    
    // 执行竞品分析
    function performCompetitiveAnalysis(datasets) {
        showLoading();
        
        // 构建表单数据
        const formData = new FormData();
        formData.append('analysis_type', 'competitive');
        datasets.forEach(dataset => {
            formData.append('datasets[]', dataset);
        });
        
        // 发送POST请求到后端
        fetch('/competing/', {
            method: 'POST',
            headers: {
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            hideLoading();
            
            if (data.error) {
                showError(data.error);
                return;
            }
            
            // 显示结果
            showCompetitiveResults(data);
        })
        .catch(error => {
            hideLoading();
            showError('分析失败，请重试');
            console.error('Error:', error);
        });
    }
    
    // 获取CSRF Token的辅助函数
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
    
    // 显示加载状态
    function showLoading() {
        loading.classList.remove('hidden');
        resultsArea.classList.add('hidden');
    }
    
    // 隐藏加载状态
    function hideLoading() {
        loading.classList.add('hidden');
    }
    
    // 显示多平台分析结果
    function showPlatformResults(data) {
        // 隐藏竞品分析结果，显示多平台分析结果
        competitiveResults.classList.add('hidden');
        platformResults.classList.remove('hidden');
        resultsArea.classList.remove('hidden');
        
        // 隐藏欢迎区域
        document.getElementById('welcomeSection').classList.add('hidden');
        
        // 固定工具栏
        document.getElementById('mainToolbar').classList.add('has-results');
        
        // 生成平台指标卡片
        const platformMetricsContainer = document.getElementById('platformMetricsContainer');
        platformMetricsContainer.innerHTML = '';
        
        data.platforms.forEach((platform, index) => {
            const metricCard = document.createElement('div');
            metricCard.className = 'metric-card';
            metricCard.innerHTML = `
                <h3>${platform}</h3>
                <p class="value">${data.goodRates[index]}%</p>
                <p class="value sub">好评率</p>
            `;
            platformMetricsContainer.appendChild(metricCard);
        });
        
        // 绘制近12个月平台好评数波动折线图
        drawPlatformGoodRateChart(data.platforms, data.monthlyGoodCounts);
        
        // 绘制平台评论数量对比图表
        drawPlatformCommentCountChart(data.platforms, data.commentCounts || data.platforms.map(() => 0));
        
        // 生成平台好评词云图
        generatePlatformWordCloud('platformGoodWordCloud', data.goodWords);
        
        // 生成平台差评词云图
        generatePlatformWordCloud('platformBadWordCloud', data.badWords);
        
        // 显示平台改进建议
        const platformSuggestions = document.getElementById('platformSuggestions');
        platformSuggestions.innerHTML = '';
        
        if (data.suggestions && data.suggestions.length > 0) {
            data.suggestions.forEach(suggestion => {
                const suggestionItem = document.createElement('div');
                suggestionItem.className = 'suggestion-item';
                
                // 为不同优先级添加不同的边框颜色
                let borderColor = '#3498db'; // 默认蓝色
                if (suggestion.priority === 'high') {
                    borderColor = '#e74c3c'; // 红色
                } else if (suggestion.priority === 'medium') {
                    borderColor = '#f39c12'; // 橙色
                } else if (suggestion.priority === 'low') {
                    borderColor = '#2ecc71'; // 绿色
                }
                
                suggestionItem.style.borderLeftColor = borderColor;
                
                suggestionItem.innerHTML = `
                    <div class="suggestion-header">
                        <h4>${suggestion.title}</h4>
                        <span class="priority ${suggestion.priority}">${suggestion.priority === 'high' ? '高优先级' : suggestion.priority === 'medium' ? '中优先级' : '低优先级'}</span>
                    </div>
                    <div class="suggestion-content">
                        <p>${suggestion.content}</p>
                    </div>
                `;
                platformSuggestions.appendChild(suggestionItem);
            });
        } else {
            platformSuggestions.innerHTML = '<div class="no-suggestions">暂无改进建议</div>';
        }
    }
    
    /**
     * 竞争分析相关函数
     */
    
    // 显示竞品分析结果
    function showCompetitiveResults(data) {
        // 隐藏多平台分析结果，显示竞品分析结果
        platformResults.classList.add('hidden');
        competitiveResults.classList.remove('hidden');
        resultsArea.classList.remove('hidden');
        
        // 隐藏欢迎区域
        document.getElementById('welcomeSection').classList.add('hidden');
        
        // 固定工具栏
        document.getElementById('mainToolbar').classList.add('has-results');
        
        // 生成竞品指标卡片
        const competitiveMetricsContainer = document.getElementById('competitiveMetricsContainer');
        competitiveMetricsContainer.innerHTML = '';
        
        data.products.forEach((product, index) => {
            const metricCard = document.createElement('div');
            metricCard.className = 'metric-card';
            metricCard.innerHTML = `
                <h3>${product}</h3>
                <p class="value">${data.goodRates[index]}%</p>
                <p class="value sub">好评率</p>
            `;
            competitiveMetricsContainer.appendChild(metricCard);
        });
        
        // 生成竞品词云图
        const competitiveWordCloudsContainer = document.getElementById('competitiveWordCloudsContainer');
        competitiveWordCloudsContainer.innerHTML = '';
        
        // 创建网格布局容器
        const wordcloudGrid = document.createElement('div');
        wordcloudGrid.className = 'wordcloud-grid';
        
        // 为每个商品创建标签页结构
        data.products.forEach(product => {
            // 创建商品容器
            const productContainer = document.createElement('div');
            productContainer.className = 'wordcloud-card';
            
            // 创建标题
            const title = document.createElement('h4');
            title.textContent = product;
            productContainer.appendChild(title);
            
            // 创建标签页
            const tabs = document.createElement('div');
            tabs.className = 'wordcloud-tabs';
            
            const tabContent = document.createElement('div');
            tabContent.className = 'wordcloud-tab-content';
            
            // 好评词云标签
            const goodTab = document.createElement('button');
            goodTab.className = 'wordcloud-tab active';
            goodTab.textContent = '好评词云';
            goodTab.addEventListener('click', function() {
                tabs.querySelectorAll('.wordcloud-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                tabContent.querySelectorAll('.wordcloud-tab-pane').forEach(pane => pane.classList.add('hidden'));
                const activePane = document.getElementById(`good_${product.replace(/\s+/g, '_')}`);
                activePane.classList.remove('hidden');
                
                // 延迟调整图表大小，确保容器已经完全显示
                setTimeout(() => {
                    const chartId = `good_${product.replace(/\s+/g, '_')}`;
                    if (chartInstances[chartId]) {
                        chartInstances[chartId].resize();
                    }
                }, 100);
            });
            tabs.appendChild(goodTab);
            
            // 差评词云标签
            const badTab = document.createElement('button');
            badTab.className = 'wordcloud-tab';
            badTab.textContent = '差评词云';
            badTab.addEventListener('click', function() {
                tabs.querySelectorAll('.wordcloud-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                tabContent.querySelectorAll('.wordcloud-tab-pane').forEach(pane => pane.classList.add('hidden'));
                const activePane = document.getElementById(`bad_${product.replace(/\s+/g, '_')}`);
                activePane.classList.remove('hidden');
                
                // 延迟调整图表大小，确保容器已经完全显示
                setTimeout(() => {
                    const chartId = `bad_${product.replace(/\s+/g, '_')}`;
                    if (chartInstances[chartId]) {
                        chartInstances[chartId].resize();
                    }
                }, 100);
            });
            tabs.appendChild(badTab);
            
            // 好评词云内容
            const goodPane = document.createElement('div');
            goodPane.id = `good_${product.replace(/\s+/g, '_')}`;
            goodPane.className = 'wordcloud-tab-pane';
            goodPane.style.height = '250px';
            tabContent.appendChild(goodPane);
            
            // 差评词云内容
            const badPane = document.createElement('div');
            badPane.id = `bad_${product.replace(/\s+/g, '_')}`;
            badPane.className = 'wordcloud-tab-pane hidden';
            badPane.style.height = '250px';
            tabContent.appendChild(badPane);
            
            productContainer.appendChild(tabs);
            productContainer.appendChild(tabContent);
            wordcloudGrid.appendChild(productContainer);
            
            // 生成词云图
            const goodWordsData = data.goodWords && data.goodWords[product] ? data.goodWords[product] : [];
            const badWordsData = data.badWords && data.badWords[product] ? data.badWords[product] : [];
            
            // 确保容器可见后再初始化词云图
            setTimeout(() => {
                generateWordCloud(`good_${product.replace(/\s+/g, '_')}`, goodWordsData);
                
                // 临时显示差评词云容器，初始化后再隐藏
                badPane.classList.remove('hidden');
                setTimeout(() => {
                    generateWordCloud(`bad_${product.replace(/\s+/g, '_')}`, badWordsData);
                    badPane.classList.add('hidden');
                }, 50);
            }, 100);
        });
        
        competitiveWordCloudsContainer.appendChild(wordcloudGrid);
        
        // 显示商品改进建议
        const competitiveSuggestions = document.getElementById('competitiveSuggestions');
        competitiveSuggestions.innerHTML = '';
        
        if (data.suggestions && data.suggestions.length > 0) {
            data.suggestions.forEach(suggestion => {
                const suggestionItem = document.createElement('div');
                suggestionItem.className = 'suggestion-item';
                
                // 为不同优先级添加不同的边框颜色
                let borderColor = '#3498db'; // 默认蓝色
                if (suggestion.priority === 'high') {
                    borderColor = '#e74c3c'; // 红色
                } else if (suggestion.priority === 'medium') {
                    borderColor = '#f39c12'; // 橙色
                } else if (suggestion.priority === 'low') {
                    borderColor = '#2ecc71'; // 绿色
                }
                
                suggestionItem.style.borderLeftColor = borderColor;
                
                suggestionItem.innerHTML = `
                    <div class="suggestion-header">
                        <h4>${suggestion.title}</h4>
                        <span class="priority ${suggestion.priority}">${suggestion.priority === 'high' ? '高优先级' : suggestion.priority === 'medium' ? '中优先级' : '低优先级'}</span>
                    </div>
                    <div class="suggestion-content">
                        <p>${suggestion.content}</p>
                    </div>
                `;
                competitiveSuggestions.appendChild(suggestionItem);
            });
        } else {
            competitiveSuggestions.innerHTML = '<div class="no-suggestions">暂无改进建议</div>';
        }
    }
    
    /**
     * 图表和词云生成函数
     */
    
    // 绘制近12个月平台好评数波动折线图
    function drawPlatformGoodRateChart(platforms, monthlyGoodCounts) {
        const ctx = document.getElementById('platformGoodRateChart').getContext('2d');
        
        // 检测当前主题
        const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDarkTheme ? '#bdc3c7' : '#333';
        
        // 销毁旧图表
        if (window.platformGoodRateChart && typeof window.platformGoodRateChart.destroy === 'function') {
            window.platformGoodRateChart.destroy();
        }
        
        // 提取所有月份标签（确保所有平台使用相同的月份）
        const allMonths = new Set();
        platforms.forEach(platform => {
            if (monthlyGoodCounts[platform]) {
                Object.keys(monthlyGoodCounts[platform]).forEach(month => {
                    allMonths.add(month);
                });
            }
        });
        const sortedMonths = Array.from(allMonths).sort();
        
        // 准备数据集
        const datasets = platforms.map((platform, index) => {
            // 为每个平台分配不同的颜色
            const colors = [
                { border: 'rgba(54, 162, 235, 1)', background: 'rgba(54, 162, 235, 0.1)' },
                { border: 'rgba(255, 99, 132, 1)', background: 'rgba(255, 99, 132, 0.1)' },
                { border: 'rgba(255, 206, 86, 1)', background: 'rgba(255, 206, 86, 0.1)' },
                { border: 'rgba(75, 192, 192, 1)', background: 'rgba(75, 192, 192, 0.1)' }
            ];
            const color = colors[index % colors.length];
            
            // 为每个月份获取对应的好评数数据
            const data = sortedMonths.map(month => {
                return monthlyGoodCounts[platform] ? monthlyGoodCounts[platform][month] || 0 : 0;
            });
            
            return {
                label: platform,
                data: data,
                borderColor: color.border,
                backgroundColor: color.background,
                tension: 0.3,
                fill: true
            };
        });
        
        window.platformGoodRateChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedMonths,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: '好评数',
                            color: textColor
                        },
                        ticks: {
                            color: textColor
                        }
                    },
                    x: {
                        title: {
                            display: true,
                            text: '月份',
                            color: textColor
                        },
                        ticks: {
                            color: textColor
                        }
                    }
                },
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            color: textColor
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
    
    // 绘制平台评论数量对比图表
    function drawPlatformCommentCountChart(platforms, commentCounts) {
        const ctx = document.getElementById('platformCommentCountChart').getContext('2d');
        
        // 检测当前主题
        const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDarkTheme ? '#bdc3c7' : '#333';
        
        // 销毁旧图表
        if (window.platformCommentCountChart && typeof window.platformCommentCountChart.destroy === 'function') {
            window.platformCommentCountChart.destroy();
        }
        
        window.platformCommentCountChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: platforms,
                datasets: [{
                    label: '评论数量',
                    data: commentCounts,
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)',
                        'rgba(54, 162, 235, 0.6)',
                        'rgba(255, 206, 86, 0.6)',
                        'rgba(75, 192, 192, 0.6)'
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(75, 192, 192, 1)'
                    ],
                    borderWidth: 1
                }]
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
                            color: textColor
                        },
                        ticks: {
                            color: textColor
                        }
                    },
                    x: {
                        ticks: {
                            color: textColor
                        }
                    }
                },
                plugins: {
                    legend: {
                        labels: {
                            color: textColor
                        }
                    }
                }
            }
        });
    }
    
    // 存储图表实例
    const chartInstances = {};
    
    // 生成平台词云图
    function generatePlatformWordCloud(elementId, wordData) {
        const container = document.getElementById(elementId);
        if (!container) {
            console.error('容器不存在:', elementId);
            return;
        }
        container.innerHTML = '';
        
        // 创建标签页
        const tabs = document.createElement('div');
        tabs.className = 'wordcloud-tabs';
        tabs.dataset.containerId = elementId; // 添加唯一标识
        
        const tabContent = document.createElement('div');
        tabContent.className = 'wordcloud-tab-content';
        tabContent.style.height = '250px';
        
        Object.keys(wordData).forEach((platform, index) => {
            // 创建唯一的面板ID，包含容器ID以避免冲突
            const paneId = `pane_${elementId}_${platform.replace(/\s+/g, '_')}`;
            const chartId = `${elementId}_${platform.replace(/\s+/g, '_')}`;
            
            // 创建标签
            const tab = document.createElement('button');
            tab.className = `wordcloud-tab ${index === 0 ? 'active' : ''}`;
            tab.textContent = platform;
            tab.addEventListener('click', function() {
                // 切换标签
                tabs.querySelectorAll('.wordcloud-tab').forEach(t => t.classList.remove('active'));
                this.classList.add('active');
                
                // 切换内容，只影响当前容器内的面板
                tabContent.querySelectorAll('.wordcloud-tab-pane').forEach(pane => pane.classList.add('hidden'));
                const activePane = document.getElementById(paneId);
                activePane.classList.remove('hidden');
                
                // 延迟调整图表大小，确保容器已经完全显示
                setTimeout(() => {
                    if (chartInstances[chartId]) {
                        chartInstances[chartId].resize();
                    }
                }, 100);
            });
            tabs.appendChild(tab);
            
            // 创建标签内容
            const pane = document.createElement('div');
            pane.id = paneId;
            pane.className = `wordcloud-tab-pane ${index === 0 ? '' : 'hidden'}`;
            pane.style.height = '100%';
            
            // 创建词云图容器
            const chartContainer = document.createElement('div');
            chartContainer.id = chartId;
            chartContainer.style.width = '100%';
            chartContainer.style.height = '100%';
            pane.appendChild(chartContainer);
            
            tabContent.appendChild(pane);
        });
        
        container.appendChild(tabs);
        container.appendChild(tabContent);
        
        // 生成每个平台的词云图，确保容器可见后再初始化
        setTimeout(() => {
            Object.keys(wordData).forEach((platform, index) => {
                const chartId = `${elementId}_${platform.replace(/\s+/g, '_')}`;
                const paneId = `pane_${elementId}_${platform.replace(/\s+/g, '_')}`;
                const pane = document.getElementById(paneId);
                
                // 对于第一个平台，直接初始化
                if (index === 0) {
                    generateWordCloud(chartId, wordData[platform]);
                } else {
                    // 对于其他平台，临时显示面板，初始化后再隐藏
                    pane.classList.remove('hidden');
                    setTimeout(() => {
                        generateWordCloud(chartId, wordData[platform]);
                        pane.classList.add('hidden');
                    }, 50);
                }
            });
        }, 100);
    }
    
    // 生成词云图
    function generateWordCloud(elementId, wordData) {
        const container = document.getElementById(elementId);
        if (!container) {
            console.error('容器不存在:', elementId);
            return;
        }
        
        // 检测当前主题
        const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
        
        // 确保容器有合适的高度
        container.style.height = '250px';
        container.style.width = '100%';
        
        // 检查数据是否有效
        if (!wordData || !Array.isArray(wordData) || wordData.length === 0) {
            console.error('词云数据无效:', wordData);
            const textColor = isDarkTheme ? '#bdc3c7' : '#999';
            container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: ${textColor};">暂无词云数据</div>`;
            return;
        }
        
        try {
            // 销毁旧图表实例（如果存在）
            if (chartInstances[elementId]) {
                chartInstances[elementId].dispose();
            }
            
            const chart = echarts.init(container);
            
            // 存储图表实例
            chartInstances[elementId] = chart;
            
            // 颜色方案 - 提高区分度
            const goodColors = ['#3498db', '#2ecc71', '#f39c12', '#e74c3c', '#9b59b6', '#1abc9c', '#34495e', '#f1c40f'];
            const badColors = ['#e74c3c', '#c0392b', '#9b59b6', '#8e44ad', '#2c3e50', '#7f8c8d', '#95a5a6', '#bdc3c7'];
            
            // 根据容器ID判断是好评还是差评词云
            const isGoodWordCloud = elementId.includes('good_');
            const colorPalette = isGoodWordCloud ? goodColors : badColors;
            
            const option = {
                tooltip: {
                    trigger: 'item',
                    formatter: function(params) {
                        return params.name + ': ' + params.value;
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
                    width: '95%',
                    height: '95%',
                    right: null,
                    bottom: null,
                    sizeRange: [12, 35],
                    rotationRange: [-45, 45],
                    rotationStep: 45,
                    gridSize: 5,
                    drawOutOfBound: false,
                    textStyle: {
                        fontFamily: 'sans-serif',
                        fontWeight: 'bold',
                        color: function(params) {
                            // 为重要词语分配更醒目的颜色
                            const index = params.dataIndex % colorPalette.length;
                            return colorPalette[index];
                        }
                    },
                    emphasis: {
                        focus: 'self',
                        textStyle: {
                            shadowBlur: 10,
                            shadowColor: isDarkTheme ? '#bdc3c7' : '#333',
                            fontSize: function(params) {
                                return params.style.fontSize * 1.1;
                            }
                        }
                    },
                    data: wordData.map(item => ({
                        name: item[0],
                        value: item[1]
                    })).sort(function(a, b) {
                        // 按词语重要性排序，确保重要词语优先放置
                        return b.value - a.value;
                    })
                }]
            };
            
            chart.setOption(option);
            
            // 响应式调整
            window.addEventListener('resize', function() {
                if (chartInstances[elementId]) {
                    chartInstances[elementId].resize();
                }
            });
            
            // 初始调整大小
            setTimeout(function() {
                if (chartInstances[elementId]) {
                    chartInstances[elementId].resize();
                }
            }, 200);
        } catch (error) {
            console.error('词云图初始化失败:', error);
            const textColor = isDarkTheme ? '#bdc3c7' : '#999';
            container.innerHTML = `<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: ${textColor};">词云图加载失败</div>`;
        }
    }
    
    /**
     * UI更新和交互函数
     */
    
    // 添加词云图标签样式
    const style = document.createElement('style');
    style.textContent = `
        /* 词云图标签样式 */
        .wordcloud-tabs {
            display: flex;
            gap: 10px;
            margin-bottom: 15px;
            flex-wrap: wrap;
            justify-content: center;
        }
        
        .wordcloud-tab {
            padding: 8px 16px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background: #f8f9fa;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 14px;
            font-weight: 500;
        }
        
        .wordcloud-tab:hover {
            background: #e3f2fd;
            border-color: #3498db;
        }
        
        .wordcloud-tab.active {
            background: #3498db;
            color: white;
            border-color: #3498db;
            box-shadow: 0 2px 4px rgba(52, 152, 219, 0.3);
        }
        
        .wordcloud-tab-content {
            flex: 1;
            min-height: 200px;
            position: relative;
            border: 1px solid #e0e0e0;
            border-radius: 6px;
            background: white;
            overflow: hidden;
        }
        
        .wordcloud-tab-pane {
            width: 100%;
            height: 100%;
        }
        
        /* 深色主题适配 */
        [data-theme="dark"] .wordcloud-tab {
            border: 1px solid var(--border-color);
            background: var(--hover-bg);
            color: var(--text-primary);
        }
        
        [data-theme="dark"] .wordcloud-tab:hover {
            background: var(--card-bg);
            border-color: #3498db;
        }
        
        [data-theme="dark"] .wordcloud-tab.active {
            background: #3498db;
            color: white;
            border-color: #3498db;
            box-shadow: 0 2px 4px rgba(52, 152, 219, 0.3);
        }
        
        [data-theme="dark"] .wordcloud-tab-content {
            border: 1px solid var(--border-color);
            background: var(--card-bg);
        }
        
        /* 图表容器样式 */
        .chart-box {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: #f9f9f9;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
            display: flex;
            flex-direction: column;
        }
        
        /* 图表标题样式 */
        .chart-box h4,
        .wordcloud-card h4 {
            margin-top: 0;
            margin-bottom: 15px;
            font-size: 16px;
            color: #333;
            text-align: center;
            padding-bottom: 10px;
            border-bottom: 1px solid #e0e0e0;
            flex-shrink: 0;
        }
        
        /* 图表内容区域样式 */
        .chart-content {
            height: 250px;
            flex: 1;
        }
        
        /* 词云图容器样式 */
        .wordcloud-container {
            width: 100%;
            height: 100%;
        }
        
        /* 响应式调整 */
        @media (max-width: 768px) {
            .wordcloud-tabs {
                flex-direction: column;
                align-items: center;
            }
            
            .wordcloud-tab {
                width: 100%;
                max-width: 200px;
                text-align: center;
            }
            
            .wordcloud-tab-content {
                min-height: 180px;
            }
            
            .chart-box {
                padding: 12px;
                margin-bottom: 15px;
            }
            
            .chart-box h4,
            .wordcloud-card h4 {
                font-size: 14px;
                margin-bottom: 12px;
            }
        }
    `;
    document.head.appendChild(style);
});
