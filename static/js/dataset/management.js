/**
 * management.js - 数据集管理页面功能
 * 包含数据集列表、搜索、分页、编辑和删除功能
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function () {
    // 初始化页面功能
    initPage();
});

/**
 * 初始化页面功能
 */
function initPage() {
    // 元素引用
    const createBtn = document.getElementById('createBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const searchInput = document.getElementById('searchInput');
    const searchBtn = document.getElementById('searchBtn');
    const datasetsBody = document.getElementById('datasetsBody');
    const loadingRow = document.getElementById('loadingRow');
    const noDataMessage = document.getElementById('noDataMessage');
    const pagination = document.getElementById('pagination');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const pageInfo = document.getElementById('pageInfo');

    // 模态框相关
    const editModal = document.getElementById('editModal');
    const deleteModal = document.getElementById('deleteModal');
    const deleteMessage = document.getElementById('deleteMessage');
    const saveBtn = document.querySelector('.save-btn');
    const confirmDeleteBtn = document.querySelector('.confirm-delete-btn');
    const allCloseBtns = document.querySelectorAll('.close-btn, .cancel-btn');

    // 分页参数
    let currentPage = 1;
    let totalPages = 1;
    let allDatasets = [];
    let filteredDatasets = [];
    const pageSize = 10;
    let currentSearchTerm = '';

    // 初始化
    loadDatasets();

    // 事件监听
    createBtn.addEventListener('click', () => {
        window.location.href = '/acquisition/';
    });

    refreshBtn.addEventListener('click', loadDatasets);

    searchBtn.addEventListener('click', () => {
        currentSearchTerm = searchInput.value.trim();
        currentPage = 1;
        filterAndDisplayDatasets();
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            currentSearchTerm = searchInput.value.trim();
            currentPage = 1;
            filterAndDisplayDatasets();
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            displayCurrentPage();
            updatePagination();
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayCurrentPage();
            updatePagination();
        }
    });

    // 模态框关闭
    allCloseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            editModal.classList.remove('active');
            deleteModal.classList.remove('active');
        });
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
        if (e.target === editModal) {
            editModal.classList.remove('active');
        }
        if (e.target === deleteModal) {
            deleteModal.classList.remove('active');
        }
    });

    // 保存修改
    saveBtn.addEventListener('click', saveDatasetChanges);

    // 确认删除
    confirmDeleteBtn.addEventListener('click', confirmDeleteDataset);

    /**
     * 加载数据集
     */
    function loadDatasets() {
        showLoading();

        fetch('/management/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: 'action=get_datasets'
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    allDatasets = data.datasets;
                    filterAndDisplayDatasets();
                } else {
                    showMessage('error', '加载数据集失败');
                    showNoDataMessage();
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showMessage('error', '网络错误，请稍后重试');
                showNoDataMessage();
            });
    }

    /**
     * 过滤和显示数据集
     */
    function filterAndDisplayDatasets() {
        // 根据搜索词过滤数据集
        if (currentSearchTerm) {
            filteredDatasets = allDatasets.filter(dataset =>
                dataset.dataset.toLowerCase().includes(currentSearchTerm.toLowerCase()) ||
                dataset.product.toLowerCase().includes(currentSearchTerm.toLowerCase())
            );
        } else {
            filteredDatasets = allDatasets;
        }

        // 计算总页数
        totalPages = Math.ceil(filteredDatasets.length / pageSize);

        // 确保当前页不超过总页数
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        
        // 显示当前页数据
        displayCurrentPage();
        // 更新分页控件
        updatePagination();
    }

    /**
     * 显示当前页
     */
    function displayCurrentPage() {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        const pageDatasets = filteredDatasets.slice(startIndex, endIndex);

        if (pageDatasets.length === 0) {
            showNoDataMessage();
        } else {
            datasetsBody.innerHTML = '';
            pageDatasets.forEach(dataset => {
                const row = createDatasetRow(dataset);
                datasetsBody.appendChild(row);
            });
            noDataMessage.style.display = 'none';
            datasetsBody.style.display = 'table-row-group';
        }
        // 确保每次显示页面后都更新分页控件
        updatePagination();
    }

    /**
     * 创建数据集行
     */
    function createDatasetRow(dataset) {
        const row = document.createElement('tr');
        row.dataset.id = dataset.id;

        row.innerHTML = `
            <td>${escapeHtml(dataset.dataset)}</td>
            <td>${escapeHtml(dataset.product)}</td>
            <td>${dataset.creationtime}</td>
            <td>${escapeHtml(dataset.datasource)}</td>
            <td>${dataset.comments_count}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-edit" data-id="${dataset.id}">
                        <i class="fas fa-edit"></i> 修改
                    </button>
                    <button class="btn-delete" data-id="${dataset.id}">
                        <i class="fas fa-trash"></i> 删除
                    </button>
                </div>
            </td>
        `;

        // 添加编辑和删除按钮事件
        row.querySelector('.btn-edit').addEventListener('click', () => openEditModal(dataset));
        row.querySelector('.btn-delete').addEventListener('click', () => openDeleteModal(dataset));

        return row;
    }

    /**
     * 打开编辑模态框
     */
    function openEditModal(dataset) {
        document.getElementById('editId').value = dataset.id;
        document.getElementById('editDataset').value = dataset.dataset;
        document.getElementById('editProduct').value = dataset.product;
        document.getElementById('editDatasource').value = dataset.datasource;
        document.getElementById('editCreationtime').value = dataset.creationtime;
        document.getElementById('editCommentsCount').value = dataset.comments_count;

        // 清空错误信息
        document.getElementById('datasetError').textContent = '';
        document.getElementById('productError').textContent = '';

        editModal.classList.add('active');
    }

    /**
     * 打开删除模态框
     */
    function openDeleteModal(dataset) {
        deleteMessage.textContent = `您确定要删除数据集 "${dataset.dataset}" 吗？`;
        confirmDeleteBtn.dataset.id = dataset.id;
        deleteModal.classList.add('active');
    }

    /**
     * 保存数据集修改
     */
    function saveDatasetChanges() {
        const id = document.getElementById('editId').value;
        const dataset = document.getElementById('editDataset').value.trim();
        const product = document.getElementById('editProduct').value.trim();

        // 验证表单
        let isValid = true;

        if (!dataset) {
            document.getElementById('datasetError').textContent = '数据集名称不能为空';
            isValid = false;
        } else {
            document.getElementById('datasetError').textContent = '';
        }

        if (!product) {
            document.getElementById('productError').textContent = '商品名称不能为空';
            isValid = false;
        } else {
            document.getElementById('productError').textContent = '';
        }

        if (!isValid) return;

        // 发送更新请求
        fetch('/management/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: `action=update&id=${id}&dataset=${encodeURIComponent(dataset)}&product=${encodeURIComponent(product)}`
        })
            .then(response => response.json())
            .then(data => {
                    if (data.success) {
                        showMessage('success', data.message);
                        editModal.classList.remove('active');
                        loadDatasets(); // 刷新列表
                    } else {
                        if (data.message.includes('数据集名称已存在')) {
                            document.getElementById('datasetError').textContent = data.message;
                        } else if (data.message.includes('数据集名称不区分大小写')) {
                            document.getElementById('datasetError').textContent = data.message;
                        } else {
                            showMessage('error', data.message);
                        }
                    }
                }
            )
            .catch(error => {
                console.error('Error:', error);
                showMessage('error', '更新失败，请稍后重试');
            });
    }

    /**
     * 确认删除数据集
     */
    function confirmDeleteDataset() {
        const id = confirmDeleteBtn.dataset.id;

        fetch('/management/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: `action=delete&id=${id}`
        })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    showMessage('success', data.message);
                    deleteModal.classList.remove('active');
                    loadDatasets(); // 刷新列表
                } else {
                    showMessage('error', data.message);
                }
            })
            .catch(error => {
                console.error('Error:', error);
                showMessage('error', '删除失败，请稍后重试');
            });
    }

    /**
     * 更新分页控件
     */
    function updatePagination() {
        if (filteredDatasets.length > pageSize) {
            pagination.style.display = 'flex';
            pageInfo.textContent = `第 ${currentPage} 页 / 共 ${totalPages} 页`;

            prevBtn.disabled = currentPage === 1;
            nextBtn.disabled = currentPage === totalPages;
            
            // 添加样式类来控制禁用状态
            if (prevBtn.disabled) {
                prevBtn.classList.add('disabled');
            } else {
                prevBtn.classList.remove('disabled');
            }

            if (nextBtn.disabled) {
                nextBtn.classList.add('disabled');
            } else {
                nextBtn.classList.remove('disabled');
            }
        } else {
            pagination.style.display = 'none';
        }
    }

    /**
     * 显示加载状态
     */
    function showLoading() {
        loadingRow.style.display = '';
        datasetsBody.innerHTML = '';
        datasetsBody.appendChild(loadingRow);
        noDataMessage.style.display = 'none';
        datasetsBody.style.display = 'table-row-group';
    }

    /**
     * 显示无数据消息
     */
    function showNoDataMessage() {
        datasetsBody.innerHTML = '';
        noDataMessage.style.display = 'block';
        datasetsBody.style.display = 'none';
        pagination.style.display = 'none';
    }

    /**
     * 显示消息
     */
    function showMessage(type, text) {
        // 移除现有消息
        const existingMessage = document.querySelector('.message-container');
        if (existingMessage) {
            existingMessage.remove();
        }

        // 创建新消息
        const messageContainer = document.createElement('div');
        messageContainer.className = 'message-container';

        const message = document.createElement('div');
        message.className = `message message-${type}`;

        const icon = type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle';
        message.innerHTML = `<i class="fas ${icon}"></i> ${text}`;

        messageContainer.appendChild(message);
        document.body.appendChild(messageContainer);

        // 3秒后自动移除
        setTimeout(() => {
            messageContainer.remove();
        }, 3000);
    }

    /**
     * 获取Cookie值
     */
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

    /**
     * HTML转义
     */
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}
