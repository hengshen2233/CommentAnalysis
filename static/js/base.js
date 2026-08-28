/**
 * base.js - 基础功能和主题管理
 * 包含侧边栏交互、登出功能和主题系统
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function () {
    // 初始化侧边栏功能
    initSidebar();
    
    // 初始化登出功能
    initLogout();
    
    // 初始化主题系统
    initThemeSystem();
});

/**
 * 初始化侧边栏功能
 * - 处理菜单项点击事件
 * - 管理子菜单展开/折叠
 * - 设置默认展开状态
 */
function initSidebar() {
    // 获取所有菜单项
    const menuItems = document.querySelectorAll('.nav-section ul li a');
    
    // 为每个菜单项添加点击事件
    menuItems.forEach(item => {
        item.addEventListener('click', function (e) {
            const parentLi = this.parentElement;
            const href = this.getAttribute('href');
            
            // 如果是子菜单（href为#），阻止默认行为并展开/折叠
            if (href === '#') {
                e.preventDefault();
                
                // 切换展开状态
                parentLi.classList.toggle('expanded');
                
                // 切换子菜单显示
                const submenu = parentLi.querySelector('.submenu');
                if (parentLi.classList.contains('expanded')) {
                    submenu.style.maxHeight = submenu.scrollHeight + 'px';
                } else {
                    submenu.style.maxHeight = '0';
                }
            } else {
                // 移除所有菜单项的active类
                document.querySelectorAll('.nav-section ul li').forEach(li => {
                    li.classList.remove('active');
                });
                
                // 为当前点击的菜单项添加active类
                parentLi.classList.add('active');
            }
        });
    });
    
    // 初始化默认展开的子菜单
    const defaultExpanded = document.querySelectorAll('.has-submenu.expanded');
    defaultExpanded.forEach(item => {
        const submenu = item.querySelector('.submenu');
        if (submenu) {
            submenu.style.maxHeight = submenu.scrollHeight + 'px';
        }
    });
    
    // 页面完全加载后添加loaded类，启用过渡效果
    setTimeout(() => {
        document.body.classList.add('loaded');
    }, 100);
}

/**
 * 初始化登出功能
 */
function initLogout() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function () {
            if (confirm('确定要退出登录吗？')) {
                window.location.href = '/logout/';
            }
        });
    }
}

/**
 * 初始化主题系统
 * - 读取保存的主题设置
 * - 应用主题到页面
 * - 监听系统主题变化
 */
function initThemeSystem() {
    // 从localStorage读取主题设置，默认使用浅色主题
    const savedTheme = localStorage.getItem('edap-theme') || 'light';
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // 确定要应用的主题
    let themeToApply = savedTheme === 'auto' ? (systemPrefersDark ? 'dark' : 'light') : savedTheme;
    
    // 应用主题到整个页面
    applyThemeToPage(themeToApply);
    
    // 监听系统主题变化（仅在auto模式下）
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
        if (localStorage.getItem('edap-theme') === 'auto') {
            applyThemeToPage(e.matches ? 'dark' : 'light');
        }
    });
}

/**
 * 应用主题到整个页面
 */
function applyThemeToPage(theme) {
    // 设置data-theme属性
    document.documentElement.setAttribute('data-theme', theme);
    
    // 更新CSS变量
    updateThemeVariables(theme);
}

/**
 * 更新CSS变量
 */
function updateThemeVariables(theme) {
    const root = document.documentElement;
    
    if (theme === 'dark') {
        // 暗色主题变量
        root.style.setProperty('--primary-bg', '#1a1a2e');
        root.style.setProperty('--secondary-bg', '#2c3e50');
        root.style.setProperty('--sidebar-bg', '#1e272e');
        root.style.setProperty('--card-bg', '#2c3e50');
        root.style.setProperty('--text-primary', '#ecf0f1');
        root.style.setProperty('--text-secondary', '#bdc3c7');
        root.style.setProperty('--border-color', '#34495e');
        root.style.setProperty('--hover-bg', '#34495e');
        root.style.setProperty('--active-bg', '#3498db');
        root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.3)');
    } else {
        // 浅色主题变量（默认）
        root.style.setProperty('--primary-bg', '#f5f7fb');
        root.style.setProperty('--secondary-bg', '#ffffff');
        root.style.setProperty('--sidebar-bg', '#ffffff');
        root.style.setProperty('--card-bg', '#ffffff');
        root.style.setProperty('--text-primary', '#333333');
        root.style.setProperty('text-secondary', '#777777');
        root.style.setProperty('--border-color', '#e0e0e0');
        root.style.setProperty('--hover-bg', '#f0f2f5');
        root.style.setProperty('--active-bg', '#4f46e5');
        root.style.setProperty('--shadow-color', 'rgba(0, 0, 0, 0.05)');
    }
}

/**
 * 全局主题切换函数（供其他页面调用）
 */
window.applyGlobalTheme = function(theme) {
    // 保存主题设置到localStorage
    localStorage.setItem('edap-theme', theme);
    
    // 应用主题
    if (theme === 'auto') {
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        applyThemeToPage(systemPrefersDark ? 'dark' : 'light');
    } else {
        applyThemeToPage(theme);
    }
    
    // 显示切换成功提示
    showGlobalToast(`已切换至${getThemeName(theme)}`, 'success');
};

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
 * 显示全局提示消息
 */
function showGlobalToast(message, type = 'info') {
    // 移除已有的toast
    const existingToast = document.querySelector('.global-toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // 创建新的toast元素
    const toast = document.createElement('div');
    toast.className = `global-toast toast-${type}`;
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
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 3秒后自动移除
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

/**
 * 添加CSS动画样式
 */
if (!document.querySelector('#theme-animations')) {
    const style = document.createElement('style');
    style.id = 'theme-animations';
    style.textContent = `
        /* 滑入动画 */
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        /* 淡出动画 */
        @keyframes fadeOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        
        /* 主题过渡动画 */
        .sidebar, .main-content, .logo, .nav-section, .sidebar-footer,
        .top-header, .main-footer, .setting-section, .login-history {
            transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
        }
    `;
    document.head.appendChild(style);
}