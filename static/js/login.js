/**
 * login.js - 登录和注册页面功能
 * 包含选项卡切换、表单处理、验证逻辑和记住密码功能
 */

// 等待DOM加载完成
document.addEventListener('DOMContentLoaded', function () {
    // 初始化选项卡切换功能
    initTabs();

    // 初始化表单提交处理
    initForms();

    // 加载记住的用户名
    loadLoginInfo();
});

/**
 * 初始化选项卡切换功能
 */
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // 为每个选项卡按钮添加点击事件
    tabBtns.forEach(btn => {
        btn.addEventListener('click', function () {
            const tabId = this.getAttribute('data-tab');

            // 移除所有活动状态
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));

            // 添加当前活动状态
            this.classList.add('active');
            document.getElementById(tabId).classList.add('active');
        });
    });
}

/**
 * 初始化表单提交处理
 */
function initForms() {
    // 登录表单提交
    const loginForm = document.querySelector('.login-form-content');
    if (loginForm) {
        loginForm.addEventListener('submit', function (e) {
            e.preventDefault();
            handleLogin(this);
        });
    }

    // 注册表单提交
    const registerForm = document.querySelector('.register-form-content');
    if (registerForm) {
        registerForm.addEventListener('submit', function (e) {
            e.preventDefault();
            handleRegister(this);
        });
    }
}

/**
 * 处理登录表单提交
 */
function handleLogin(form) {
    // 获取表单数据
    const username = form.querySelector('#username').value.trim();
    const password = form.querySelector('#password').value;
    const remember = form.querySelector('#remember').checked;

    // 保存记住的用户名
    saveLoginInfo(username, remember);

    // 使用 AJAX 发送登录请求
    fetch('/login/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCsrfToken()
        },
        body: new URLSearchParams({
            'username': username,
            'password': password
        })
    })
        .then(response => response.text())
        .then(data => {
            // 检查响应中是否有错误
            if (data.includes('alert')) {
                // 执行响应中的JavaScript
                const scriptMatch = data.match(/<script[^>]*>(.*?)<\/script>/s);
                if (scriptMatch) {
                    eval(scriptMatch[1]);
                }
            } else {
                // 登录成功，跳转到仪表盘
                window.location.href = "/dashboard/"
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('网络请求失败');
        });
}

/**
 * 处理注册表单提交
 */
function handleRegister(form) {
    // 获取表单数据
    const username = form.querySelector('#reg-username').value.trim();
    const phone = form.querySelector('#phone').value.trim();
    const email = form.querySelector('#email').value.trim();
    const password = form.querySelector('#reg-password').value;
    const agree = form.querySelector('#agree').checked;

    // 表单验证
    if (!username || !email || !phone || !password) {
        alert('请填写所有必填项');
        return;
    }

    if (!agree) {
        alert('请阅读并同意服务协议和隐私政策');
        return;
    }

    // 手机号验证
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
        alert('请输入有效的11位手机号码');
        return;
    }

    // 邮箱验证
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        alert('请输入有效的邮箱地址');
        return;
    }

    // 使用 AJAX 发送注册请求
    fetch('/register/', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'X-CSRFToken': getCsrfToken()
        },
        body: new URLSearchParams({
            'username': username,
            'phone': phone,
            'email': email,
            'password': password
        })
    })
        .then(response => response.text())
        .then(data => {
            // 检查响应中是否有错误
            if (data.includes('alert')) {
                // 执行响应中的JavaScript
                const scriptMatch = data.match(/<script[^>]*>(.*?)<\/script>/s);
                if (scriptMatch) {
                    eval(scriptMatch[1]);
                }
            } else {
                // 注册成功，跳转到首页
                window.location.href = "/"
            }
        })
        .catch(error => {
            console.error('Error:', error);
            alert('网络请求失败');
        });
}

/**
 * 获取CSRF Token
 */
function getCsrfToken() {
    // 优先从表单中获取
    const csrfTokenInput = document.querySelector('input[name="csrfmiddlewaretoken"]');
    if (csrfTokenInput) {
        return csrfTokenInput.value;
    }

    // 备用方法：从cookie获取
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, 10) === 'csrftoken=') {
                cookieValue = decodeURIComponent(cookie.substring(10));
                break;
            }
        }
    }
    return cookieValue;
}

/**
 * 保存登录信息（记住用户名）
 */
function saveLoginInfo(username, remember) {
    if (remember) {
        localStorage.setItem('rememberedUsername', username);
    } else {
        localStorage.removeItem('rememberedUsername');
    }
}

/**
 * 加载记住的登录信息
 */
function loadLoginInfo() {
    const username = localStorage.getItem('rememberedUsername');
    if (username) {
        const usernameInput = document.querySelector('#username');
        const rememberCheckbox = document.querySelector('#remember');
        if (usernameInput && rememberCheckbox) {
            usernameInput.value = username;
            rememberCheckbox.checked = true;
        }
    }
}