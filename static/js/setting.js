/**
 * setting.js - 设置页面功能
 * 包含主题设置、个人信息管理、头像上传和密码验证等功能
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function () {
    // 初始化主题设置
    initTheme();

    // 初始化个人信息设置
    initProfileSettings();
});

/**
 * 初始化主题设置
 */
function initTheme() {
    // 从localStorage读取主题设置，默认使用浅色主题
    const savedTheme = localStorage.getItem('edap-theme') || 'light';

    // 设置选中的主题选项
    const themeOption = document.querySelector(`.theme-option[data-theme="${savedTheme}"]`);
    if (themeOption) {
        document.querySelectorAll('.theme-option').forEach(option => {
            option.classList.remove('active');
        });
        themeOption.classList.add('active');
    }

    // 主题选择事件监听
    document.querySelectorAll('.theme-option').forEach(option => {
        option.addEventListener('click', function () {
            document.querySelectorAll('.theme-option').forEach(opt => {
                opt.classList.remove('active');
            });
            this.classList.add('active');
        });
    });

    // 应用主题按钮点击事件
    const applyThemeBtn = document.getElementById('applyTheme');
    if (applyThemeBtn) {
        applyThemeBtn.addEventListener('click', function () {
            const selectedTheme = document.querySelector('.theme-option.active').dataset.theme;
            localStorage.setItem('edap-theme', selectedTheme);

            // 如果全局主题函数存在，使用它
            if (window.applyGlobalTheme) {
                window.applyGlobalTheme(selectedTheme);
            } else {
                location.reload(); // 简单刷新页面应用主题
            }
        });
    }
}

/**
 * 获取主题的中文名称
 */
function getThemeName(theme) {
    const themeNames = {
        'light': '浅色主题',
        'dark': '深色主题',
        'auto': '跟随系统'
    };
    return themeNames[theme] || theme;
}

/**
 * 初始化个人信息设置
 */
function initProfileSettings() {
    const editProfileBtn = document.getElementById('editProfileBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    const profileForm = document.getElementById('profileForm');
    const profileView = document.getElementById('profileView');

    // 如果必要元素不存在，直接返回
    if (!editProfileBtn || !profileForm) return;

    // 保存原始数据
    const originalData = {
        nickname: document.getElementById('nickname').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value
    };

    // 添加重置头像标志
    let isAvatarReset = false;

    // 编辑按钮点击事件
    editProfileBtn.addEventListener('click', function() {
        profileView.style.display = 'none';
        profileForm.style.display = 'flex';
        // 重置标志
        isAvatarReset = false;
    });

    // 取消按钮点击事件
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', function() {
            // 恢复原始数据
            document.getElementById('nickname').value = originalData.nickname;
            document.getElementById('email').value = originalData.email;
            document.getElementById('phone').value = originalData.phone;
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
            document.getElementById('confirmPassword').value = '';

            // 恢复原始头像
            const originalAvatar = profileForm.querySelector('#currentAvatar').dataset.originalSrc;
            const originalAvatarDisplay = profileView.querySelector('#currentAvatarDisplay').src;
            const currentAvatar = document.getElementById('currentAvatar');
            const currentAvatarDisplay = document.getElementById('currentAvatarDisplay');

            if (currentAvatar) currentAvatar.src = originalAvatar;
            if (currentAvatarDisplay) currentAvatarDisplay.src = originalAvatarDisplay;
            if (avatarInput) avatarInput.value = '';

            // 重置标志
            isAvatarReset = false;

            // 切换回查看模式
            profileForm.style.display = 'none';
            profileView.style.display = 'block';
            showToast('已取消修改', 'info');
        });
    }

    // 表单提交事件
    profileForm.addEventListener('submit', async function(e) {
        e.preventDefault();

        // 验证密码是否匹配
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (newPassword && newPassword !== confirmPassword) {
            showToast('新密码与确认密码不匹配', 'error');
            return;
        }

        // 获取表单数据
        const formData = new FormData();
        formData.append('nickname', document.getElementById('nickname').value.trim());
        formData.append('email', document.getElementById('email').value.trim());
        formData.append('phone', document.getElementById('phone').value.trim());
        formData.append('currentPassword', document.getElementById('currentPassword').value);
        formData.append('newPassword', document.getElementById('newPassword').value);

        // 添加头像文件
        const avatarInput = document.getElementById('avatarInput');
        if (avatarInput.files[0]) {
            formData.append('avatar', avatarInput.files[0]);
        }

        // 如果重置了头像，添加重置标志
        if (isAvatarReset) {
            formData.append('reset_avatar', 'true');
        }

        // 显示加载状态
        const submitBtn = this.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 保存中...';
        submitBtn.disabled = true;

        try {
            // 获取CSRF令牌
            const csrfToken = document.querySelector('[name=csrfmiddlewaretoken]').value;

            // 发送请求到后端
            const response = await fetch('/setting/', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-Requested-With': 'XMLHttpRequest',
                    'X-CSRFToken': csrfToken
                }
            });

            const result = await response.json();

            if (result.success) {
                // 更新查看模式显示
                updateProfileDisplay(result.data);
                
                // 更新侧边栏
                updateSidebar(result.data);

                // 清空密码字段
                document.getElementById('currentPassword').value = '';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
                if (avatarInput) avatarInput.value = '';

                // 重置标志
                isAvatarReset = false;

                // 切换回查看模式
                profileForm.style.display = 'none';
                profileView.style.display = 'block';

                // 更新原始数据
                originalData.nickname = result.data.nickname;
                originalData.email = result.data.email;
                originalData.phone = result.data.phone;

                // 更新编辑模式下的输入框值
                document.getElementById('nickname').value = result.data.nickname;
                document.getElementById('email').value = result.data.email;
                document.getElementById('phone').value = result.data.phone;

                showToast(result.message, 'success');
            } else {
                showToast(result.message, 'error');
            }
        } catch (error) {
            console.error('保存失败:', error);
            showToast('保存失败，请检查网络连接或数据格式', 'error');
        } finally {
            // 恢复按钮状态
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    });

    // 密码验证事件
    document.getElementById('newPassword')?.addEventListener('input', validatePassword);
    document.getElementById('confirmPassword')?.addEventListener('input', validatePassword);

    // 头像上传功能
    initAvatarUpload();

    // 重置头像功能
    initResetAvatar();
}

/**
 * 初始化头像上传功能
 */
function initAvatarUpload() {
    const avatarInput = document.getElementById('avatarInput');
    const avatarLabel = document.getElementById('avatarLabel');

    // 保存原始头像URL
    const currentAvatar = document.getElementById('currentAvatar');
    if (currentAvatar) {
        currentAvatar.dataset.originalSrc = currentAvatar.src;
    }

    if (avatarLabel && avatarInput) {
        // 防止重复绑定
        avatarLabel.removeEventListener('click', handleAvatarLabelClick);
        avatarLabel.addEventListener('click', handleAvatarLabelClick);

        function handleAvatarLabelClick(e) {
            e.preventDefault();
            e.stopPropagation();
            avatarInput.click();
        }
    }

    if (avatarInput) {
        avatarInput.addEventListener('change', function(e) {
            if (this.files && this.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    const currentAvatar = document.getElementById('currentAvatar');
                    const currentAvatarDisplay = document.getElementById('currentAvatarDisplay');
                    if (currentAvatar) currentAvatar.src = e.target.result;
                    if (currentAvatarDisplay) currentAvatarDisplay.src = e.target.result;
                };
                reader.readAsDataURL(this.files[0]);
                // 选择新文件时取消重置标志
                isAvatarReset = false;
            }
        });
    }
}

/**
 * 初始化重置头像功能
 */
function initResetAvatar() {
    const resetAvatarBtn = document.getElementById('resetAvatar');
    if (resetAvatarBtn) {
        resetAvatarBtn.addEventListener('click', handleResetAvatar);

        function handleResetAvatar() {
            // 设置重置标志
            isAvatarReset = true;

            // 加载默认头像
            const defaultAvatar = '../static/images/avatars/default_avatar.png';
            const currentAvatar = document.getElementById('currentAvatar');
            const currentAvatarDisplay = document.getElementById('currentAvatarDisplay');

            if (currentAvatar) {
                currentAvatar.src = defaultAvatar;
            }
            if (currentAvatarDisplay) {
                currentAvatarDisplay.src = defaultAvatar;
            }
            if (avatarInput) {
                avatarInput.value = '';
            }

            showToast('已重置为默认头像，点击保存后生效', 'info');
        }
    }
}

/**
 * 更新个人信息显示
 */
function updateProfileDisplay(data) {
    // 更新大标题昵称
    const profileNickname = document.getElementById('profileNickname');
    if (profileNickname) {
        profileNickname.textContent = data.nickname;
    }
    
    // 更新详细信息
    document.getElementById('nicknameDisplay').textContent = data.nickname;
    document.getElementById('emailDisplay').textContent = data.email;
    document.getElementById('phoneDisplay').textContent = data.phone;

    // 更新头像
    const currentAvatar = document.getElementById('currentAvatar');
    const currentAvatarDisplay = document.getElementById('currentAvatarDisplay');
    if (currentAvatar) {
        currentAvatar.src = data.avatar_url;
        currentAvatar.dataset.originalSrc = data.avatar_url;
    }
    if (currentAvatarDisplay) currentAvatarDisplay.src = data.avatar_url;
}

/**
 * 更新侧边栏信息
 */
function updateSidebar(data) {
    // 更新侧边栏昵称
    const sidebarNickname = document.querySelector('.user-info h4');
    if (sidebarNickname) {
        sidebarNickname.textContent = data.nickname;
    }

    // 更新侧边栏头像
    const sidebarAvatar = document.querySelector('.sidebar-footer .avatar img');
    if (sidebarAvatar && data.avatar_url) {
        sidebarAvatar.src = data.avatar_url;
    }
}

/**
 * 密码验证
 */
function validatePassword() {
    const newPassword = document.getElementById('newPassword')?.value || '';
    const confirmPassword = document.getElementById('confirmPassword')?.value || '';
    const confirmInput = document.getElementById('confirmPassword');

    if (!confirmInput) return;

    if (confirmPassword && newPassword !== confirmPassword) {
        confirmInput.style.borderColor = '#e74c3c';
        confirmInput.style.boxShadow = '0 0 0 3px rgba(231, 76, 60, 0.1)';
    } else if (confirmPassword) {
        confirmInput.style.borderColor = '#2ecc71';
        confirmInput.style.boxShadow = '0 0 0 3px rgba(46, 204, 113, 0.1)';
    } else {
        confirmInput.style.borderColor = '#ddd';
        confirmInput.style.boxShadow = 'none';
    }
}

/**
 * 显示提示消息
 */
function showToast(message, type = 'info') {
    // 移除已有的toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }

    // 创建toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <i class="fas ${getToastIcon(type)}"></i>
        <span>${message}</span>
    `;

    // 添加样式
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${getToastColor(type)};
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 10px;
        z-index: 10000;
        animation: slideIn 0.3s ease, fadeOut 0.3s ease 2.7s;
        animation-fill-mode: forwards;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;

    document.body.appendChild(toast);

    // 3秒后移除
    setTimeout(() => {
        if (toast.parentNode) {
            toast.remove();
        }
    }, 3000);
}

/**
 * 获取toast图标
 */
function getToastIcon(type) {
    const icons = {
        'success': 'fa-check-circle',
        'error': 'fa-exclamation-circle',
        'info': 'fa-info-circle',
        'warning': 'fa-exclamation-triangle'
    };
    return icons[type] || 'fa-info-circle';
}

/**
 * 获取toast背景颜色
 */
function getToastColor(type) {
    const colors = {
        'success': 'linear-gradient(135deg, #2ecc71, #27ae60)',
        'error': 'linear-gradient(135deg, #e74c3c, #c0392b)',
        'info': 'linear-gradient(135deg, #3498db, #2980b9)',
        'warning': 'linear-gradient(135deg, #f39c12, #e67e22)'
    };
    return colors[type] || colors.info;
}