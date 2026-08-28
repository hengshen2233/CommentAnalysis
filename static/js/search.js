/**
 * search.js - 评论搜索页面功能
 * 包含评论搜索、筛选、排序、加载更多和导出功能
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function () {
    // 初始化搜索页面功能
    initSearchPage();
});

/**
 * 初始化搜索页面功能
 */
function initSearchPage() {
    // 全局变量
    let currentPage = 1;
    let totalPages = 1;
    let currentKeyword = '';
    let currentFilters = {};
    let currentSort = {by: 'publishtime', order: 'desc'};
    let isSearching = false;
    let isLoadingMore = false;
    let totalCommentsCount = 0;
    let hasMoreComments = true;
    const perPage = 10; // 每次加载10条评论

    // DOM元素
    const searchBtn = document.getElementById('searchBtn');
    const searchInput = document.getElementById('searchKeyword');
    const resetBtn = document.getElementById('resetBtn');
    const exportAllBtn = document.getElementById('exportAllBtn');
    const commentList = document.getElementById('commentList');
    const resultCount = document.getElementById('resultCount');
    const loadMoreSection = document.getElementById('loadMoreSection');
    const loadMoreSpinner = document.getElementById('loadMoreSpinner');
    const noMoreResults = document.getElementById('noMoreResults');

    // 筛选和排序元素
    const datasetFilter = document.getElementById('datasetFilter');
    const productFilter = document.getElementById('productFilter');
    const datasourceFilter = document.getElementById('datasourceFilter');
    const sentimentFilter = document.getElementById('sentimentFilter');
    const sortBy = document.getElementById('sortBy');
    const sortOrder = document.getElementById('sortOrder');

    // 评论模板
    const commentTemplate = document.getElementById('commentTemplate');

    // 初始化
    initEventListeners();
    // 显示加载更多评论时
    loadMoreSpinner.style.display = 'inline-flex';
    noMoreResults.style.display = 'none';
    // 隐藏加载更多评论时
    loadMoreSpinner.style.display = 'none';
    // 显示已加载所有评论时
    noMoreResults.style.display = 'inline-flex';
    loadMoreSpinner.style.display = 'none';
    loadComments(true); // 初始加载

    /**
     * 初始化事件监听器
     */
    function initEventListeners() {
        // 搜索按钮点击事件
        searchBtn.addEventListener('click', performSearch);

        // 搜索框回车事件
        searchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                performSearch();
            }
        });

        // 重置按钮点击事件
        resetBtn.addEventListener('click', resetFilters);

        // 导出所有结果按钮
        exportAllBtn.addEventListener('click', exportAllComments);

        // 筛选条件变化事件
        datasetFilter.addEventListener('change', function () {
            updateFilterOptions();
        });
        productFilter.addEventListener('change', function () {
            updateFilterOptions();
        });
        datasourceFilter.addEventListener('change', function () {
            updateFilterOptions();
        });
        sentimentFilter.addEventListener('change', applyFilters);

        // 排序条件变化事件
        sortBy.addEventListener('change', function () {
            updateSortOrderOptions();
            applySort();
        });
        sortOrder.addEventListener('change', applySort);

        // 滚动事件监听
        commentList.addEventListener('scroll', handleScroll);

        // 初始化排序选项文本
        updateSortOrderOptions();
    }

    /**
     * 处理滚动事件
     */
    function handleScroll() {
        if (isSearching || isLoadingMore || !hasMoreComments) {
            return;
        }

        // 计算是否滚动到底部（距离底部50px时触发）
        const scrollTop = commentList.scrollTop;
        const scrollHeight = commentList.scrollHeight;
        const clientHeight = commentList.clientHeight;

        if (scrollTop + clientHeight >= scrollHeight - 50) {
            loadMoreComments();
        }
    }

    /**
     * 加载更多评论
     */
    function loadMoreComments() {
        if (isLoadingMore || !hasMoreComments) {
            return;
        }

        isLoadingMore = true;
        currentPage++;

        // 显示加载提示
        loadMoreSpinner.style.display = 'block';
        noMoreResults.style.display = 'none';

        // 构建查询参数
        const params = buildQueryParams();

        fetch(`/search/?${params.toString()}`, {
            method: 'GET', headers: {
                'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                isLoadingMore = false;
                loadMoreSpinner.style.display = 'none';

                if (data.success) {
                    if (data.comments && data.comments.length > 0) {
                        appendComments(data.comments);

                        // 检查是否还有更多评论
                        if (currentPage >= data.total_pages) {
                            hasMoreComments = false;
                            noMoreResults.style.display = 'block';
                        }
                    } else {
                        hasMoreComments = false;
                        noMoreResults.style.display = 'block';
                    }
                } else {
                    showErrorMessage('加载更多评论失败: ' + (data.error || '未知错误'));
                    currentPage--; // 回滚页码
                }
            })
            .catch(error => {
                isLoadingMore = false;
                loadMoreSpinner.style.display = 'none';
                currentPage--; // 回滚页码
                console.error('加载更多评论失败:', error);
            });
    }

    /**
     * 构建查询参数
     */
    function buildQueryParams() {
        const params = new URLSearchParams();
        params.append('page', currentPage);
        params.append('per_page', perPage); // 添加每页数量参数

        if (currentKeyword) {
            params.append('keyword', currentKeyword);
        }

        // 添加筛选参数
        if (currentFilters.dataset) {
            params.append('dataset', currentFilters.dataset);
        }
        if (currentFilters.product) {
            params.append('product', currentFilters.product);
        }
        if (currentFilters.datasource) {
            params.append('datasource', currentFilters.datasource);
        }
        if (currentFilters.sentiment) {
            params.append('sentiment', currentFilters.sentiment);
        }

        // 添加排序参数
        params.append('sort_by', currentSort.by);
        params.append('sort_order', currentSort.order);

        return params;
    }

    /**
     * 更新排序顺序选项文本
     */
    function updateSortOrderOptions() {
        const sortByValue = sortBy.value;
        const currentValue = sortOrder.value;

        // 清空当前选项
        sortOrder.innerHTML = '';

        // 根据排序条件设置选项
        if (sortByValue === 'publishtime') {
            const optionDesc = document.createElement('option');
            optionDesc.value = 'desc';
            optionDesc.textContent = '最新发布';
            sortOrder.appendChild(optionDesc);

            const optionAsc = document.createElement('option');
            optionAsc.value = 'asc';
            optionAsc.textContent = '最久发布';
            sortOrder.appendChild(optionAsc);
        } else if (sortByValue === 'score') {
            const optionDesc = document.createElement('option');
            optionDesc.value = 'desc';
            optionDesc.textContent = '最高评分';
            sortOrder.appendChild(optionDesc);

            const optionAsc = document.createElement('option');
            optionAsc.value = 'asc';
            optionAsc.textContent = '最低评分';
            sortOrder.appendChild(optionAsc);
        }

        // 恢复之前选中的值
        sortOrder.value = currentValue;
    }

    /**
     * 获取筛选选项和状态
     */
    function getFilterOptions(callback) {
        const params = new URLSearchParams();
        params.append('get_filter_options', 'true');

        // 传递当前的筛选条件
        if (currentKeyword) {
            params.append('keyword', currentKeyword);
        }
        if (currentFilters.dataset) {
            params.append('dataset', currentFilters.dataset);
        }
        if (currentFilters.product) {
            params.append('product', currentFilters.product);
        }
        if (currentFilters.datasource) {
            params.append('datasource', currentFilters.datasource);
        }
        if (currentFilters.sentiment) {
            params.append('sentiment', currentFilters.sentiment);
        }

        fetch(`/search/?${params.toString()}`, {
            method: 'GET', headers: {
                'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json'
            }
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    // 更新筛选选项
                    updateSelectOptions(datasetFilter, data.available_datasets, '所有数据集');
                    updateSelectOptions(productFilter, data.available_products, '所有商品');
                    updateSelectOptions(datasourceFilter, data.available_datasources, '所有平台');

                    // 更新禁用状态
                    updateDisabledState(datasetFilter, data.disabled_datasets);
                    updateDisabledState(productFilter, data.disabled_products);
                    updateDisabledState(datasourceFilter, data.disabled_datasources);

                    if (callback) callback();
                } else {
                    console.error('获取筛选选项失败:', data.error);
                    if (callback) callback();
                }
            })
            .catch(error => {
                console.error('获取筛选选项失败:', error);
                if (callback) callback();
            });
    }

    /**
     * 更新筛选选项和状态
     */
    function updateFilterOptions() {
        // 更新当前筛选条件
        currentFilters = {
            dataset: datasetFilter.value,
            product: productFilter.value,
            datasource: datasourceFilter.value,
            sentiment: sentimentFilter.value
        };

        // 获取新筛选选项和状态
        getFilterOptions(function () {
            // 选项和状态更新后，重新加载评论
            resetAndLoadComments();
        });
    }

    /**
     * 更新下拉框选项
     */
    function updateSelectOptions(selectElement, options, defaultText) {
        const currentValue = selectElement.value;

        // 清空选项
        selectElement.innerHTML = '';

        // 添加默认选项
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = defaultText;
        selectElement.appendChild(defaultOption);

        // 添加新的选项
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option;
            optionElement.textContent = option.length > 20 ? option.substring(0, 20) + '...' : option;

            // 如果当前值在新选项中，保持选中
            if (option === currentValue) {
                optionElement.selected = true;
            }
            selectElement.appendChild(optionElement);
        });

        // 如果当前值不在新选项中，选择默认选项
        if (currentValue && !options.includes(currentValue)) {
            selectElement.value = '';
        }
    }

    /**
     * 更新禁用状态
     */
    function updateDisabledState(selectElement, disabled) {
        if (disabled) {
            selectElement.disabled = true;
            selectElement.style.backgroundColor = '#f3f4f6';
            selectElement.style.cursor = 'not-allowed';
        } else {
            selectElement.disabled = false;
            selectElement.style.backgroundColor = '';
            selectElement.style.cursor = '';
        }
    }

    /**
     * 执行搜索
     */
    function performSearch() {
        currentKeyword = searchInput.value.trim();
        resetAndLoadComments();
    }

    /**
     * 应用筛选条件
     */
    function applyFilters() {
        currentFilters = {
            dataset: datasetFilter.value,
            product: productFilter.value,
            datasource: datasourceFilter.value,
            sentiment: sentimentFilter.value
        };
        resetAndLoadComments();
    }

    /**
     * 应用排序条件
     */
    function applySort() {
        currentSort = {
            by: sortBy.value, order: sortOrder.value
        };
        resetAndLoadComments();
    }

    /**
     * 重置并加载评论
     */
    function resetAndLoadComments() {
        currentPage = 1;
        hasMoreComments = true;
        loadMoreSpinner.style.display = 'none';
        noMoreResults.style.display = 'none';
        loadComments(true);
    }

    /**
     * 重置筛选条件
     */
    function resetFilters() {
        // 重置搜索框
        searchInput.value = '';
        currentKeyword = '';

        // 重置筛选条件
        datasetFilter.value = '';
        productFilter.value = '';
        datasourceFilter.value = '';
        sentimentFilter.value = 'all';

        // 重置排序条件
        sortBy.value = 'publishtime';
        sortOrder.value = 'desc';

        // 重置全局变量
        currentFilters = {};
        currentSort = {by: 'publishtime', order: 'desc'};
        currentPage = 1;
        hasMoreComments = true;

        // 更新排序选项文本
        updateSortOrderOptions();

        // 重置选项和状态为初始状态
        getFilterOptions(function () {
            // 重新加载评论
            loadComments(true);
        });
    }

    /**
     * 加载评论
     */
    function loadComments(isInitialLoad = false) {
        if (isSearching) return;

        isSearching = true;
        // 隐藏之前的加载提示
        loadMoreSpinner.style.display = 'none';
        noMoreResults.style.display = 'none';
        if (isInitialLoad) {
            // 显示加载状态
            commentList.innerHTML = `
                <div class="loading-spinner">
                    <i class="fas fa-spinner fa-spin"></i> 正在加载评论...
                </div>
            `;
        }

        // 构建查询参数
        const params = buildQueryParams();

        console.log('Loading comments with params:', params.toString());

        // 发送AJAX请求
        fetch(`/search/?${params.toString()}`, {
            method: 'GET', headers: {
                'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json'
            }
        })
            .then(response => {
                console.log('Response status:', response.status);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                console.log('Received data:', data);
                isSearching = false;

                if (data.success) {
                    if (isInitialLoad) {
                        displayComments(data.comments);
                    } else {
                        appendComments(data.comments);
                    }

                    updateResultCount(data.total);
                    totalCommentsCount = data.total;

                    // 检查是否还有更多评论
                    if (currentPage >= data.total_pages) {
                        hasMoreComments = false;
                        noMoreResults.style.display = 'block';
                        loadMoreSpinner.style.display = 'none';
                    }

                    // 更新筛选选项（从评论加载响应中获取）
                    updateSelectOptions(datasetFilter, data.available_datasets || [], '所有数据集');
                    updateSelectOptions(productFilter, data.available_products || [], '所有商品');
                    updateSelectOptions(datasourceFilter, data.available_datasources || [], '所有平台');

                    // 更新禁用状态
                    updateDisabledState(datasetFilter, data.disabled_datasets || false);
                    updateDisabledState(productFilter, data.disabled_products || false);
                    updateDisabledState(datasourceFilter, data.disabled_datasources || false);
                } else {
                    showErrorMessage('加载评论失败: ' + (data.error || '未知错误'));
                }
            })
            .catch(error => {
                console.error('Fetch error:', error);
                isSearching = false;
                showErrorMessage('网络错误，请稍后重试');
                commentList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-exclamation-circle"></i>
                    <p>加载失败: ${error.message}</p>
                    <p>请检查网络连接后重试</p>
                </div>
            `;
            });
    }

    /**
     * 显示评论
     */
    function displayComments(comments) {
        if (!comments || comments.length === 0) {
            commentList.innerHTML = `
                <div class="no-results">
                    <i class="fas fa-search"></i>
                    <p>没有找到符合条件的评论</p>
                    <p>请尝试修改筛选条件或搜索关键词</p>
                </div>
            `;
            return;
        }

        commentList.innerHTML = '';

        comments.forEach(comment => {
            const commentElement = createCommentElement(comment);
            commentList.appendChild(commentElement);
        });
    }

    /**
     * 追加评论
     */
    function appendComments(comments) {
        if (!comments || comments.length === 0) {
            hasMoreComments = false;
            noMoreResults.style.display = 'block';
            loadMoreSpinner.style.display = 'none';
            return;
        }

        comments.forEach(comment => {
            const commentElement = createCommentElement(comment);
            commentList.appendChild(commentElement);
        });
    }

    /**
     * 创建评论元素
     */
    function createCommentElement(comment) {
        const template = document.importNode(commentTemplate.content, true);
        const commentElement = template.querySelector('.comment-item');

        // 填充所有元信息
        commentElement.querySelector('.comment-nickname').textContent = comment.nickname;
        commentElement.querySelector('.product-name').textContent = comment.product || '未知商品';
        commentElement.querySelector('.dataset-name').textContent = comment.dataset || '未知数据集';
        commentElement.querySelector('.comment-datasource').textContent = comment.datasource;
        commentElement.querySelector('.comment-date').textContent = comment.publishtime;
        commentElement.querySelector('.score-value').textContent = comment.score;

        // 设置情感分类
        const sentimentElement = commentElement.querySelector('.comment-sentiment');
        switch (comment.sentiment) {
            case '好评':
                sentimentElement.className = 'comment-sentiment positive';
                sentimentElement.innerHTML = `<i class="fas fa-smile"></i> 好评 ${comment.sentimentscore}`;
                break;
            case '中评':
                sentimentElement.className = 'comment-sentiment neutral';
                sentimentElement.innerHTML = `<i class="fas fa-meh"></i> 中评 ${comment.sentimentscore}`;
                break;
            case '差评':
                sentimentElement.className = 'comment-sentiment negative';
                sentimentElement.innerHTML = `<i class="fas fa-frown"></i> 差评 ${comment.sentimentscore}`;
                break;
            default:
                sentimentElement.className = 'comment-sentiment sentiment-none';
                sentimentElement.innerHTML = '<i class="fas fa-question-circle"></i> 暂无';
        }

        // 处理评论内容，高亮搜索关键词
        let content = comment.content || '（无评论内容）';
        if (currentKeyword && currentKeyword.trim() !== '') {
            const regex = new RegExp(currentKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
            content = content.replace(regex, match => `<span class="highlight">${match}</span>`);
        }
        commentElement.querySelector('.comment-content').innerHTML = content;

        return commentElement;
    }

    /**
     * 更新结果数量显示
     */
    function updateResultCount(total) {
        if (total === 0) {
            resultCount.textContent = '没有找到相关评论';
        } else {
            resultCount.textContent = `共 ${total} 条评论`;
        }
    }

    /**
     * 导出所有评论
     */
    async function exportAllComments() {
        try {
            // 检查是否有评论可以导出
            if (totalCommentsCount === 0) {
                showErrorMessage('没有评论可以导出');
                return;
            }

            // 显示导出进度提示
            showProgressMessage('正在准备导出数据...');

            // 构建查询参数（导出所有符合条件的评论，不分页）
            const params = new URLSearchParams();
            params.append('export', 'true');

            if (currentKeyword) {
                params.append('keyword', currentKeyword);
            }

            // 添加筛选参数
            if (currentFilters.dataset) {
                params.append('dataset', currentFilters.dataset);
            }
            if (currentFilters.product) {
                params.append('product', currentFilters.product);
            }
            if (currentFilters.datasource) {
                params.append('datasource', currentFilters.datasource);
            }
            if (currentFilters.sentiment) {
                params.append('sentiment', currentFilters.sentiment);
            }

            // 添加排序参数
            params.append('sort_by', currentSort.by);
            params.append('sort_order', currentSort.order);

            // 发送导出请求
            const response = await fetch(`/search/?${params.toString()}`, {
                method: 'GET', headers: {
                    'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`导出失败: ${response.status}`);
            }

            const data = await response.json();

            if (data.success) {
                if (!data.comments || data.comments.length === 0) {
                    showErrorMessage('没有找到符合条件的评论可以导出');
                    return;
                }

                // 创建CSV数据
                const comments = data.comments;
                const headers = ['用户昵称', '评论内容', '发布时间', '评分', '情感分类', '数据来源', '商品名称', '数据集名称'];

                // 构建CSV内容
                let csvContent = '\ufeff'; // 添加BOM头，确保Excel正确识别中文
                csvContent += headers.join(',') + '\n';

                comments.forEach(comment => {
                    const row = [`"${(comment.nickname || '').replace(/"/g, '""')}"`, `"${(comment.content || '').replace(/"/g, '""')}"`, `"${comment.publishtime || ''}"`, `"${comment.score || '暂无'}"`, `"${comment.sentiment || '暂无'}"`, `"${comment.datasource || ''}"`, `"${comment.product || ''}"`, `"${comment.dataset || ''}"`];
                    csvContent += row.join(',') + '\n';
                });

                // 创建下载链接
                const blob = new Blob([csvContent], {type: 'text/csv;charset=utf-8;'});
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;

                // 生成文件名
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
                let filename = '评论搜索结果';
                if (currentKeyword) {
                    filename += `_${currentKeyword}`;
                }
                filename += `_${timestamp}.csv`;
                link.download = filename;

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                URL.revokeObjectURL(url);

                showSuccessMessage(`成功导出 ${comments.length} 条评论`);
            } else {
                showErrorMessage('导出失败: ' + (data.error || '未知错误'));
            }
        } catch (error) {
            console.error('导出失败:', error);
            showErrorMessage('导出失败: ' + error.message);
        }
    }

    /**
     * 显示进度消息
     */
    function showProgressMessage(message) {
        // 创建一个临时的进度提示框
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #f59e0b;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        toast.innerHTML = `
            <i class="fas fa-spinner fa-spin" style="margin-right: 8px;"></i>
            ${message}
        `;
        toast.id = 'progress-toast';

        // 移除可能存在的旧提示
        const oldToast = document.getElementById('progress-toast');
        if (oldToast) {
            document.body.removeChild(oldToast);
        }

        document.body.appendChild(toast);
    }

    /**
     * 显示成功消息
     */
    function showSuccessMessage(message) {
        // 移除进度提示
        const progressToast = document.getElementById('progress-toast');
        if (progressToast) {
            progressToast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (progressToast.parentNode) {
                    progressToast.parentNode.removeChild(progressToast);
                }
            }, 300);
        }

        // 创建成功提示
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background-color: #10b981;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        toast.innerHTML = `
            <i class="fas fa-check-circle" style="margin-right: 8px;"></i>
            ${message}
        `;
        document.body.appendChild(toast);

        // 3秒后移除
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    /**
     * 显示错误消息
     */
    function showErrorMessage(message) {
        // 移除进度提示
        const progressToast = document.getElementById('progress-toast');
        if (progressToast) {
            progressToast.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => {
                if (progressToast.parentNode) {
                    progressToast.parentNode.removeChild(progressToast);
                }
            }, 300);
        }

        alert(`错误: ${message}`);
    }

    /**
     * 添加动画样式
     */
    function addToastStyles() {
        if (!document.querySelector('#toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }

    // 添加动画样式
    addToastStyles();
}
