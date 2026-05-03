// 01-core-router-utils

function init() {
    restoreLoginState();
    loadFavoriteStatusMap();
    renderTabbarIcons();
    renderBackIcons();
    renderSearchIcons();
    bindEvents();
    bindLoginConflictListener();
    bindMessageUnreadPollingEvents();
    handleInitialRoute();

    if (state.isLogin) {
        fetchUnreadMessages(true);
        startMessageUnreadPolling();
    }
}

function bindLoginConflictListener() {
    window.addEventListener('storage', (event) => {
        if (event.key !== ACTIVE_LOGIN_KEY || !event.newValue) return;

        let activeLogin = null;

        try {
            activeLogin = JSON.parse(event.newValue);
        } catch (error) {
            return;
        }

        if (!activeLogin) return;
        if (!state.isLogin) return;

        const currentUserId = localStorage.getItem('userId');
        const currentTabId = getCurrentTabId();

        const isSameAccount = String(activeLogin.userId) === String(currentUserId);
        const isAnotherTab = activeLogin.tabId !== currentTabId;

        if (isAnotherTab) {
            kickCurrentTabToLogin('该账号已在本设备其他页面登录，当前页面已退出');
        }
    });
}

function renderTabbarIcons() {
    const iconMap = {
        home: tabHomeIcon,
        message: tabMessageIcon,
        chat: tabChatIcon,
        profile: tabProfileIcon
    };

    const iconBoxes = document.querySelectorAll('[data-tabbar-icon]');

    iconBoxes.forEach((box) => {
        const iconName = box.dataset.tabbarIcon;
        const iconCreator = iconMap[iconName];

        if (!iconCreator) return;

        box.innerHTML = iconCreator();
    });
}

function renderBackIcons() {
    const backButtons = document.querySelectorAll('[data-back]');

    backButtons.forEach((btn) => {
        btn.innerHTML = backIcon();
        btn.setAttribute('aria-label', '返回');
        btn.setAttribute('title', '返回');
    });
}

function renderSearchIcons() {
    const searchBtn = document.querySelector('#search-submit-btn');
    const clearBtn = document.querySelector('#clear-search-input-btn');
    const homeSearchBtn = document.querySelector('#go-search-btn');
    const resultSearchBtn = document.querySelector('#result-search-btn');
    const resultClearBtn = document.querySelector('#clear-result-search-btn');

    if (searchBtn) {
        searchBtn.innerHTML = searchIcon();
    }

    if (clearBtn) {
        clearBtn.innerHTML = clearInputIcon();
    }

    if (homeSearchBtn) {
        homeSearchBtn.innerHTML = searchIcon();
        homeSearchBtn.setAttribute('aria-label', '搜索');
        homeSearchBtn.setAttribute('title', '搜索');
    }

    if (resultSearchBtn) {
        resultSearchBtn.innerHTML = searchIcon();
    }

    if (resultClearBtn) {
        resultClearBtn.innerHTML = clearInputIcon();
    }
}

function bindEvents() {
    window.addEventListener('hashchange', handleRouteChange);

    const loginForm = document.querySelector('#login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLoginSubmit);
    }

    const backButtons = document.querySelectorAll('[data-back]');
    backButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            history.back();
        });
    });

    const tabbarItems = document.querySelectorAll('#global-tabbar [data-tabbar-route]');
    tabbarItems.forEach((item) => {
        item.addEventListener('click', () => {
            const route = item.dataset.tabbarRoute;
            if (!route) return;

            if (route === '/profile') {
                const currentUserId = localStorage.getItem('userId');
                if (!currentUserId) {
                    showToast('用户 id 不存在');
                    return;
                }

                goTo(`/profile?userId=${currentUserId}`);
                return;
            }

            goTo(route);
        });
    });

    const goSearchBtn = document.querySelector('#go-search-btn');
    if (goSearchBtn) {
        goSearchBtn.addEventListener('click', () => {
            goTo('/search');
        });
    }

    bindHomeTabs();
    bindProfileTabs();
    bindProfileRelationPanelEvents();
    bindMessageTabs();
    bindSearchEvents();
    bindPasswordToggle();
    bindLoginHistoryEvents();
    restoreLastLoginAccount();
    bindSettingsEvents();
    bindPublishEvents();
    bindDetailCommentEvents();
    bindDetailActionEvents();
    bindPostMoreEvents();
    bindHomeScrollLoadMore();
    bindChatEvents();
}

function restoreLoginState() {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');

    if (!token || !userId) {
        state.isLogin = false;
        return;
    }

    const activeLogin = getActiveLoginInfo();
    const currentTabId = getCurrentTabId();

    if (!activeLogin) {
        markCurrentTabAsActiveLogin(userId);
        state.isLogin = true;
        return;
    }

    state.isLogin =
        String(activeLogin.userId) === String(userId) &&
        activeLogin.tabId === currentTabId;
}

function getCurrentTabId() {
    let tabId = sessionStorage.getItem(TAB_ID_KEY);

    if (!tabId) {
        tabId = `tab_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        sessionStorage.setItem(TAB_ID_KEY, tabId);
    }

    return tabId;
}

function getActiveLoginInfo() {
    try {
        const raw = localStorage.getItem(ACTIVE_LOGIN_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function markCurrentTabAsActiveLogin(userId) {
    const loginInfo = {
        userId: String(userId),
        tabId: getCurrentTabId(),
        loginTime: Date.now()
    };

    localStorage.setItem(ACTIVE_LOGIN_KEY, JSON.stringify(loginInfo));
}

function kickCurrentTabToLogin(message = '该账号已在其他页面登录，当前页面已退出') {
    state.isLogin = false;
    stopMessageUnreadPolling();

    if (state.chatSocket) {
        state.chatSocket.close();
        state.chatSocket = null;
    }

    goTo('/login');
    showToast(message);
}

function getToken() {
    return localStorage.getItem('token') || '';
}

function getCurrentUserId() {
    return String(localStorage.getItem('userId') || '');
}

function getCurrentDetailPostId() {
    const query = getRouteQuery();
    return query.get('id') || state.currentPostDetail?.postId || state.currentPostDetail?.id || '';
}

function getCommentDraftKey(postId) {
    const currentUserId = getCurrentUserId();
    return `${COMMENT_DRAFT_KEY_PREFIX}${currentUserId}_${postId}`;
}

function saveCommentDraft(postId, content) {
    if (!postId) return;

    const text = String(content || '');

    if (!text.trim()) {
        localStorage.removeItem(getCommentDraftKey(postId));
        return;
    }

    localStorage.setItem(getCommentDraftKey(postId), text);
}

function loadCommentDraft(postId) {
    if (!postId) return '';
    return localStorage.getItem(getCommentDraftKey(postId)) || '';
}

function clearCommentDraft(postId) {
    if (!postId) return;
    localStorage.removeItem(getCommentDraftKey(postId));
}

function ensureImagePreviewDialog() {
    let dialog = document.querySelector('#image-preview-dialog');

    if (dialog) return dialog;

    dialog = document.createElement('div');
    dialog.id = 'image-preview-dialog';
    dialog.className = 'image-preview-dialog hidden';
    dialog.innerHTML = `
        <div class="image-preview-dialog__mask"></div>
        <div class="image-preview-dialog__panel">
            <button class="image-preview-dialog__close" type="button" aria-label="关闭预览">×</button>
            <img class="image-preview-dialog__img" alt="图片预览">
        </div>
    `;

    document.body.appendChild(dialog);

    const closePreview = () => {
        dialog.classList.add('hidden');
        const img = dialog.querySelector('.image-preview-dialog__img');
        if (img) {
            img.removeAttribute('src');
        }
    };

    dialog.querySelector('.image-preview-dialog__mask')?.addEventListener('click', closePreview);
    dialog.querySelector('.image-preview-dialog__close')?.addEventListener('click', closePreview);

    return dialog;
}

function openImagePreview(imageUrl) {
    if (!imageUrl) return;

    const dialog = ensureImagePreviewDialog();
    const img = dialog.querySelector('.image-preview-dialog__img');

    if (!img) return;

    img.src = imageUrl;
    dialog.classList.remove('hidden');
}

function bindProfileImagePreviewEvents() {
    const coverImg = document.querySelector('#profile-cover .profile-cover__img');
    const avatarImg = document.querySelector('#profile-avatar .profile-avatar__img');

    if (coverImg) {
        coverImg.addEventListener('click', (event) => {
            event.stopPropagation();
            openImagePreview(coverImg.currentSrc || coverImg.src);
        });
    }

    if (avatarImg) {
        avatarImg.addEventListener('click', (event) => {
            event.stopPropagation();
            openImagePreview(avatarImg.currentSrc || avatarImg.src);
        });
    }
}

function bindSettingsImagePreviewEvents() {
    const avatarPreview = document.querySelector('#settings-avatar-preview');
    const backgroundPreview = document.querySelector('#settings-background-preview');

    if (avatarPreview && !avatarPreview.classList.contains('hidden')) {
        avatarPreview.onclick = () => {
            openImagePreview(avatarPreview.currentSrc || avatarPreview.src);
        };
    }

    if (backgroundPreview && !backgroundPreview.classList.contains('hidden')) {
        backgroundPreview.onclick = () => {
            openImagePreview(backgroundPreview.currentSrc || backgroundPreview.src);
        };
    }
}

function getRouteQuery() {
    const hash = location.hash || '';
    const queryString = hash.includes('?') ? hash.split('?')[1] : '';
    return new URLSearchParams(queryString);
}

function handleInitialRoute() {
    if (!location.hash) {
        goTo(state.isLogin ? '/home' : '/login');
        return;
    }

    handleRouteChange();
}

function handleRouteChange() {
    const hash = location.hash.slice(1) || '/login';
    const [path] = hash.split('?');

    if (!routes[path]) {
        goTo(state.isLogin ? '/home' : '/login');
        return;
    }

    if (!state.isLogin && path !== '/login') {
        goTo('/login');
        showToast('请先登录');
        return;
    }

    if (state.currentRoute === '/home' && path !== '/home') {
        state.homeScrollTop = window.scrollY || document.documentElement.scrollTop || 0;
    }

    if (state.currentRoute === '/post-detail' && path !== '/post-detail') {
        const oldPostId = getCurrentDetailPostId();
        const commentInput = document.querySelector('#detail-comment-input');

        if (commentInput) {
            saveCommentDraft(oldPostId, commentInput.value);
        }

        clearDetailSwiperTimer();
        state.detailSwiperIndex = 0;
        state.detailSwiperImageCount = 0;
        state.detailAuthorIsFollowing = false;
    }

    if (state.currentRoute === '/publish' && path !== '/publish') {
        savePublishAutoDraft();
    }

    state.currentRoute = path;
    renderPage(path);
}

function renderPage(path) {
    hideAllPages();

    const pageId = routes[path];
    const targetPage = document.getElementById(pageId);

    if (targetPage) {
        targetPage.classList.add('active');
    }

    updateTabbar(path);
    updateTabbarVisible(path);
    updatePageTitle(path);
    renderBackIcons();
    renderSearchIcons();

    if (path === '/login') {
        stopMessageUnreadPolling();
    }

    if (path === '/home') {
        if (state.homeHasLoaded) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    window.scrollTo(0, state.homeScrollTop || 0);
                });
            });
            return;
        }

        fetchPostActionStatus().then(() => {
            fetchHomeFollowPosts().then(() => {
                fetchRecommendPosts(true).then(() => {
                    state.homeHasLoaded = true;
                });
            });
        });
    }

    if (path === '/post-detail') {
        const query = getRouteQuery();
        const postId = query.get('id');

        if (!postId) {
            showToast('帖子 id 不存在');
            return;
        }

        fetchPostDetail(postId);
        fetchCommentList(postId);
        restoreCommentDraftToInput(postId);
    }

    if (path === '/profile') {
        const query = getRouteQuery();
        const userId = query.get('userId');

        if (!userId) {
            showToast('用户 id 不存在');
            return;
        }

        state.currentProfileTab = 'posts';
        state.profileTabScrollMap = {
            posts: 0,
            likes: 0,
            favorites: 0
        };

        fetchProfileUser(userId);
        fetchProfilePosts(userId);

        if (String(userId) === String(getCurrentUserId())) {
            fetchLikedPostIds();
            fetchFavoritedPostIds();
        } else {
            state.profileLikedPosts = [];
            state.profileFavoritedPosts = [];
            renderProfileLikedPosts();
            renderProfileFavoritedPosts();
        }

        fetchFollowStatus(userId);
        fetchFollowingIds(userId);
        fetchFollowerIds(userId);
    }

    if (path === '/search') {
        loadSearchHistory();
        fetchSearchRecommend();
    }

    if (path === '/search-result') {
        const query = getRouteQuery();
        const keyword = query.get('keyword') || '';

        if (!keyword) {
            showToast('搜索关键词不能为空');
            return;
        }

        fetchPostActionStatus().then(() => {
            fetchSearchResult(keyword);
        });
    }

    if (path === '/topic') {
        const query = getRouteQuery();
        const topic = query.get('topic') || '';

        if (!topic) {
            showToast('主题不能为空');
            return;
        }

        state.currentTopicName = topic;
        loadTopicPage(topic);
    }

    if (path === '/publish') {
        const query = getRouteQuery();
        const postId = query.get('postId') || '';

        state.currentEditingPostId = postId;

        if (postId) {
            fetchPostDetail(postId).then(() => {
                renderPostToPublishForm();
            });
        } else {
            renderDraftToPublishForm();
        }
    }

    if (path === '/drafts') {
        loadDraftList();
    }

    if (path === '/messages') {
        fetchAllMessages();
        fetchUnreadMessages();
    }

    if (path === '/chat-list') {
        renderChatSessionListPage();
    }

    if (path === '/chat') {
        const query = getRouteQuery();
        const userId = query.get('userId');

        if (!userId) {
            showToast('聊天用户 id 不存在');
            return;
        }

        if (state.chatSocket) {
            state.chatSocket.close();
            state.chatSocket = null;
        }

        state.currentChatUserId = userId;
        loadChatLocalState();
        restoreDeletedChatSession(userId);
        renderChatHeader(userId);
        fetchChatHistory(userId);
        connectChatSocket();
    }

    if (path === '/settings') {
        state.settingsEditVisible = false;
        renderSettingsEditPanel();
        loadSettingsProfileForm();
    }
}

function hideAllPages() {
    const pages = document.querySelectorAll('.page');
    pages.forEach((page) => {
        page.classList.remove('active');
    });
}

function updateTabbar(path) {
    const tabbarItems = document.querySelectorAll('#global-tabbar [data-tabbar-route]');

    tabbarItems.forEach((item) => {
        item.classList.remove('active');

        if (item.dataset.tabbarRoute === path) {
            item.classList.add('active');
        }
    });
}

function updateTabbarVisible(path) {
    const tabbar = document.querySelector('#global-tabbar');
    if (!tabbar) return;

    const showRoutes = ['/home', '/publish', '/messages', '/chat-list', '/profile'];

    if (showRoutes.includes(path)) {
        tabbar.classList.remove('hidden');
    } else {
        tabbar.classList.add('hidden');
    }
}

function updatePageTitle(path) {
    const pageTitleMap = {
        '/login': '登录',
        '/home': '首页',
        '/post-detail': '帖子详情',
        '/publish': '发布帖子',
        '/search': '搜索',
        '/search-result': '搜索结果',
        '/topic': '主题详情',
        '/profile': '个人主页',
        '/drafts': '草稿箱',
        '/settings': '设置',
        '/messages': '消息',
        '/chat-list': '私聊',
        '/chat': '私聊'
    };

    document.title = pageTitleMap[path] || 'Final Assessment';
}

function goTo(path) {
    location.hash = `#${path}`;
}

function showWaterfallAfterRender(list) {
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            list.style.visibility = 'visible';
        });
    });
}

function saveProfileTabScroll() {
    const currentTab = state.currentProfileTab || 'posts';
    state.profileTabScrollMap[currentTab] = window.scrollY || window.pageYOffset || 0;
}

function restoreProfileTabScroll(tab) {
    const top = state.profileTabScrollMap[tab] || 0;

    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            window.scrollTo(0, top);
        });
    });
}

function normalizeSearchText(value = '') {
    return String(value).toLowerCase().replace(/\s+/g, '');
}

function highlightKeyword(text = '', keyword = '') {
    const source = String(text || '');
    const key = String(keyword || '').trim();

    if (!source || !key) {
        return escapeHTML(source);
    }

    const normalizedSource = normalizeSearchText(source);
    const normalizedKey = normalizeSearchText(key);

    if (!normalizedKey || !normalizedSource.includes(normalizedKey)) {
        return escapeHTML(source);
    }

    const lowerSource = source.toLowerCase();
    const lowerKey = key.toLowerCase();

    const index = lowerSource.indexOf(lowerKey);

    if (index === -1) {
        return escapeHTML(source);
    }

    const before = source.slice(0, index);
    const match = source.slice(index, index + key.length);
    const after = source.slice(index + key.length);

    return `${escapeHTML(before)}<mark class="search-highlight">${escapeHTML(match)}</mark>${escapeHTML(after)}`;
}

function formatLocalDateTime(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    const second = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function toggleGlobalLoading(show) {
    const loading = document.querySelector('#global-loading');
    if (!loading) return;

    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

function escapeHTML(value = '') {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

// 点赞图标

function heartIcon(active = false) {
    return `
        <svg
            class="stat-icon stat-icon--heart ${active ? 'active' : ''}"
            viewBox="0 0 1024 1024"
            aria-hidden="true"
        >
            <path
                d="M533.504 268.288q33.792-41.984 71.68-75.776 32.768-27.648 74.24-50.176t86.528-19.456q63.488 5.12 105.984 30.208t67.584 63.488 34.304 87.04 6.144 99.84-17.92 97.792-36.864 87.04-48.64 74.752-53.248 61.952q-40.96 41.984-85.504 78.336t-84.992 62.464-73.728 41.472-51.712 15.36q-20.48 1.024-52.224-14.336t-69.632-41.472-79.872-61.952-82.944-75.776q-26.624-25.6-57.344-59.392t-57.856-74.24-46.592-87.552-21.504-100.352 11.264-99.84 39.936-83.456 65.536-61.952 88.064-35.328q24.576-5.12 49.152-1.536t48.128 12.288 45.056 22.016 40.96 27.648q45.056 33.792 86.016 80.896z"
                fill="currentColor"
            ></path>
        </svg>
    `;
}

// 收藏图标

function starIcon(active = false) {
    return `
        <svg
            class="stat-icon stat-icon--star ${active ? 'active' : ''}"
            viewBox="0 0 1426 1024"
            aria-hidden="true"
        >
            <path
                d="M985.6 1022.976c-14.848 0-31.744-4.096-47.104-12.288L716.288 899.584l-223.744 111.104c-14.336 7.68-30.208 11.776-47.104 11.776-21.504 0-42.496-6.656-59.392-19.456-31.232-23.552-47.104-64-39.936-101.376l45.568-237.056-175.616-163.328c-27.136-27.648-37.376-67.072-27.136-104.448l0.512-1.024c12.8-38.4 44.544-65.024 82.944-70.144l243.712-44.544L625.152 58.88C642.56 23.552 678.4 1.024 716.288 1.024c39.424 0 76.288 23.552 91.648 58.368l109.056 221.696 243.712 42.496c38.4 5.632 70.656 33.28 81.408 71.168 12.288 36.864 2.048 77.312-25.6 104.96l-0.512 0.512-174.592 164.864 44.032 237.568c7.168 37.888-8.192 76.288-39.424 100.352-17.92 12.8-38.912 19.968-60.416 19.968z"
                fill="currentColor"
            ></path>
        </svg>
    `;
}

function commentIcon() {
    return `
        <svg
            class="stat-icon stat-icon--comment"
            viewBox="0 0 1024 1024"
            aria-hidden="true"
        >
            <path
                d="M952.888889 796.444444h-256l-82.488889 162.133334c-2.844444 5.688889-8.533333 5.688889-11.377778 2.844444L355.555556 796.444444h-284.444445c-28.444444 0-56.888889-14.222222-56.888889-56.888888V108.088889c0-28.444444 22.755556-51.2 51.2-51.2h896c28.444444 0 51.2 22.755556 51.2 51.2v637.155555c-5.688889 31.288889-17.066667 51.2-59.733333 51.2z m0-682.666666h-881.777778v625.777778h312.888889l199.111111 142.222222 71.111111-142.222222h298.666667V113.777778z m-227.555556 398.222222c-31.288889 0-56.888889-25.6-56.888889-56.888889s25.6-56.888889 56.888889-56.888889 56.888889 25.6 56.888889 56.888889-25.6 56.888889-56.888889 56.888889z m-227.555555 0c-31.288889 0-56.888889-25.6-56.888889-56.888889s25.6-56.888889 56.888889-56.888889 56.888889 25.6 56.888889 56.888889-25.6 56.888889-56.888889 56.888889z m-230.4 0c-31.288889 0-56.888889-25.6-56.888889-56.888889s25.6-56.888889 56.888889-56.888889 56.888889 25.6 56.888889 56.888889-25.6 56.888889-56.888889 56.888889z"
                fill="currentColor"
            ></path>
        </svg>
    `;
}

function tabHomeIcon() {
    return `
        <svg class="tabbar-svg" viewBox="0 0 1024 1024" aria-hidden="true">
            <path d="M555.541333 117.994667l312.874667 224.565333A117.333333 117.333333 0 0 1 917.333333 437.866667V800c0 64.8-52.533333 117.333333-117.333333 117.333333H640V746.666667c0-70.688-57.312-128-128-128s-128 57.312-128 128v170.666666H224c-64.8 0-117.333333-52.533333-117.333333-117.333333V437.877333a117.333333 117.333333 0 0 1 48.917333-95.317333l312.874667-224.565333a74.666667 74.666667 0 0 1 87.082666 0z"></path>
        </svg>
    `;
}

function tabMessageIcon() {
    return `
        <svg class="tabbar-svg" viewBox="0 0 1024 1024" aria-hidden="true">
            <path d="M646.760058 802.907161c-19.971213 56.220055-73.187221 96.72273-136.243069 96.72273-63.055848 0-116.271856-40.502675-136.243069-96.72273h272.486138zM844.479632 785.377212H176.564487c-12.766569-15.508238-15.823853-38.601379-3.035736-57.784188l46.660339-69.903049v-193.551933c0-128.746892 83.901657-237.792556 199.946625-275.812138 13.824957-36.636706 48.906403-62.903744 90.382542-62.903744 41.474871 0 76.556317 26.268306 90.381274 62.903744 116.044968 38.019582 199.945358 147.065246 199.945357 275.812138v193.551933l46.660339 69.903049c12.786849 19.225905 9.7321 42.297498-3.025595 57.784188z"></path>
        </svg>
    `;
}

function tabChatIcon() {
    return `
        <svg class="tabbar-svg" viewBox="0 0 1024 1024" aria-hidden="true">
            <path d="M808.96 774.826667h-204.8l-102.4 136.533333-102.4-136.533333h-170.666667c-75.093333 0-136.533333-61.44-136.533333-136.533334v-375.466666c0-75.093333 61.44-136.533333 136.533333-136.533334h580.266667c75.093333 0 136.533333 61.44 136.533333 136.533334v375.466666c0 75.093333-61.44 136.533333-136.533333 136.533334z m-529.066667-375.466667c-29.013333 0-51.2 22.186667-51.2 51.2s22.186667 51.2 51.2 51.2 51.2-22.186667 51.2-51.2-23.893333-51.2-51.2-51.2z m238.933334 0c-29.013333 0-51.2 22.186667-51.2 51.2s22.186667 51.2 51.2 51.2 51.2-22.186667 51.2-51.2-23.893333-51.2-51.2-51.2z m238.933333 0c-29.013333 0-51.2 22.186667-51.2 51.2s22.186667 51.2 51.2 51.2 51.2-22.186667 51.2-51.2-23.893333-51.2-51.2-51.2z"></path>
        </svg>
    `;
}

function tabProfileIcon() {
    return `
        <svg class="tabbar-svg" viewBox="0 0 1024 1024" aria-hidden="true">
            <path d="M561.975362 570.009567c118.779087-25.056318 207.964552-130.953221 207.408227-256.993438C768.740563 168.848374 650.929627 52.070613 506.761871 52.720864c-144.174981 0.643025-260.938291 118.453962-260.295265 262.614492 0.56355 126.047442 90.681041 231.142369 209.684103 255.143837-179.563057 26.559119-317.445058 182.048458-316.606957 368.73537a38.104678 38.104678 0 0 0 38.270853 37.931278l666.102138-2.962252a38.111903 38.111903 0 0 0 37.931278-38.270854c-0.830876-186.694137-140.092853-340.940775-319.872659-365.903168z"></path>
        </svg>
    `;
}

function backIcon() {
    return `
        <svg class="back-icon" viewBox="0 0 1024 1024" aria-hidden="true">
            <path d="M341.333333 298.666667v170.666666L85.333333 256l256-213.333333v170.666666h213.333334a341.333333 341.333333 0 1 1 0 682.666667H170.666667v-85.333333h384a256 256 0 0 0 0-512H341.333333z"></path>
        </svg>
    `;
}

function searchIcon() {
    return `
        <svg class="search-page-icon" viewBox="0 0 1024 1024" aria-hidden="true">
            <path d="M1011.80201 953.592l-235.034-234.96A438.77 438.77 0 1 0 0.00001 438.768a438.77 438.77 0 0 0 718.631 338l235.034 235.033a41.171 41.171 0 0 0 58.283 0 41.464 41.464 0 0 0-0.146-58.283z m-434.381-186.33c-43.877 18.647-90.46 28.008-138.652 28.008a355.696 355.696 0 0 1-252.073-104.428 355.696 355.696 0 0 1-76.419-390.797 355.696 355.696 0 0 1 76.42-113.349 355.696 355.696 0 0 1 390.797-76.419c42.414 17.917 80.514 43.658 113.348 76.42a355.696 355.696 0 0 1 76.42 390.797 355.696 355.696 0 0 1-76.42 113.348c-32.834 32.762-70.86 58.503-113.348 76.42z"></path>
        </svg>
    `;
}

function clearInputIcon() {
    return `
        <svg class="search-clear-icon" viewBox="0 0 1024 1024" aria-hidden="true">
            <path d="M851.416 217.84l-45.256-45.248L512 466.744l-294.152-294.16-45.256 45.256L466.744 512l-294.152 294.16 45.248 45.256L512 557.256l294.16 294.16 45.256-45.256L557.256 512z"></path>
        </svg>
    `;
}

function showToast(message = '') {
    const toast = document.querySelector('#global-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.remove('hidden');

    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => {
        toast.classList.add('hidden');
    }, 2000);
}
