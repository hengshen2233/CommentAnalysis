/**
 * 关键词分析页面JavaScript代码
 * 功能：处理关键词分析请求、数据展示、图表生成等
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
    const numTopicsInput = document.getElementById('numTopics'); // 主题数量输入框
    const topNInput = document.getElementById('topN'); // 每个主题的关键词数量输入框
    const exportBtn = document.getElementById('exportBtn'); // 导出按钮
    const keywordSearch = document.getElementById('keywordSearch'); // 关键词搜索框
    const refreshWordCloud = document.getElementById('refreshWordCloud'); // 刷新词云按钮
    const topicSelect = document.getElementById('topicSelect'); // 主题选择下拉框

    // 分页相关变量
    let currentPage = 1; // 当前页码
    const pageSize = 10; // 每页显示的关键词数量
    let allKeywords = []; // 所有关键词数据
    let filteredKeywords = []; // 过滤后的关键词数据

    // 模态框相关变量
    const topicModal = document.getElementById('topicModal'); // 主题详情模态框
    const closeModal = document.getElementById('closeModal'); // 关闭模态框按钮
    const closeModalBtn = document.getElementById('closeModalBtn'); // 关闭模态框按钮
    const posFilter = document.getElementById('posFilter'); // 词性过滤器

    // 存储图表实例
    const charts = {
        topicDistribution: null, // 主题分布饼图
        topicTrend: null, // 主题趋势折线图
        wordCloud: null, // 词云图
        heatmap: null, // 主题-关键词热力图
        topicNetwork: null, // 主题关联网络图
        keywordInfluence: null // 关键词影响力评估图
    };

    // 存储LDA分析结果
    let ldaResults = null;

    /**
     * 事件监听器和初始化部分
     */
    
    // 初始化自定义下拉框
    function initCustomSelect() {
        const options = datasetSelect.querySelectorAll('option');
        customSelectOptions.innerHTML = '';

        options.forEach((option, index) => {
            if (option.value !== '') {
                const div = document.createElement('div');
                div.className = 'select-option';
                div.textContent = option.textContent;
                div.dataset.value = option.value;

                div.addEventListener('click', function () {
                    datasetSelect.value = this.dataset.value;
                    datasetSelect.dispatchEvent(new Event('change'));
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

    // 显示自定义下拉选项
    function showCustomOptions() {
        customSelectOptions.classList.add('show');
        // 滚动到选中的选项
        const selectedOption = customSelectOptions.querySelector(`[data-value="${datasetSelect.value}"]`);
        if (selectedOption) {
            selectedOption.scrollIntoView({block: 'nearest'});
            selectedOption.classList.add('selected');
        }
    }

    // 隐藏自定义下拉选项
    function hideCustomOptions() {
        customSelectOptions.classList.remove('show');
    }

    // 点击选择框显示自定义下拉
    datasetSelect.addEventListener('click', function (e) {
        e.stopPropagation();
        if (customSelectOptions.classList.contains('show')) {
            hideCustomOptions();
        } else {
            showCustomOptions();
        }
    });

    // 点击选择框时阻止默认行为
    datasetSelect.addEventListener('mousedown', function (e) {
        e.preventDefault();
    });

    // 点击页面其他地方隐藏下拉
    document.addEventListener('click', function (e) {
        if (!datasetSelect.contains(e.target) && !customSelectOptions.contains(e.target)) {
            hideCustomOptions();
        }
    });

    // 键盘导航
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

    // 初始化自定义下拉框
    initCustomSelect();

    // 初始化参数显示
    function initParamsDisplay() {
        // 确保参数值能够动态更新
        window.updateParams = function(numTopicsValue, topNValue) {
            const numTopics = document.getElementById('numTopics');
            const topN = document.getElementById('topN');

            if (numTopics && numTopicsValue !== undefined) {
                numTopics.value = numTopicsValue;
            }

            if (topN && topNValue !== undefined) {
                topN.value = topNValue;
            }
        };
    }

    // 初始化模态框事件
    function initModalEvents() {
        // 关闭模态框
        closeModal.addEventListener('click', function() {
            topicModal.classList.remove('show');
        });

        closeModalBtn.addEventListener('click', function() {
            topicModal.classList.remove('show');
        });

        // 点击模态框外部关闭
        topicModal.addEventListener('click', function(e) {
            if (e.target === topicModal) {
                topicModal.classList.remove('show');
            }
        });
    }

    // 显示主题详情
    function showTopicDetails(topic) {
        const coreKeywords = topic.keywords.slice(0, 3).map(k => k.word).join(' - ');
        document.getElementById('modalTitle').textContent = `${coreKeywords} (主题${topic.topic_id + 1}) 详情`;
        document.getElementById('topicWeight').textContent = topic.weight.toFixed(4);
        document.getElementById('topicKeywordCount').textContent = topic.keywords.length;

        const keywordsList = document.getElementById('topicKeywordsList');
        keywordsList.innerHTML = '';

        topic.keywords.forEach(keyword => {
            const tag = document.createElement('span');
            tag.className = 'keyword-tag';
            tag.innerHTML = `${keyword.word}<span class="weight">${keyword.weight.toFixed(3)}</span>`;
            keywordsList.appendChild(tag);
        });

        topicModal.classList.add('show');
    }

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

    // 初始化事件
    initModalEvents();
    initParamsDisplay();

    // 生成商业洞察
    function generateInsights() {
        try {
            console.log('开始生成商业洞察');

            if (!ldaResults) {
                console.error('商业洞察分析失败：ldaResults不存在');
                showError('请先分析数据');
                return;
            }

            const insightsLoader = document.getElementById('insightsLoader');
            const insightsResults = document.getElementById('insightsResults');

            if (!insightsLoader || !insightsResults) {
                console.error('商业洞察分析失败：DOM元素不存在');
                showError('页面元素加载失败，请刷新页面重试');
                return;
            }

            console.log('显示加载动画');
            // 显示加载动画
            insightsLoader.classList.remove('hidden');
            insightsResults.classList.add('hidden');

            // 模拟分析过程
            setTimeout(function() {
                try {
                    console.log('开始分析数据');

                    // 检查ldaResults数据结构
                    console.log('ldaResults结构:', {
                        hasTopics: Array.isArray(ldaResults.topics),
                        hasKeywords: Array.isArray(ldaResults.keywords),
                        topicsLength: ldaResults.topics ? ldaResults.topics.length : 0,
                        keywordsLength: ldaResults.keywords ? ldaResults.keywords.length : 0
                    });

                    // 主题分布分析
                    const topicDistributionInsight = document.getElementById('topicDistributionInsight');
                    if (!topicDistributionInsight) {
                        throw new Error('topicDistributionInsight元素不存在');
                    }

                    if (!ldaResults.topics || !Array.isArray(ldaResults.topics) || ldaResults.topics.length === 0) {
                        throw new Error('主题数据不存在');
                    }

                    const topTopics = ldaResults.topics.sort(function(a, b) {
                        return (b.weight || 0) - (a.weight || 0);
                    });
                    const dominantTopic = topTopics[0];
                    if (!dominantTopic || !dominantTopic.keywords || !Array.isArray(dominantTopic.keywords)) {
                        throw new Error('主题数据结构不正确');
                    }

                    const topTopicKeywords = dominantTopic.keywords.slice(0, 3).map(function(k) {
                        return k.word;
                    }).join('、');
                    topicDistributionInsight.textContent = '主题 ' + ((dominantTopic.topic_id || 0) + 1) + ' 是主要主题，占比 ' + (((dominantTopic.weight || 0) * 100).toFixed(1)) + '%，核心关键词包括：' + topTopicKeywords + '。这表明用户主要关注该主题相关内容。';

                    // 核心关键词分析
                    const coreKeywordsInsight = document.getElementById('coreKeywordsInsight');
                    if (!coreKeywordsInsight) {
                        throw new Error('coreKeywordsInsight元素不存在');
                    }

                    if (!ldaResults.keywords || !Array.isArray(ldaResults.keywords) || ldaResults.keywords.length === 0) {
                        throw new Error('关键词数据不存在');
                    }

                    const topKeywords = ldaResults.keywords.slice(0, 5).map(function(k) {
                        return k.word;
                    }).join('、');
                    coreKeywordsInsight.textContent = '核心关键词包括：' + topKeywords + '。这些关键词具有较高的权重，反映了用户最关心的内容。建议重点关注这些关键词相关的产品或服务。';

                    // 主题关联分析
                    const topicRelationInsight = document.getElementById('topicRelationInsight');
                    if (!topicRelationInsight) {
                        throw new Error('topicRelationInsight元素不存在');
                    }

                    const topics = ldaResults.topics;
                    let relationInsight = '通过主题关联分析，发现：';

                    if (topics.length > 1) {
                        // 计算主题间的关联性
                        const topicKeywords = topics.map(function(topic) {
                            return topic.keywords && Array.isArray(topic.keywords) ? topic.keywords.map(function(k) {
                                return k.word;
                            }) : [];
                        });
                        const similarities = [];

                        for (var i = 0; i < topics.length; i++) {
                            for (var j = i + 1; j < topics.length; j++) {
                                // 兼容不支持Set的浏览器
                                function getIntersection(set1, set2) {
                                    var intersection = [];
                                    for (var item in set1) {
                                        if (set2.hasOwnProperty(item)) {
                                            intersection.push(item);
                                        }
                                    }
                                    return intersection;
                                }

                                function getUnion(set1, set2) {
                                    var union = {};
                                    for (var item in set1) {
                                        union[item] = true;
                                    }
                                    for (var item in set2) {
                                        union[item] = true;
                                    }
                                    return union;
                                }

                                // 使用对象模拟Set
                                var keywords1 = {};
                                for (var m = 0; m < topicKeywords[i].length; m++) {
                                    keywords1[topicKeywords[i][m]] = true;
                                }

                                var keywords2 = {};
                                for (var n = 0; n < topicKeywords[j].length; n++) {
                                    keywords2[topicKeywords[j][n]] = true;
                                }

                                var intersection = getIntersection(keywords1, keywords2);
                                var union = getUnion(keywords1, keywords2);
                                var unionSize = 0;
                                for (var key in union) {
                                    unionSize++;
                                }
                                var similarity = unionSize > 0 ? intersection.length / unionSize : 0;
                                similarities.push({ pair: [i, j], similarity: similarity });
                            }
                        }

                        // 找出最相关的主题对
                        similarities.sort(function(a, b) {
                            return b.similarity - a.similarity;
                        });
                        const topSimilarities = similarities.slice(0, 2);

                        if (topSimilarities.length > 0 && topSimilarities[0].similarity > 0.1) {
                            const topPair = topSimilarities[0].pair;
                            relationInsight += '主题 ' + (topPair[0] + 1) + ' 和主题 ' + (topPair[1] + 1) + ' 存在较强的关联性（相似度：' + ((topSimilarities[0].similarity * 100).toFixed(1)) + '%），建议将这两个主题整合处理，提供更全面的解决方案。';
                        } else {
                            relationInsight += '各主题相对独立，建议针对每个主题分别制定策略，满足不同用户群体的需求。';
                        }
                    } else {
                        relationInsight += '当前数据集中主题较为单一，建议扩展产品或服务范围，满足更多用户需求。';
                    }
                    topicRelationInsight.textContent = relationInsight;

                    // 商业建议
                    const businessSuggestions = document.getElementById('businessSuggestions');
                    if (!businessSuggestions) {
                        throw new Error('businessSuggestions元素不存在');
                    }

                    // 生成个性化商业建议
                    let suggestions = '基于分析结果，建议：';

                    // 基于主要主题的建议
                    if (dominantTopic) {
                        suggestions += '1. 重点优化与主题 ' + ((dominantTopic.topic_id || 0) + 1) + ' 相关的产品功能，该主题占比 ' + (((dominantTopic.weight || 0) * 100).toFixed(1)) + '%，是用户最关注的内容；';
                    } else {
                        suggestions += '1. 加强主题分析，明确用户关注点；';
                    }

                    // 基于核心关键词的建议
                    if (ldaResults.keywords && Array.isArray(ldaResults.keywords)) {
                        const topCoreKeywords = ldaResults.keywords.slice(0, 3).map(function(k) {
                            return k.word;
                        }).join('、');
                        suggestions += '2. 针对核心关键词 ' + topCoreKeywords + ' 进行内容营销，提高品牌知名度；';
                    } else {
                        suggestions += '2. 加强关键词分析，提高内容营销效果；';
                    }

                    // 基于主题数量的建议
                    if (ldaResults.topics && Array.isArray(ldaResults.topics)) {
                        if (ldaResults.topics.length > 3) {
                            suggestions += '3. 主题分布较为分散，建议梳理核心业务，强化品牌定位；';
                        } else if (ldaResults.topics.length === 1) {
                            suggestions += '3. 主题过于集中，建议扩展产品或服务范围，满足更多用户需求；';
                        } else {
                            suggestions += '3. 主题分布较为合理，建议保持当前业务重点并适度拓展；';
                        }
                    } else {
                        suggestions += '3. 优化主题分析，明确业务重点；';
                    }

                    // 基于关键词频率的建议
                    if (ldaResults.keywords && Array.isArray(ldaResults.keywords)) {
                        const highFreqKeywords = ldaResults.keywords.filter(function(k) {
                            return k.freq > 100;
                        }).slice(0, 3).map(function(k) {
                            return k.word;
                        }).join('、');
                        if (highFreqKeywords) {
                            suggestions += '4. 高频关键词 ' + highFreqKeywords + ' 反映了用户的核心关注点，建议重点关注这些方向；';
                        } else {
                            suggestions += '4. 关注用户反馈，持续改进产品或服务质量；';
                        }
                    } else {
                        suggestions += '4. 关注用户反馈，持续改进产品或服务质量；';
                    }

                    // 长期策略建议
                    suggestions += '5. 建立定期分析机制，跟踪主题趋势变化，及时调整业务策略。';

                    businessSuggestions.textContent = suggestions;

                    console.log('分析完成，显示结果');
                    // 隐藏加载动画，显示结果
                    insightsLoader.classList.add('hidden');
                    insightsResults.classList.remove('hidden');
                } catch (error) {
                    console.error('商业洞察分析失败:', error);
                    showError('商业洞察分析失败，请重试');
                    // 确保隐藏加载动画
                    if (insightsLoader) {
                        insightsLoader.classList.add('hidden');
                    }
                    if (insightsResults) {
                        insightsResults.classList.remove('hidden');
                    }
                    // 显示错误状态的洞察内容
                    const topicDistributionInsight = document.getElementById('topicDistributionInsight');
                    const coreKeywordsInsight = document.getElementById('coreKeywordsInsight');
                    const topicRelationInsight = document.getElementById('topicRelationInsight');
                    const businessSuggestions = document.getElementById('businessSuggestions');

                    if (topicDistributionInsight) {
                        topicDistributionInsight.textContent = '分析失败，请重试';
                    }
                    if (coreKeywordsInsight) {
                        coreKeywordsInsight.textContent = '分析失败，请重试';
                    }
                    if (topicRelationInsight) {
                        topicRelationInsight.textContent = '分析失败，请重试';
                    }
                    if (businessSuggestions) {
                        businessSuggestions.textContent = '分析失败，请重试';
                    }
                }
            }, 1500);
        } catch (error) {
            console.error('商业洞察函数执行失败:', error);
            showError('系统错误，请刷新页面重试');
            // 确保隐藏加载动画
            const insightsLoader = document.getElementById('insightsLoader');
            if (insightsLoader) {
                insightsLoader.classList.add('hidden');
            }
            const insightsResults = document.getElementById('insightsResults');
            if (insightsResults) {
                insightsResults.classList.remove('hidden');
            }
            // 显示错误状态的洞察内容
            const topicDistributionInsight = document.getElementById('topicDistributionInsight');
            const coreKeywordsInsight = document.getElementById('coreKeywordsInsight');
            const topicRelationInsight = document.getElementById('topicRelationInsight');
            const businessSuggestions = document.getElementById('businessSuggestions');

            if (topicDistributionInsight) {
                topicDistributionInsight.textContent = '分析失败，请重试';
            }
            if (coreKeywordsInsight) {
                coreKeywordsInsight.textContent = '分析失败，请重试';
            }
            if (topicRelationInsight) {
                topicRelationInsight.textContent = '分析失败，请重试';
            }
            if (businessSuggestions) {
                businessSuggestions.textContent = '分析失败，请重试';
            }
        }
    }

    // 生成洞察按钮点击事件
    const generateInsightsBtn = document.getElementById('generateInsightsBtn');
    if (generateInsightsBtn) {
        generateInsightsBtn.addEventListener('click', generateInsights);
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
            // 发送关键词分析请求
            const response = await fetch('/keywords/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken')
                },
                body: JSON.stringify({
                    dataset_name: datasetName,
                    algorithm: 'lda',
                    num_topics: parseInt(numTopicsInput.value) || 5,
                    top_n: parseInt(topNInput.value) || 50
                })
            });

            const data = await response.json();
            if (data.status === 'success') {
                // 存储LDA分析结果
                ldaResults = data;

                // 触发样式布局切换
                welcomeSection.classList.add('hidden');
                toolbar.classList.add('has-results');

                loading.classList.add('hidden');
                resultsArea.classList.remove('hidden');
                window.scrollTo({top: 0, behavior: 'smooth'});

                // 等待布局稳定后再执行渲染逻辑
                setTimeout(() => {
                    renderResults(data);
                }, 100);
            } else {
                showError(data.msg || "分析失败");
                loading.classList.add('hidden');
            }
        } catch (error) {
            console.error(error);
            showError("网络错误，请稍后重试");
            loading.classList.add('hidden');
        }
    });

    /**
     * 关键词分析相关函数
     */
    
    // 渲染分析结果
    function renderResults(data) {
        // 1. 更新指标
        document.getElementById('totalComments').innerText = data.metrics.total_comments; // 总评论数
        document.getElementById('totalKeywords').innerText = data.metrics.total_keywords; // 总关键词数
        document.getElementById('topKeyword').innerText = data.metrics.top_keyword || '--'; // 顶级关键词
        document.getElementById('avgFreq').innerText = data.metrics.avg_freq || '--'; // 平均词频

        // 2. 存储关键词数据
        allKeywords = data.keywords || []; // 所有关键词数据
        filteredKeywords = [...allKeywords]; // 过滤后的关键词数据

        // 3. 更新主题选择下拉框
        updateTopicSelect(data.topics);

        // 4. 渲染图表
        initTopicDistributionChart(data.topic_distribution); // 主题分布饼图
        initTopicTrendChart(data.topic_trend); // 主题趋势折线图
        initTopicKeywordHeatmap(data.topics); // 主题-关键词热力图
        initWordCloud(data.word_cloud); // 词云图
        initTopicNetworkChart(data.topics); // 主题关联网络图
        initKeywordInfluenceChart(data.keywords); // 关键词影响力评估图

        // 5. 渲染表格
        renderTable(); // 关键词表格
    }

    // 更新主题选择下拉框
    function updateTopicSelect(topics) {
        topicSelect.innerHTML = '<option value="all">全部主题</option>';
        topics.forEach((topic, index) => {
            const option = document.createElement('option');
            option.value = index;
            const coreKeywords = topic.keywords.slice(0, 3).map(k => k.word).join(' - ');
            option.textContent = `${coreKeywords} (主题${index + 1})`;
            topicSelect.appendChild(option);
        });

        // 添加主题选择事件
        topicSelect.addEventListener('change', function() {
            const selectedTopic = this.value;
            if (ldaResults) {
                initWordCloud(filterWordCloudByTopic(ldaResults.word_cloud, selectedTopic));
            }
        });
    }

    // 根据主题过滤词云数据
    function filterWordCloudByTopic(wordCloudData, topicId) {
        if (topicId === 'all') {
            return wordCloudData;
        }
        return wordCloudData.filter(item => item.topic === parseInt(topicId));
    }

    /**
     * 图表和词云生成函数
     */
    
    // 主题分布饼图
    function initTopicDistributionChart(topicDistribution) {
        const ctx = document.getElementById('topicDistributionChart').getContext('2d');
        if (charts.topicDistribution) charts.topicDistribution.destroy();

        // 准备饼图标签和数据
        const labels = topicDistribution.map(item => {
            const topic = ldaResults.topics.find(t => t.topic_id === item.topic_id);
            if (topic) {
                const coreKeywords = topic.keywords.slice(0, 2).map(k => k.word).join(' - ');
                return `${coreKeywords} (主题${item.topic_id + 1})`;
            }
            return `主题 ${item.topic_id + 1}`;
        });
        const values = topicDistribution.map(item => item.weight);

        // 生成主题颜色
        const colors = generateTopicColors(topicDistribution.length);

        // 创建饼图
        charts.topicDistribution = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors,
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            padding: 15,
                            font: {
                                size: 12
                            },
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.raw || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${label}: ${percentage}%`;
                            }
                        }
                    }
                },
                onClick: function(event, elements) {
                    if (elements.length > 0) {
                        const index = elements[0].index;
                        const topicId = topicDistribution[index].topic_id;
                        const topic = ldaResults.topics.find(t => t.topic_id === topicId);
                        if (topic) {
                            showTopicDetails(topic);
                        }
                    }
                }
            }
        });
    }

    // 主题趋势折线图
    function initTopicTrendChart(topicTrend) {
        const ctx = document.getElementById('topicTrendChart').getContext('2d');
        if (charts.topicTrend) charts.topicTrend.destroy();

        // 创建折线图
        charts.topicTrend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: topicTrend.labels,
                datasets: topicTrend.datasets.map((dataset, index) => {
                    // 从ldaResults中获取主题信息
                    const topic = ldaResults.topics.find(t => t.topic_id === dataset.topic_id);
                    let label = `主题 ${dataset.topic_id + 1}`;
                    if (topic) {
                        const coreKeywords = topic.keywords.slice(0, 2).map(k => k.word).join(' - ');
                        label = `${coreKeywords} (主题${dataset.topic_id + 1})`;
                    }
                    return {
                        label: label,
                        data: dataset.data,
                        borderColor: generateTopicColors(topicTrend.datasets.length)[index],
                        backgroundColor: generateTopicColors(topicTrend.datasets.length, 0.1)[index],
                        borderWidth: 2,
                        tension: 0.4,
                        fill: false,
                        pointRadius: 4,
                        pointHoverRadius: 6
                    };
                })
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                        labels: {
                            boxWidth: 12,
                            padding: 10,
                            font: {
                                size: 11
                            },
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
                        title: {
                            display: true,
                            text: '主题权重',
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: '时间',
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        }
                    }
                }
            }
        });
    }

    // 主题-关键词热力图
    function initTopicKeywordHeatmap(topics) {
        try {
            const container = document.getElementById('topicKeywordHeatmap');

            // 确保容器存在
            if (!container) {
                console.error('主题-关键词热力图容器不存在');
                return;
            }

            // 确保容器有明确尺寸
            if (!container.style.height || container.style.height === '0px') {
                container.style.height = '350px';
            }

            if (charts.heatmap) {
                charts.heatmap.dispose();
            }

            // 检测当前主题
            const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
            
            charts.heatmap = echarts.init(container);

            // 准备热力图数据
            const keywords = new Set();
            topics.forEach(topic => {
                topic.keywords.forEach(keyword => {
                    keywords.add(keyword.word);
                });
            });

            const keywordList = Array.from(keywords).slice(0, 15); // 取前15个关键词
            const data = [];

            topics.forEach((topic, topicIndex) => {
                keywordList.forEach((keyword, keywordIndex) => {
                    const topicKeyword = topic.keywords.find(kw => kw.word === keyword);
                    const value = topicKeyword ? topicKeyword.weight : 0;
                    data.push([keywordIndex, topicIndex, value]);
                });
            });

            const option = {
                tooltip: {
                    position: 'top',
                    formatter: function(params) {
                        const topic = topics[params.value[1]];
                        const coreKeywords = topic.keywords.slice(0, 2).map(k => k.word).join(' - ');
                        return `${coreKeywords} (主题${params.value[1] + 1})<br/>关键词: ${keywordList[params.value[0]]}<br/>权重: ${params.value[2].toFixed(4)}`;
                    },
                    backgroundColor: isDarkTheme ? '#333' : 'rgba(255, 255, 255, 0.9)',
                    textStyle: {
                        color: isDarkTheme ? '#bdc3c7' : '#333'
                    }
                },
                grid: {
                    height: '60%',
                    top: '10%'
                },
                xAxis: {
                    type: 'category',
                    data: keywordList,
                    splitArea: {
                        show: true,
                        areaStyle: {
                            color: isDarkTheme ? ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.1)'] : ['rgba(0, 0, 0, 0.05)', 'rgba(0, 0, 0, 0.1)']
                        }
                    },
                    axisLabel: {
                        rotate: 45,
                        interval: 0,
                        fontSize: 10,
                        color: isDarkTheme ? '#bdc3c7' : '#333'
                    },
                    axisLine: {
                        lineStyle: {
                            color: isDarkTheme ? '#bdc3c7' : '#333'
                        }
                    }
                },
                yAxis: {
                    type: 'category',
                    data: topics.map((topic, index) => {
                        const coreKeywords = topic.keywords.slice(0, 2).map(k => k.word).join(' - ');
                        return `${coreKeywords} (主题${index + 1})`;
                    }),
                    splitArea: {
                        show: true,
                        areaStyle: {
                            color: isDarkTheme ? ['rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.1)'] : ['rgba(0, 0, 0, 0.05)', 'rgba(0, 0, 0, 0.1)']
                        }
                    },
                    axisLabel: {
                        color: isDarkTheme ? '#bdc3c7' : '#333'
                    },
                    axisLine: {
                        lineStyle: {
                            color: isDarkTheme ? '#bdc3c7' : '#333'
                        }
                    }
                },
                visualMap: {
                    min: 0,
                    max: 1,
                    calculable: true,
                    orient: 'horizontal',
                    left: 'center',
                    bottom: '5%',
                    inRange: {
                        color: isDarkTheme ? ['#1a237e', '#283593', '#303f9f', '#3949ab', '#3f51b5', '#536dfe'] : ['#e0f2f1', '#b2dfdb', '#80cbc4', '#4db6ac', '#26a69a', '#009688']
                    },
                    textStyle: {
                        color: isDarkTheme ? '#bdc3c7' : '#333'
                    }
                },
                series: [{
                    name: '主题-关键词权重',
                    type: 'heatmap',
                    data: data,
                    label: {
                        show: false
                    },
                    emphasis: {
                        itemStyle: {
                            shadowBlur: 10,
                            shadowColor: isDarkTheme ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'
                        }
                    }
                }]
            };

            charts.heatmap.setOption(option);
            // 确保图表适应容器尺寸
            charts.heatmap.resize();
            console.log('主题-关键词热力图初始化成功');
        } catch (error) {
            console.error('主题-关键词热力图初始化失败:', error);
        }
    }

    // 生成主题颜色
    function generateTopicColors(count, alpha = 1) {
        const baseColors = [
            `rgba(155, 89, 182, ${alpha})`,
            `rgba(52, 152, 219, ${alpha})`,
            `rgba(231, 76, 60, ${alpha})`,
            `rgba(46, 204, 113, ${alpha})`,
            `rgba(243, 156, 18, ${alpha})`,
            `rgba(142, 68, 173, ${alpha})`,
            `rgba(41, 128, 185, ${alpha})`,
            `rgba(192, 57, 43, ${alpha})`,
            `rgba(39, 174, 96, ${alpha})`,
            `rgba(214, 137, 16, ${alpha})`
        ];

        const colors = [];
        for (let i = 0; i < count; i++) {
            colors.push(baseColors[i % baseColors.length]);
        }
        return colors;
    }

    // 主题关联网络图
    function initTopicNetworkChart(topics) {
        try {
            const container = document.getElementById('topicNetworkChart');

            // 确保容器存在
            if (!container) {
                console.error('主题关联网络图容器不存在');
                return;
            }

            // 确保容器有明确尺寸
            if (!container.style.height || container.style.height === '0px') {
                container.style.height = '350px';
            }

            if (charts.topicNetwork) {
                charts.topicNetwork.dispose();
            }

            // 检测当前主题
            const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
            
            charts.topicNetwork = echarts.init(container);

            // 准备网络数据
            const nodes = topics.map((topic, index) => {
                const coreKeywords = topic.keywords.slice(0, 2).map(k => k.word).join(' - ');
                const nodeName = `${coreKeywords} (主题${index + 1})`;
                return {
                    id: index,
                    name: nodeName,
                    symbolSize: Math.sqrt(topic.weight) * 50 + 20,
                    value: topic.weight,
                    category: 0,
                    label: {
                        show: true,
                        formatter: nodeName,
                        color: isDarkTheme ? '#bdc3c7' : '#333'
                    }
                };
            });

            // 生成主题间的关联边
            const links = [];
            for (let i = 0; i < topics.length; i++) {
                for (let j = i + 1; j < topics.length; j++) {
                    // 计算主题间的相似度（基于关键词重叠）
                    const keywords1 = new Set(topics[i].keywords.map(k => k.word));
                    const keywords2 = new Set(topics[j].keywords.map(k => k.word));
                    const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
                    const similarity = intersection.size / Math.max(keywords1.size, keywords2.size);

                    if (similarity > 0.1) { // 只显示相似度大于0.1的关联
                        links.push({
                            source: i,
                            target: j,
                            value: similarity,
                            lineStyle: {
                                width: similarity * 5,
                                opacity: 0.6,
                                color: isDarkTheme ? '#bdc3c7' : '#333'
                            }
                        });
                    }
                }
            }

            const option = {
                tooltip: {
                    formatter: function(params) {
                        if (params.dataType === 'node') {
                            return `${params.name}<br/>权重: ${params.data.value.toFixed(4)}`;
                        } else if (params.dataType === 'edge') {
                            return `关联强度: ${params.data.value.toFixed(4)}`;
                        }
                    },
                    backgroundColor: isDarkTheme ? '#333' : 'rgba(255, 255, 255, 0.9)',
                    textStyle: {
                        color: isDarkTheme ? '#bdc3c7' : '#333'
                    }
                },
                animationDuration: 1500,
                animationEasingUpdate: 'quinticInOut',
                series: [{
                    type: 'graph',
                    layout: 'force',
                    data: nodes,
                    links: links,
                    categories: [{
                        name: '主题'
                    }],
                    roam: true,
                    label: {
                        show: true,
                        position: 'right',
                        formatter: '{b}',
                        color: isDarkTheme ? '#bdc3c7' : '#333'
                    },
                    labelLayout: {
                        hideOverlap: true
                    },
                    scaleLimit: {
                        min: 0.4,
                        max: 2
                    },
                    lineStyle: {
                        color: isDarkTheme ? '#bdc3c7' : 'source',
                        curveness: 0.3,
                        opacity: 0.6
                    },
                    emphasis: {
                        focus: 'adjacency',
                        lineStyle: {
                            width: 10,
                            color: isDarkTheme ? '#bdc3c7' : '#333'
                        },
                        label: {
                            color: isDarkTheme ? '#bdc3c7' : '#333'
                        }
                    },
                    force: {
                        repulsion: 1000,
                        edgeLength: [100, 200]
                    }
                }]
            };

            charts.topicNetwork.setOption(option);
            // 确保图表适应容器尺寸
            charts.topicNetwork.resize();
            console.log('主题关联网络图初始化成功');
        } catch (error) {
            console.error('主题关联网络图初始化失败:', error);
        }
    }

    // 关键词影响力评估图
    function initKeywordInfluenceChart(keywords) {
        const ctx = document.getElementById('keywordInfluenceChart').getContext('2d');
        if (charts.keywordInfluence) charts.keywordInfluence.destroy();

        // 取前15个关键词进行展示
        const topKeywords = keywords.slice(0, 15);
        const labels = topKeywords.map(item => item.word);
        const values = topKeywords.map(item => item.score || item.freq);

        // 创建柱状图
        charts.keywordInfluence = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: '关键词影响力',
                    data: values,
                    backgroundColor: generateTopicColors(topKeywords.length, 0.7),
                    borderColor: generateTopicColors(topKeywords.length),
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        titleColor: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7',
                        bodyColor: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7',
                        callbacks: {
                            label: function(context) {
                                const value = context.raw;
                                return `影响力: ${value.toFixed(4)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.05)'
                        },
                        title: {
                            display: true,
                            text: '影响力得分',
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        },
                        ticks: {
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: '关键词',
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        },
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                            font: {
                                size: 11
                            },
                            color: getComputedStyle(document.documentElement).getPropertyValue('--text-primary') || '#bdc3c7'
                        }
                    }
                }
            }
        });
    }

    // 词云图
    function initWordCloud(words) {
        try {
            const container = document.getElementById('wordCloud');

            // 确保容器存在
            if (!container) {
                console.error('词云图容器不存在');
                return;
            }

            // 确保容器有明确尺寸
            if (!container.style.height || container.style.height === '0px') {
                container.style.height = '400px';
            }

            if (charts.wordCloud) {
                charts.wordCloud.dispose();
            }

            // 检测当前主题
            const isDarkTheme = document.documentElement.getAttribute('data-theme') === 'dark';
            
            charts.wordCloud = echarts.init(container);

            const option = {
                tooltip: {
                    show: true,
                    formatter: function (params) {
                        const wordData = words.find(item => item.word === params.name);
                        if (wordData) {
                            return `关键词: ${params.name}<br/>权重: ${wordData.weight ? wordData.weight.toFixed(4) : wordData.freq}<br/>主题: ${wordData.topic !== undefined ? `主题 ${wordData.topic + 1}` : '全部'}`;
                        }
                        return `${params.name}: ${params.value}`;
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
                    sizeRange: [12, 60],
                    rotationRange: [0, 0],
                    gridSize: 15,
                    drawOutOfBound: false,
                    textStyle: {
                        fontFamily: 'Microsoft YaHei, sans-serif',
                        fontWeight: 'bold',
                        color: function (params) {
                            // 根据主题分配颜色
                            if (params.data.topic !== undefined) {
                                return generateTopicColors(10)[params.data.topic % 10];
                            }
                            // 随机颜色
                            const colors = isDarkTheme ? [
                                '#2575fc', '#1a5fcc', '#3498db', '#2980b9',
                                '#e74c3c', '#c0392b', '#2ecc71', '#27ae60',
                                '#f39c12', '#d68910', '#1abc9c', '#16a085'
                            ] : [
                                '#2575fc', '#1a5fcc', '#3498db', '#2980b9',
                                '#e74c3c', '#c0392b', '#2ecc71', '#27ae60',
                                '#f39c12', '#d68910', '#1abc9c', '#16a085'
                            ];
                            return colors[Math.floor(Math.random() * colors.length)];
                        }
                    },
                    emphasis: {
                        focus: 'self',
                        textStyle: {
                            shadowBlur: 10,
                            shadowColor: isDarkTheme ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)'
                        }
                    },
                    data: words.map(item => ({
                        name: item.word,
                        value: item.weight || item.freq,
                        topic: item.topic
                    }))
                }]
            };

            charts.wordCloud.setOption(option);
            // 确保图表适应容器尺寸
            charts.wordCloud.resize();
            console.log('词云图初始化成功');

            // 点击词云中的词，搜索该关键词
            charts.wordCloud.on('click', function (params) {
                keywordSearch.value = params.name;
                filterKeywords();
            });
        } catch (error) {
            console.error('词云图初始化失败:', error);
        }
    }

    // 刷新词云
    refreshWordCloud.addEventListener('click', function () {
        if (charts.wordCloud) {
            charts.wordCloud.resize();
        }
    });

    /**
     * UI更新和交互函数
     */
    
    // 渲染关键词表格
    function renderTable() {
        const tbody = document.getElementById('keywordsTableBody');
        tbody.innerHTML = '';

        // 计算分页范围
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const pageData = filteredKeywords.slice(start, end);

        // 渲染表格行
        pageData.forEach((item, index) => {
            const row = document.createElement('tr');
            const rank = start + index + 1;
            const rankClass = rank <= 3 ? 'rank top3' : 'rank';

            row.innerHTML = `
                <td class="${rankClass}">${rank}</td>
                <td class="keyword">${item.word}</td>
                <td>${item.freq}</td>
                <td>${item.score ? item.score.toFixed(4) : '-'}</td>
                <td><span class="pos-tag ${getPosClass(item.pos)}">${item.pos || '其他'}</span></td>
                <td>${item.percentage ? item.percentage.toFixed(2) + '%' : '-'}</td>
            `;
            tbody.appendChild(row);
        });

        // 更新分页
        updatePagination();
    }

    // 获取词性样式类
    function getPosClass(pos) {
        if (!pos) return 'other';
        if (pos.includes('名')) return 'noun';
        if (pos.includes('动')) return 'verb';
        if (pos.includes('形容')) return 'adj';
        if (pos.includes('副')) return 'adv';
        return 'other';
    }

    // 更新分页
    function updatePagination() {
        const totalPages = Math.ceil(filteredKeywords.length / pageSize);
        document.getElementById('pageInfo').textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;
        document.getElementById('prevPage').disabled = currentPage <= 1;
        document.getElementById('nextPage').disabled = currentPage >= totalPages;
    }

    // 上一页按钮点击事件
    document.getElementById('prevPage').addEventListener('click', function () {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    // 下一页按钮点击事件
    document.getElementById('nextPage').addEventListener('click', function () {
        const totalPages = Math.ceil(filteredKeywords.length / pageSize);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });

    // 搜索关键词
    function filterKeywords() {
        const searchTerm = keywordSearch.value.toLowerCase().trim();
        const posValue = posFilter.value;

        // 根据搜索词和词性过滤
        filteredKeywords = allKeywords.filter(item => {
            const matchesSearch = searchTerm === '' || item.word.toLowerCase().includes(searchTerm);
            const matchesPos = posValue === 'all' || item.pos === posValue;
            return matchesSearch && matchesPos;
        });

        // 重置到第一页并重新渲染
        currentPage = 1;
        renderTable();
    }

    // 搜索输入事件监听
    keywordSearch.addEventListener('input', filterKeywords);
    // 词性过滤事件监听
    posFilter.addEventListener('change', filterKeywords);

    // 导出功能
    exportBtn.addEventListener('click', function () {
        if (allKeywords.length === 0) {
            showError("没有可导出的数据");
            return;
        }

        // 构建CSV内容
        const headers = ['排名', '关键词', '词频', '权重/得分', '词性', '占比'];
        const rows = allKeywords.map((item, index) => [
            index + 1,
            item.word,
            item.freq,
            item.score ? item.score.toFixed(4) : '-',
            item.pos || '其他',
            item.percentage ? item.percentage.toFixed(2) + '%' : '-'
        ]);

        const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');

        // 添加BOM以支持中文
        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

        // 下载文件
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', `关键词分析结果_${new Date().toLocaleDateString()}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 窗口大小改变时重新调整图表
    window.addEventListener('resize', function () {
        Object.values(charts).forEach(chart => {
            if (chart && chart.resize) {
                chart.resize();
            }
        });
    });

    // 获取CSRF Token
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
