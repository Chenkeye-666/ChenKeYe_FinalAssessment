// 09-settings-login

async function handleLoginSubmit(event) {
    event.preventDefault();

    const accountInput = document.querySelector('#login-account');
    const passwordInput = document.querySelector('#login-password');
    const rememberCheckbox = document.querySelector('#remember-password');

    const account = accountInput.value.trim();
    const password = passwordInput.value.trim();

    if (!account) {
        showToast('请输入账号');
        return;
    }

    if (!password) {
        showToast('请输入密码');
        return;
    }

    try {
        toggleGlobalLoading(true);

        const response = await fetch(`${BASE_URL}/user/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                account,
                password
            })
        });

        const result = await response.json();

        if (result.code === 200) {
            const { token, userId, account: loginAccount } = result.data || {};

            localStorage.setItem('token', token || '');
            localStorage.setItem('userId', userId || '');
            localStorage.setItem('account', loginAccount || account);
            saveLoginHistory(loginAccount || account, password, Boolean(rememberCheckbox?.checked));

            markCurrentTabAsActiveLogin(userId);

            state.isLogin = true;

            fetchUnreadMessages(true);
            startMessageUnreadPolling();

            showToast('登录成功');
            goTo('/home');
            return;
        }

        showToast(result.msg || '登录失败');
    } catch (error) {
        console.error('登录请求失败:', error);
        showToast('网络异常，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 请求首页帖子列表

function passwordVisibleIcon() {
    return `
        <svg class="icon password-toggle-icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M512 768c-183.466667 0-328.533333-85.333333-426.666667-256 98.133333-170.666667 243.2-256 426.666667-256s328.533333 85.333333 426.666667 256c-98.133333 170.666667-243.2 256-426.666667 256z m8.533333-426.666667c-128 0-256 55.466667-328.533333 170.666667 72.533333 115.2 200.533333 170.666667 328.533333 170.666667s238.933333-55.466667 311.466667-170.666667c-72.533333-115.2-183.466667-170.666667-311.466667-170.666667z m-8.533333 298.666667c-72.533333 0-128-55.466667-128-128s55.466667-128 128-128 128 55.466667 128 128-55.466667 128-128 128z m0-85.333333c25.6 0 42.666667-17.066667 42.666667-42.666667s-17.066667-42.666667-42.666667-42.666667-42.666667 17.066667-42.666667 42.666667 17.066667 42.666667 42.666667 42.666667z" fill="currentColor"></path>
        </svg>
    `;
}

function passwordHiddenIcon() {
    return `
        <svg class="icon password-toggle-icon" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path d="M253.6 679.2l109.6-109.6C356 552 352 532.8 352 512c0-88 72-160 160-160 20.8 0 40 4 57.6 11.2l82.4-82.4C607.2 264.8 560 256 512 256c-168 0-329.6 106.4-384 256 24 65.6 68.8 123.2 125.6 167.2z" fill="currentColor"></path>
            <path d="M416 512v4.8L516.8 416H512c-52.8 0-96 43.2-96 96zM770.4 344.8l163.2-163.2L888 136l-753.6 753.6 45.6 45.6 192.8-192.8A390.4 390.4 0 0 0 512 768c167.2 0 330.4-106.4 384.8-256-24-65.6-69.6-123.2-126.4-167.2zM512 672c-20 0-40-4-57.6-11.2l53.6-53.6h4.8c52.8 0 96-43.2 96-96v-4.8l53.6-53.6C668 472 672 492 672 512c0 88-72 160-160 160z" fill="currentColor"></path>
        </svg>
    `;
}

function renderPasswordToggleIcon(isPasswordVisible) {
    const toggleBtn = document.querySelector('#toggle-password-btn');
    if (!toggleBtn) return;

    toggleBtn.innerHTML = isPasswordVisible ? passwordHiddenIcon() : passwordVisibleIcon();
    toggleBtn.dataset.visible = isPasswordVisible ? '1' : '0';
    toggleBtn.setAttribute('aria-label', isPasswordVisible ? '隐藏密码' : '显示密码');
    toggleBtn.setAttribute('title', isPasswordVisible ? '隐藏密码' : '显示密码');
}

function bindPasswordToggle() {
    const toggleBtn = document.querySelector('#toggle-password-btn');
    const passwordInput = document.querySelector('#login-password');

    if (!toggleBtn || !passwordInput) return;

    renderPasswordToggleIcon(passwordInput.type === 'text');

    toggleBtn.addEventListener('click', () => {
        const isPasswordVisible = passwordInput.type === 'text';
        const nextVisible = !isPasswordVisible;

        passwordInput.type = nextVisible ? 'text' : 'password';
        renderPasswordToggleIcon(nextVisible);
    });
}

function getLoginHistoryList() {
    try {
        const raw = localStorage.getItem(LOGIN_HISTORY_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
    } catch (error) {
        return [];
    }
}

function saveLoginHistoryList(list) {
    localStorage.setItem(LOGIN_HISTORY_KEY, JSON.stringify(list.slice(0, 8)));
}

function saveLoginHistory(account, password, shouldRememberPassword) {
    if (!account) return;

    const list = getLoginHistoryList().filter((item) => String(item.account) !== String(account));

    list.unshift({
        account: String(account),
        password: shouldRememberPassword ? String(password || '') : '',
        rememberPassword: Boolean(shouldRememberPassword),
        lastLoginTime: Date.now()
    });

    saveLoginHistoryList(list);
}

function restoreLastLoginAccount() {
    const accountInput = document.querySelector('#login-account');
    const passwordInput = document.querySelector('#login-password');
    const rememberCheckbox = document.querySelector('#remember-password');
    if (!accountInput || !passwordInput) return;

    const [lastAccount] = getLoginHistoryList();
    if (!lastAccount) return;

    accountInput.value = lastAccount.account || '';

    if (lastAccount.rememberPassword && lastAccount.password) {
        passwordInput.value = lastAccount.password;
        if (rememberCheckbox) rememberCheckbox.checked = true;
    }
}

function renderLoginHistoryPanel() {
    const listBox = document.querySelector('#history-account-list');
    if (!listBox) return;

    const list = getLoginHistoryList();

    if (!list.length) {
        listBox.innerHTML = '<li class="history-list__empty">暂无历史账号</li>';
        return;
    }

    listBox.innerHTML = list.map((item) => {
        return `
            <li class="history-list__item">
                <button class="history-account-item" type="button" data-account="${escapeHTML(item.account)}">
                    <span>${escapeHTML(item.account)}</span>
                    <small>${item.rememberPassword ? '已保存密码' : '未保存密码'}</small>
                </button>
            </li>
        `;
    }).join('');

    const accountInput = document.querySelector('#login-account');
    const passwordInput = document.querySelector('#login-password');
    const rememberCheckbox = document.querySelector('#remember-password');
    const panel = document.querySelector('#history-account-panel');

    listBox.querySelectorAll('.history-account-item').forEach((btn) => {
        btn.addEventListener('click', () => {
            const account = btn.dataset.account || '';
            const target = getLoginHistoryList().find((item) => String(item.account) === String(account));
            if (!target) return;

            if (accountInput) accountInput.value = target.account || '';
            if (passwordInput) passwordInput.value = target.rememberPassword ? (target.password || '') : '';
            if (rememberCheckbox) rememberCheckbox.checked = Boolean(target.rememberPassword);
            if (panel) panel.classList.add('hidden');
        });
    });
}

function bindLoginHistoryEvents() {
    const openBtn = document.querySelector('#switch-history-account-btn');
    const closeBtn = document.querySelector('#close-history-account-btn');
    const panel = document.querySelector('#history-account-panel');
    const accountInput = document.querySelector('#login-account');
    const passwordInput = document.querySelector('#login-password');
    const rememberCheckbox = document.querySelector('#remember-password');

    if (openBtn && panel) {
        openBtn.addEventListener('click', () => {
            renderLoginHistoryPanel();
            panel.classList.remove('hidden');
        });
    }

    if (closeBtn && panel) {
        closeBtn.addEventListener('click', () => {
            panel.classList.add('hidden');
        });
    }

    if (accountInput && passwordInput && rememberCheckbox) {
        accountInput.addEventListener('change', () => {
            const account = accountInput.value.trim();
            const target = getLoginHistoryList().find((item) => String(item.account) === String(account));

            if (!target) return;
            passwordInput.value = target.rememberPassword ? (target.password || '') : '';
            rememberCheckbox.checked = Boolean(target.rememberPassword);
        });
    }
}

function bindSettingsEvents() {
    const logoutBtn = document.querySelector('#logout-btn');
    const profileSettingsBtn = document.querySelector('#profile-settings-btn');
    const editProfileBtn = document.querySelector('#edit-profile-btn');
    const cancelEditBtn = document.querySelector('#cancel-edit-profile-btn');
    const saveEditBtn = document.querySelector('#save-edit-profile-btn');
    const selectAvatarBtn = document.querySelector('#select-settings-avatar-btn');
    const avatarFileInput = document.querySelector('#settings-avatar-file');
    const selectBackgroundBtn = document.querySelector('#select-settings-background-btn');
    const backgroundFileInput = document.querySelector('#settings-background-file');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('account');
            localStorage.removeItem(ACTIVE_LOGIN_KEY);

            state.isLogin = false;
            state.homeHasLoaded = false;
            state.homeScrollTop = 0;
            state.recommendPosts = [];
            state.followPosts = [];
            showToast('已退出登录');
            goTo('/login');
        });
    }

    if (profileSettingsBtn) {
        profileSettingsBtn.addEventListener('click', () => {
            goTo('/settings');
        });
    }

    if (editProfileBtn) {
        editProfileBtn.addEventListener('click', () => {
            state.settingsEditVisible = true;
            renderSettingsEditPanel();
            loadSettingsProfileForm();
        });
    }

    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', () => {
            state.settingsEditVisible = false;
            renderSettingsEditPanel();
        });
    }

    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', () => {
            handleSaveProfileSettings();
        });
    }

    if (selectAvatarBtn && avatarFileInput) {
        selectAvatarBtn.addEventListener('click', () => {
            avatarFileInput.click();
        });

        avatarFileInput.addEventListener('change', (event) => {
            handleSettingsImageUpload(event, 'avatar');
        });
    }

    if (selectBackgroundBtn && backgroundFileInput) {
        selectBackgroundBtn.addEventListener('click', () => {
            backgroundFileInput.click();
        });

        backgroundFileInput.addEventListener('change', (event) => {
            handleSettingsImageUpload(event, 'background');
        });
    }
}

// 控制设置编辑面版显示

function renderSettingsEditPanel() {
    const menuPanel = document.querySelector('#settings-menu-panel');
    const editPanel = document.querySelector('#settings-edit-panel');

    if (!editPanel) return;

    if (state.settingsEditVisible) {
        if (menuPanel) menuPanel.classList.add('hidden');
        editPanel.classList.remove('hidden');
    } else {
        if (menuPanel) menuPanel.classList.remove('hidden');
        editPanel.classList.add('hidden');
    }
}

// 回填当前登陆用户资料

function loadSettingsProfileForm() {
    const currentUserId = localStorage.getItem('userId');
    if (!currentUserId) return;

    if (!state.currentProfileUser || String(state.currentProfileUser.userId) !== String(currentUserId)) {
        fetchProfileUser(currentUserId).then(() => {
            fillSettingsProfileForm();
        });
        return;
    }

    fillSettingsProfileForm();
}

// 用户数据回填到输入框

function fillSettingsProfileForm() {
    const user = state.currentProfileUser;
    if (!user) return;

    const nameInput = document.querySelector('#settings-user-name');
    const signatureInput = document.querySelector('#settings-user-signature');
    const avatarInput = document.querySelector('#settings-user-avatar');
    const backgroundInput = document.querySelector('#settings-user-background');

    if (nameInput) nameInput.value = user.userName || '';
    if (signatureInput) signatureInput.value = user.signature || '';
    if (avatarInput) avatarInput.value = user.image || '';
    if (backgroundInput) backgroundInput.value = user.background || '';

    renderSettingsEditPanel();
    renderSettingsImagePreview();
}

// 上传头像和背景

async function handleSettingsImageUpload(event, type) {
    const file = event.target.files?.[0];

    if (!file) return;

    const maxSize = 3 * 1024 * 1024;

    if (file.size > maxSize) {
        showToast('图片不能超过 3MB');
        event.target.value = '';
        return;
    }

    const imageUrl = await uploadPublishImage(file);

    if (!imageUrl) {
        event.target.value = '';
        return;
    }

    if (type === 'avatar') {
        const avatarInput = document.querySelector('#settings-user-avatar');
        if (avatarInput) {
            avatarInput.value = imageUrl;
        }
    }

    if (type === 'background') {
        const backgroundInput = document.querySelector('#settings-user-background');
        if (backgroundInput) {
            backgroundInput.value = imageUrl;
        }
    }

    renderSettingsImagePreview();
    showToast(type === 'avatar' ? '头像上传成功' : '背景图上传成功');

    event.target.value = '';
}

// 头像背景预览

function renderSettingsImagePreview() {
    const avatarInput = document.querySelector('#settings-user-avatar');
    const backgroundInput = document.querySelector('#settings-user-background');

    const avatarPreview = document.querySelector('#settings-avatar-preview');
    const backgroundPreview = document.querySelector('#settings-background-preview');

    const avatarUrl = avatarInput?.value.trim() || '';
    const backgroundUrl = backgroundInput?.value.trim() || '';

    if (avatarPreview) {
        if (avatarUrl) {
            avatarPreview.src = avatarUrl;
            avatarPreview.classList.remove('hidden');
        } else {
            avatarPreview.removeAttribute('src');
            avatarPreview.classList.add('hidden');
        }
    }

    if (backgroundPreview) {
        if (backgroundUrl) {
            backgroundPreview.src = backgroundUrl;
            backgroundPreview.classList.remove('hidden');
        } else {
            backgroundPreview.removeAttribute('src');
            backgroundPreview.classList.add('hidden');
        }
    }

    bindSettingsImagePreviewEvents();
}

// 保存资料

async function handleSaveProfileSettings() {
    const currentUserId = localStorage.getItem('userId');
    if (!currentUserId) {
        showToast('用户未登录');
        return;
    }

    const userName = document.querySelector('#settings-user-name')?.value.trim() || '';
    const signature = document.querySelector('#settings-user-signature')?.value.trim() || '';
    const image = document.querySelector('#settings-user-avatar')?.value.trim() || '';
    const background = document.querySelector('#settings-user-background')?.value.trim() || '';

    if (!userName) {
        showToast('昵称不能为空');
        return;
    }

    try {
        toggleGlobalLoading(true);

        const token = getToken();

        const response = await fetch(`${BASE_URL}/user/update`, {
            method: 'POST',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: Number(currentUserId),
                userName,
                signature,
                image,
                background
            })
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || '保存失败');
            return;
        }

        showToast('资料保存成功');
        state.settingsEditVisible = false;
        renderSettingsEditPanel();

        await fetchProfileUser(currentUserId);

        if (state.currentRoute === '/settings') {
            fillSettingsProfileForm();
        }
    } catch (error) {
        console.error('更新用户资料失败:', error);
        showToast('保存失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}
