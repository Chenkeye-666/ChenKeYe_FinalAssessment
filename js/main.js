const BASE_URL = 'https://duck1437.shop/front-assess';

const routes = {
    '/login': 'page-login',
    '/home': 'page-home',
    '/post-detail': 'page-post-detail',
    '/publish': 'page-publish',
    '/search': 'page-search',
    '/search-result': 'page-search-result',
    '/topic': 'page-topic',
    '/profile': 'page-profile',
    '/drafts': 'page-drafts',
    '/settings': 'page-settings',
    '/messages': 'page-messages',
    '/chat': 'page-chat'
};

const state = {
    currentRoute: '/login',
    isLogin: false,
    recommendPosts: [],
    recommendLastPostId: 0,
    recommendLimit: 10
};

function init() {
    restoreLoginState();
    bindEvents();
    handleInitialRoute();
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

    const tabbarItems = document.querySelectorAll('.tabbar-item');
    tabbarItems.forEach((item) => {
        item.addEventListener('click', () => {
            const route = item.dataset.tabbarRoute;
            if (!route) return;
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
    bindMessageTabs();
    bindSearchEvents();
    bindPasswordToggle();
    bindSettingsEvents();
}

function restoreLoginState() {
    const token = localStorage.getItem('token');
    const userId = localStorage.getItem('userId');

    if (token && userId) {
        state.isLogin = true;
    }
}

function getToken() {
    return localStorage.getItem('token') || '';
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

    if (path === '/home') {
        fetchRecommendPosts();
    }
}

function hideAllPages() {
    const pages = document.querySelectorAll('.page');
    pages.forEach((page) => {
        page.classList.remove('active');
    });
}

function updateTabbar(path) {
    const tabbarItems = document.querySelectorAll('.tabbar-item');
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

    const showRoutes = ['/home', '/publish', '/messages', '/profile'];

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
        '/chat': '私聊'
    };

    document.title = pageTitleMap[path] || 'Final Assessment';
}

function goTo(path) {
    location.hash = `#${path}`;
}

async function handleLoginSubmit(event) {
    event.preventDefault();

    const accountInput = document.querySelector('#login-account');
    const passwordInput = document.querySelector('#login-password');

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
        console.log('登录返回结果:', result);

        if (result.code === 200) {
            const { token, userId, account: loginAccount } = result.data || {};

            localStorage.setItem('token', token || '');
            localStorage.setItem('userId', userId || '');
            localStorage.setItem('account', loginAccount || account);

            state.isLogin = true;

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
async function fetchRecommendPosts() {
    try {
        toggleGlobalLoading(true);

        const token = getToken();

        const params = new URLSearchParams({
            lastPostId: String(state.recommendLastPostId),
            limit: String(state.recommendLimit)
        });

        const response = await fetch(`${BASE_URL}/post/all?${params.toString()}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();
        console.log('帖子列表返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '获取帖子失败');
            return;
        }

        state.recommendPosts = result.data || [];
        renderRecommendPostList();
    } catch (error) {
        console.error('获取帖子列表失败:', error);
        showToast('获取帖子失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 渲染帖子列表
function renderRecommendPostList() {
    const list = document.querySelector('#recommend-post-list');
    if (!list) return;

    if (!state.recommendPosts.length) {
        list.innerHTML = '<div class="empty-block">暂无帖子内容</div>';
        return;
    }

    const html = state.recommendPosts.map((item) => {
        const imageList = item.images ? item.images.split(',') : [];
        const cover = imageList[0] || '';
        const title = item.title || '未命名帖子';
        const content = item.content || '';
        const topic = item.topic || '未分类';
        const location = item.location || '未知地点';
        const likeCount = item.likeCount ?? 0;
        const favCount = item.favCount ?? 0;
        const commentCount = item.commentCount ?? 0;

        return `
      <article class="post-card" data-post-id="${item.postId}">
        <div class="post-card__cover-wrap">
          ${cover
                ? `<img class="post-card__cover" src="${cover}" alt="${title}">`
                : `<div class="post-card__cover post-card__cover--empty">暂无图片</div>`
            }
        </div>

        <div class="post-card__body">
          <h3 class="post-card__title">${escapeHTML(title)}</h3>
          <p class="post-card__content">${escapeHTML(content)}</p>

          <div class="post-card__meta">
            <span>#${escapeHTML(topic)}</span>
            <span>${escapeHTML(location)}</span>
          </div>

          <div class="post-card__stats">
            <span>赞 ${likeCount}</span>
            <span>藏 ${favCount}</span>
            <span>评 ${commentCount}</span>
          </div>
        </div>
      </article>
    `;
    }).join('');

    list.innerHTML = html;

    bindRecommendPostCardEvents();
}

// 点击帖子卡片事件
function bindRecommendPostCardEvents() {
    const cards = document.querySelectorAll('.post-card');

    cards.forEach((card) => {
        card.addEventListener('click', () => {
            const postId = card.dataset.postId;
            if (!postId) return;

            goTo(`/post-detail?id=${postId}`);
        });
    });
}

function bindHomeTabs() {
    const homeTabButtons = document.querySelectorAll('[data-home-tab]');
    const recommendPanel = document.querySelector('#home-recommend-panel');
    const followPanel = document.querySelector('#home-follow-panel');

    homeTabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            homeTabButtons.forEach((item) => item.classList.remove('active'));
            btn.classList.add('active');

            const tab = btn.dataset.homeTab;

            if (tab === 'recommend') {
                recommendPanel.classList.add('active');
                recommendPanel.classList.remove('hidden');
                followPanel.classList.remove('active');
                followPanel.classList.add('hidden');
            } else {
                followPanel.classList.add('active');
                followPanel.classList.remove('hidden');
                recommendPanel.classList.remove('active');
                recommendPanel.classList.add('hidden');
            }
        });
    });
}

function bindProfileTabs() {
    const buttons = document.querySelectorAll('[data-profile-tab]');
    const postsPanel = document.querySelector('#profile-posts-panel');
    const likesPanel = document.querySelector('#profile-likes-panel');
    const favoritesPanel = document.querySelector('#profile-favorites-panel');

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            buttons.forEach((item) => item.classList.remove('active'));
            btn.classList.add('active');

            postsPanel.classList.remove('active');
            likesPanel.classList.remove('active');
            favoritesPanel.classList.remove('active');

            postsPanel.classList.add('hidden');
            likesPanel.classList.add('hidden');
            favoritesPanel.classList.add('hidden');

            const tab = btn.dataset.profileTab;

            if (tab === 'posts') {
                postsPanel.classList.add('active');
                postsPanel.classList.remove('hidden');
            } else if (tab === 'likes') {
                likesPanel.classList.add('active');
                likesPanel.classList.remove('hidden');
            } else if (tab === 'favorites') {
                favoritesPanel.classList.add('active');
                favoritesPanel.classList.remove('hidden');
            }
        });
    });
}

function bindMessageTabs() {
    const buttons = document.querySelectorAll('[data-message-tab]');
    const panels = {
        follow: document.querySelector('#message-follow-panel'),
        comment: document.querySelector('#message-comment-panel'),
        mention: document.querySelector('#message-mention-panel'),
        chat: document.querySelector('#message-chat-panel')
    };

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            buttons.forEach((item) => item.classList.remove('active'));

            Object.values(panels).forEach((panel) => {
                panel.classList.remove('active');
                panel.classList.add('hidden');
            });

            btn.classList.add('active');

            const tab = btn.dataset.messageTab;
            if (panels[tab]) {
                panels[tab].classList.add('active');
                panels[tab].classList.remove('hidden');
            }
        });
    });
}

function bindSearchEvents() {
    const searchInput = document.querySelector('#search-input');
    const resultSearchBtn = document.querySelector('#result-search-btn');
    const clearSearchBtn = document.querySelector('#clear-search-input-btn');

    if (searchInput) {
        searchInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const keyword = searchInput.value.trim();
                if (!keyword) {
                    showToast('请输入搜索内容');
                    return;
                }
                goTo('/search-result');
            }
        });
    }

    if (resultSearchBtn) {
        resultSearchBtn.addEventListener('click', () => {
            const input = document.querySelector('#result-search-input');
            const keyword = input.value.trim();

            if (!keyword) {
                showToast('请输入搜索内容');
                return;
            }

            showToast(`开始搜索：${keyword}`);
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
            }
        });
    }
}

function bindPasswordToggle() {
    const toggleBtn = document.querySelector('#toggle-password-btn');
    const passwordInput = document.querySelector('#login-password');

    if (!toggleBtn || !passwordInput) return;

    toggleBtn.addEventListener('click', () => {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        toggleBtn.textContent = isPassword ? '隐藏' : '显示';
    });
}

function bindSettingsEvents() {
    const logoutBtn = document.querySelector('#logout-btn');
    const profileSettingsBtn = document.querySelector('#profile-settings-btn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('token');
            localStorage.removeItem('userId');
            localStorage.removeItem('account');

            state.isLogin = false;
            showToast('已退出登录');
            goTo('/login');
        });
    }

    if (profileSettingsBtn) {
        profileSettingsBtn.addEventListener('click', () => {
            goTo('/settings');
        });
    }
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

init();