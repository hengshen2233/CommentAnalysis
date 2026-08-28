/**
 * acquisition.js - 数据获取页面功能
 * 包含平台选择、表单处理、进度更新和数据获取功能
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function () {
    // 初始化平台选择功能
    initPlatformSelection();
    
    // 初始化表单和按钮事件
    initFormEvents();
});

/**
 * 初始化平台选择功能
 */
function initPlatformSelection() {
    const platformOptions = document.querySelectorAll('.platform-option');
    const datasourceInput = document.getElementById('datasource');
    let selectedPlatform = null;

    // 为每个平台选项添加点击事件
    platformOptions.forEach(option => {
        option.addEventListener('click', function () {
            // 移除之前选中的状态
            platformOptions.forEach(opt => opt.classList.remove('active'));

            // 设置当前选中的状态
            this.classList.add('active');
            selectedPlatform = this.dataset.value;
            datasourceInput.value = selectedPlatform;
        });
    });
}

/**
 * 初始化表单和按钮事件
 */
function initFormEvents() {
    // 获取表单元素
    const acquisitionForm = document.getElementById('acquisitionForm');
    const startBtn = document.getElementById('startBtn');
    const resetBtn = document.getElementById('resetBtn');
    const progressCard = document.getElementById('progressCard');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    const resultSummary = document.getElementById('resultSummary');
    const totalComments = document.getElementById('totalComments');
    const timeSpent = document.getElementById('timeSpent');
    const viewDataBtn = document.getElementById('viewDataBtn');
    const newAcquisitionBtn = document.getElementById('newAcquisitionBtn');

    // 状态变量
    let acquisitionInProgress = false;
    let startTime = null;
    let currentDatasetName = '';

    // 重置表单按钮点击事件
    resetBtn.addEventListener('click', function () {
        resetForm();
    });

    // 开始新的获取按钮点击事件
    newAcquisitionBtn.addEventListener('click', function () {
        resetForm();
    });

    // 查看数据按钮点击事件
    viewDataBtn.addEventListener('click', function () {
        window.location.href = '/management/';
    });

    // 表单提交事件
    acquisitionForm.addEventListener('submit', function (e) {
        e.preventDefault();

        // 检查是否有任务正在进行
        if (acquisitionInProgress) {
            alert('数据获取任务正在进行中，请等待完成');
            return;
        }

        // 验证表单
        if (!validateForm()) {
            return;
        }

        // 获取表单数据
        const dataset = document.getElementById('dataset').value.trim();
        const maxPages = document.getElementById('maxPages').value;
        currentDatasetName = dataset;
        const formData = new FormData(this);

        // 显示进度卡片
        progressCard.style.display = 'block';
        resultSummary.style.display = 'none';

        // 重置进度
        updateProgress(0, '正在提交任务...');
        startTime = new Date(); // 记录开始时间
        
        // 禁用按钮
        startBtn.disabled = true;
        resetBtn.disabled = true;
        startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 获取中...';
        acquisitionInProgress = true;

        // 发送请求
        fetch('/acquisition/', {
            method: 'POST',
            body: formData,
            headers: {
                'X-CSRFToken': getCSRFToken(),
                'X-Requested-With': 'XMLHttpRequest'
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    // 模拟进度更新
                    simulateProgress(maxPages, function() {
                        // 最终检查任务状态
                        checkTaskStatus(currentDatasetName, startTime, function(success, totalCommentsCount, timeDiff) {
                            if (success) {
                                updateProgress(100, '数据获取完成');
                                // 显示成功结果
                                resultSummary.style.display = 'block';
                                totalComments.textContent = totalCommentsCount;
                                timeSpent.textContent = timeDiff;
                            } else {
                                alert('数据获取失败！');
                                progressCard.style.display = 'none';
                                resultSummary.style.display = 'none';
                            }
                            
                            // 恢复按钮状态
                            restoreButtonState();
                        });
                    });
                } else {
                    restoreButtonState();
                    progressCard.style.display = 'none';
                    resultSummary.style.display = 'none';
                    alert(data.error);
                }
            })
            .catch(error => {
                console.error('启动数据获取失败:', error);
                restoreButtonState();
                progressCard.style.display = 'none';
                resultSummary.style.display = 'none';
                alert(error);
            });

        /**
         * 恢复按钮状态
         */
        function restoreButtonState() {
            startBtn.disabled = false;
            resetBtn.disabled = false;
            startBtn.innerHTML = '<i class="fas fa-play-circle"></i> 开始获取';
            acquisitionInProgress = false;
        }
    });

    /**
     * 重置表单
     */
    function resetForm() {
        acquisitionForm.reset();
        const platformOptions = document.querySelectorAll('.platform-option');
        platformOptions.forEach(opt => opt.classList.remove('active'));
        document.getElementById('datasource').value = '';
        progressCard.style.display = 'none';
        resultSummary.style.display = 'none';
    }

    /**
     * 验证表单
     */
    function validateForm() {
        const datasourceInput = document.getElementById('datasource');
        if (!datasourceInput.value) {
            alert('请选择数据来源');
            return false;
        }

        const dataset = document.getElementById('dataset').value.trim();
        const product = document.getElementById('product').value.trim();
        const productUrl = document.getElementById('productUrl').value.trim();

        if (!dataset || !product || !productUrl) {
            alert('请填写所有必填字段');
            return false;
        }

        return true;
    }

    /**
     * 更新进度
     */
    function updateProgress(progress, status) {
        progressFill.style.width = `${progress}%`;
        progressText.textContent = `${progress}% ${status}`;
    }

    /**
     * 模拟进度更新
     */
    function simulateProgress(maxPages, callback) {
        updateProgress(20, '开始获取数据...');
        setTimeout(() => {
            updateProgress(40, '正在获取数据...');
            setTimeout(() => {
                updateProgress(60, '正在获取数据...');
                setTimeout(() => {
                    updateProgress(80, '正在获取数据...');
                    setTimeout(() => {
                        callback();
                    }, maxPages * 2000);
                }, maxPages * 1000);
            }, maxPages * 1000);
        }, maxPages * 1000);
    }

    /**
     * 检查任务状态
     */
    function checkTaskStatus(datasetName, startTime, callback) {
        fetch(`/acquisition/?dataset_name=${encodeURIComponent(datasetName)}`)
            .then(response => response.json())
            .then(finalData => {
                if (finalData.success && finalData.total_comments) {
                    // 计算耗时
                    const endTime = new Date();
                    const timeDiff = Math.floor((endTime - startTime) / 1000); // 秒
                    callback(true, finalData.total_comments, timeDiff);
                } else {
                    callback(false);
                }
            })
            .catch(() => {
                callback(false);
            });
    }
}

/**
 * 获取CSRF token
 */
function getCSRFToken() {
    const name = 'csrftoken';
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