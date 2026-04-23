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
    recommendLimit: 10,
    currentPostDetail: null,
    currentProfileUser: null,
    profilePosts: [],
    searchRecommendList: [],
    searchResultData: null,
    searchHistoryList: [],
    publishImageUrls: [],
    draftPostData: null,
    commentList: [],
    currentCommentSortType: 1,
    detailIsLiked: false,
    detailIsFavored: false,
    favoriteStatusMap: {}
};

function init() {
    restoreLoginState();
    loadFavoriteStatusMap();
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
    bindPublishEvents();
    bindDetailCommentEvents();
    bindDetailActionEvents();
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

function loadFavoriteStatusMap() {
    const map = JSON.parse(localStorage.getItem('favoriteStatusMap') || '{}');
    state.favoriteStatusMap = map && typeof map === 'object' ? map : {};
}

function setFavoriteStatus(postId, isFavored) {
    state.favoriteStatusMap[String(postId)] = Boolean(isFavored);
    localStorage.setItem('favoriteStatusMap', JSON.stringify(state.favoriteStatusMap));
}

// 读取路由参数
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

    if (path === '/post-detail') {
        const query = getRouteQuery();
        const postId = query.get('id');

        if (!postId) {
            showToast('帖子 id 不存在');
            return;
        }

        fetchPostDetail(postId);
        fetchCommentList(postId);
    }

    if (path === '/profile') {
        const query = getRouteQuery();
        const userId = query.get('userId');

        if (!userId) {
            showToast('用户 id 不存在');
            return;
        }

        fetchProfileUser(userId);
        fetchProfilePosts(userId);
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

        fetchSearchResult(keyword);
    }

    if (path === '/publish') {
        renderDraftToPublishForm();
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

// 请求帖子详情
async function fetchPostDetail(postId) {
    try {
        toggleGlobalLoading(true);

        const token = getToken();

        const response = await fetch(`${BASE_URL}/post/${postId}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();
        console.log('帖子详情返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '获取帖子详情失败');
            return;
        }

        state.currentPostDetail = result.data || null;
        renderPostDetail();
    } catch (error) {
        console.error('获取帖子详情失败:', error);
        showToast('获取帖子详情失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 渲染帖子详情
function renderPostDetail() {
    const detail = state.currentPostDetail;
    if (!detail) return;

    const authorCard = document.querySelector('#post-author-card');
    const swiper = document.querySelector('#post-swiper');
    const contentBox = document.querySelector('#post-detail-content');
    const topicList = document.querySelector('#post-topic-list');

    const likeBtn = document.querySelector('#detail-like-btn');
    const favoriteBtn = document.querySelector('#detail-favorite-btn');
    const commentBtn = document.querySelector('#detail-comment-btn');

    const imageList = detail.images ? detail.images.split(',') : [];
    const title = detail.title || '未命名帖子';
    const content = detail.content || '';
    const topic = detail.topic || '未分类';
    const location = detail.location || '未知地点';
    const createTime = detail.createTime || '';
    const likeCount = detail.likeCount ?? 0;
    const favCount = detail.favCount ?? 0;
    const commentCount = detail.commentCount ?? 0;

    const likedValue = detail.isLiked;
    const postId = detail.postId || '';
    const favoredValue =
        detail.isFavorited ??
        detail.isFav ??
        detail.isFavorite ??
        detail.isFavored ??
        null;

    state.detailIsLiked = likedValue === true || likedValue === 1 || likedValue === '1';

    if (favoredValue !== null && favoredValue !== undefined) {
        state.detailIsFavored = favoredValue === true || favoredValue === 1 || favoredValue === '1';
        setFavoriteStatus(postId, state.detailIsFavored);
    } else {
        state.detailIsFavored = Boolean(state.favoriteStatusMap[String(postId)]);
    }

    if (authorCard) {
        authorCard.innerHTML = `
    <div class="detail-user-card detail-user-card--clickable">
      <div class="detail-user-card__avatar"></div>
      <div class="detail-user-card__info">
        <h3>用户 ${detail.userId}</h3>
        <p>${escapeHTML(createTime)}</p>
      </div>
    </div>
  `;

        authorCard.onclick = () => {
            goTo(`/profile?userId=${detail.userId}`);
        };
    }

    if (swiper) {
        if (!imageList.length) {
            swiper.innerHTML = `<div class="detail-image-empty">暂无图片</div>`;
        } else {
            swiper.innerHTML = imageList.map((src) => {
                return `<img class="detail-image" src="${src.trim()}" alt="${escapeHTML(title)}">`;
            }).join('');
        }
    }

    if (contentBox) {
        contentBox.innerHTML = `
      <h1 class="detail-title">${escapeHTML(title)}</h1>
      <p class="detail-text">${escapeHTML(content)}</p>
      <div class="detail-extra">
        <span>#${escapeHTML(topic)}</span>
        <span>${escapeHTML(location)}</span>
      </div>
    `;
    }

    if (topicList) {
        topicList.innerHTML = `
      <button class="topic-chip" type="button">#${escapeHTML(topic)}</button>
    `;
    }

    if (likeBtn) {
        likeBtn.textContent = `${state.detailIsLiked ? '已点赞' : '点赞'} ${likeCount}`;
    }

    if (favoriteBtn) {
        favoriteBtn.textContent = `${state.detailIsFavored ? '已收藏' : '收藏'} ${favCount}`;
    }

    if (commentBtn) {
        commentBtn.textContent = `评论 ${commentCount}`;
    }
}

async function fetchProfileUser(userId) {
    try {
        toggleGlobalLoading(true);

        const token = getToken();
        const params = new URLSearchParams({
            id: String(userId)
        });

        const response = await fetch(`${BASE_URL}/user/getUserById?${params.toString()}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();
        console.log('用户资料返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '获取用户信息失败');
            return;
        }

        state.currentProfileUser = result.data || null;
        renderProfileUser();
    } catch (error) {
        console.error('获取用户信息失败:', error);
        showToast('获取用户信息失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

async function fetchProfilePosts(userId) {
    try {
        const token = getToken();

        const response = await fetch(`${BASE_URL}/post/getPostByUser/${userId}`, {
            method: 'POST',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();
        console.log('个人帖子返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '获取个人帖子失败');
            return;
        }

        state.profilePosts = result.data || [];
        renderProfilePosts();
    } catch (error) {
        console.error('获取个人帖子失败:', error);
        showToast('获取个人帖子失败，请稍后重试');
    }
}

function renderProfileUser() {
    const user = state.currentProfileUser;
    if (!user) return;

    const cover = document.querySelector('#profile-cover');
    const avatar = document.querySelector('#profile-avatar');
    const name = document.querySelector('#profile-name');
    const signature = document.querySelector('#profile-signature');
    const stats = document.querySelector('#profile-stat-list');
    const actionRow = document.querySelector('#profile-action-row');

    const currentUserId = localStorage.getItem('userId');
    const isSelf = String(user.userId) === String(currentUserId);
    const postCount = state.profilePosts.length;

    if (cover) {
        cover.innerHTML = user.background
            ? `<img class="profile-cover__img" src="${user.background}" alt="背景图">`
            : '';
    }

    if (avatar) {
        avatar.innerHTML = user.image
            ? `<img class="profile-avatar__img" src="${user.image}" alt="${escapeHTML(user.userName || '用户头像')}">`
            : '';
    }

    if (name) {
        name.textContent = user.userName || '未命名用户';
    }

    if (signature) {
        signature.textContent = user.signature || '这个人很懒，还没有签名。';
    }

    if (stats) {
        stats.innerHTML = `
      <div class="profile-stat-item">
        <strong>${postCount}</strong>
        <span>帖子</span>
      </div>
      <div class="profile-stat-item">
        <strong>0</strong>
        <span>获赞</span>
      </div>
      <div class="profile-stat-item">
        <strong>0</strong>
        <span>关注</span>
      </div>
      <div class="profile-stat-item">
        <strong>0</strong>
        <span>粉丝</span>
      </div>
    `;
    }

    if (actionRow) {
        if (isSelf) {
            actionRow.innerHTML = `
        <button id="go-drafts-btn" class="secondary-btn" type="button">草稿箱</button>
        <button id="go-settings-btn" class="primary-btn" type="button">设置</button>
      `;
        } else {
            actionRow.innerHTML = `
        <button id="follow-user-btn" class="primary-btn" type="button">关注</button>
        <button id="chat-user-btn" class="secondary-btn" type="button">私聊</button>
      `;
        }
    }

    bindProfileActionEvents();
}

function renderProfilePosts() {
    const list = document.querySelector('#profile-post-list');
    if (!list) return;

    if (!state.profilePosts.length) {
        list.innerHTML = '<div class="empty-block">这个用户还没有发布帖子</div>';
        renderProfileUser();
        return;
    }

    const html = state.profilePosts.map((item) => {
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
                ? `<img class="post-card__cover" src="${cover}" alt="${escapeHTML(title)}">`
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
    bindProfilePostCardEvents();
    renderProfileUser();
}

function bindProfilePostCardEvents() {
    const cards = document.querySelectorAll('#profile-post-list .post-card');

    cards.forEach((card) => {
        card.addEventListener('click', () => {
            const postId = card.dataset.postId;
            if (!postId) return;

            goTo(`/post-detail?id=${postId}`);
        });
    });
}

function bindProfileActionEvents() {
    const goDraftsBtn = document.querySelector('#go-drafts-btn');
    const goSettingsBtn = document.querySelector('#go-settings-btn');

    if (goDraftsBtn) {
        goDraftsBtn.addEventListener('click', () => {
            goTo('/drafts');
        });
    }

    if (goSettingsBtn) {
        goSettingsBtn.addEventListener('click', () => {
            goTo('/settings');
        });
    }
}

// 获取搜索推荐
async function fetchSearchRecommend() {
    try {
        const token = getToken();

        const response = await fetch(`${BASE_URL}/search/getSearchRecommend`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();
        console.log('搜索推荐返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '获取搜索推荐失败');
            return;
        }

        state.searchRecommendList = result.data?.postLists || [];
        renderSearchRecommend();
    } catch (error) {
        console.error('获取搜索推荐失败:', error);
        showToast('获取搜索推荐失败，请稍后重试');
    }
}

// 渲染搜索推荐
function renderSearchRecommend() {
    const list = document.querySelector('#search-suggest-list');
    if (!list) return;

    if (!state.searchRecommendList.length) {
        list.innerHTML = '<div class="empty-block">暂无推荐内容</div>';
        return;
    }

    const html = state.searchRecommendList.map((item) => {
        const title = item.title || '未命名推荐';
        return `
            <button class="search-tag-btn" type="button" data-keyword="${escapeHTML(title)}">
                ${escapeHTML(title)}
            </button>
        `;
    }).join('');

    list.innerHTML = html;
    bindSearchRecommendEvents();
}

// 推荐词点击
function bindSearchRecommendEvents() {
    const buttons = document.querySelectorAll('#search-suggest-list .search-tag-btn');

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const keyword = btn.dataset.keyword || '';
            if (!keyword) return;

            addSearchHistory(keyword);
            goTo(`/search-result?keyword=${encodeURIComponent(keyword)}`);
        });
    });
}

// 获取并渲染搜索结果
async function fetchSearchResult(keyword) {
    try {
        toggleGlobalLoading(true);

        const token = getToken();

        const requestBody = {
            keyword: keyword,
            searchType: 0,
            order: 0,
            pageNum: 1,
            pageSize: 10
        };

        const response = await fetch(`${BASE_URL}/search/mock_search`, {
            method: 'POST',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        console.log('搜索结果返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '搜索失败');
            return;
        }

        state.searchResultData = result.data || {};
        renderSearchResult(keyword);
    } catch (error) {
        console.error('搜索失败:', error);
        showToast('搜索失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 渲染搜索结果
function renderSearchResult(keyword = '') {
    const list = document.querySelector('#search-result-list');
    const input = document.querySelector('#result-search-input');

    if (!list) return;

    if (input) {
        input.value = keyword;
    }

    const postList = state.searchResultData?.postLists || [];

    if (!postList.length) {
        list.innerHTML = '<div class="empty-block">没有找到相关内容</div>';
        return;
    }

    const html = postList.map((item) => {
        const title = item.title || '未命名内容';
        const content = item.content || '';
        const image = item.image || '';
        const createTime = item.createTime || '';

        return `
            <article class="search-result-card">
                <div class="search-result-card__body">
                    <h3 class="search-result-card__title">${escapeHTML(title)}</h3>
                    <p class="search-result-card__content">${escapeHTML(content)}</p>
                    <p class="search-result-card__time">${escapeHTML(createTime)}</p>
                </div>
                ${image ? `<img class="search-result-card__image" src="${image}" alt="${escapeHTML(title)}">` : ''}
            </article>
        `;
    }).join('');

    list.innerHTML = html;
}

// 读取搜索历史
function loadSearchHistory() {
    const history = JSON.parse(localStorage.getItem('searchHistoryList') || '[]');
    state.searchHistoryList = Array.isArray(history) ? history : [];
    renderSearchHistory();
}

// 添加搜索历史
function addSearchHistory(keyword) {
    const text = String(keyword).trim();
    if (!text) return;

    let history = JSON.parse(localStorage.getItem('searchHistoryList') || '[]');
    if (!Array.isArray(history)) {
        history = [];
    }

    history = history.filter((item) => item !== text);
    history.unshift(text);
    history = history.slice(0, 10);

    localStorage.setItem('searchHistoryList', JSON.stringify(history));
    state.searchHistoryList = history;
}

// 清空搜索历史
function clearSearchHistory() {
    localStorage.removeItem('searchHistoryList');
    state.searchHistoryList = [];
    renderSearchHistory();
    showToast('搜索历史已清空');
}

// 渲染搜索历史
function renderSearchHistory() {
    const list = document.querySelector('#search-history-list');
    if (!list) return;

    if (!state.searchHistoryList.length) {
        list.innerHTML = '<div class="empty-block">暂无搜索历史</div>';
        return;
    }

    const html = state.searchHistoryList.map((item) => {
        return `
            <button class="search-tag-btn search-history-btn" type="button" data-keyword="${escapeHTML(item)}">
                ${escapeHTML(item)}
            </button>
        `;
    }).join('');

    list.innerHTML = html;
    bindSearchHistoryEvents();
}

// 搜索历史点击事件
function bindSearchHistoryEvents() {
    const buttons = document.querySelectorAll('#search-history-list .search-history-btn');

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const keyword = btn.dataset.keyword || '';
            if (!keyword) return;

            const searchInput = document.querySelector('#search-input');
            if (searchInput) {
                searchInput.value = keyword;
            }

            addSearchHistory(keyword);
            goTo(`/search-result?keyword=${encodeURIComponent(keyword)}`);
        });
    });
}

// 绑定发布页事件
function bindPublishEvents() {
    const publishForm = document.querySelector('#publish-form');
    const saveDraftBtn = document.querySelector('#save-draft-btn');
    const selectImageBtn = document.querySelector('#select-image-btn');
    const publishImageInput = document.querySelector('#publish-image-input');

    if (publishForm) {
        publishForm.addEventListener('submit', handlePublishSubmit);
    }

    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', () => {
            saveDraftPost();
        });
    }

    if (selectImageBtn && publishImageInput) {
        selectImageBtn.addEventListener('click', () => {
            publishImageInput.click();
        });
    }

    if (publishImageInput) {
        publishImageInput.addEventListener('change', handlePublishImageChange);
    }
}

// 发布提交
async function handlePublishSubmit(event) {
    event.preventDefault();

    const titleInput = document.querySelector('#publish-title');
    const contentInput = document.querySelector('#publish-content');
    const permissionSelect = document.querySelector('#publish-permission');

    const title = titleInput?.value.trim() || '';
    const content = contentInput?.value.trim() || '';
    const permissionValue = permissionSelect?.value || 'public';

    if (!title) {
        showToast('请输入标题');
        return;
    }

    if (!content) {
        showToast('请输入正文');
        return;
    }

    const permissionMap = {
        public: 1,
        private: 2,
        followers: 3
    };

    const requestBody = {
        title,
        content,
        images: state.publishImageUrls.join(','),
        topic: '',
        location: '',
        permission: permissionMap[permissionValue] || 1
    };

    try {
        toggleGlobalLoading(true);

        const token = getToken();

        const response = await fetch(`${BASE_URL}/post`, {
            method: 'POST',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        console.log('创建帖子返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '发布失败');
            return;
        }

        clearDraftPost();
        resetPublishForm();
        showToast('发布成功');

        goTo('/home');
    } catch (error) {
        console.error('发布失败:', error);
        showToast('发布失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 存草稿
function saveDraftPost() {
    const titleInput = document.querySelector('#publish-title');
    const contentInput = document.querySelector('#publish-content');
    const permissionSelect = document.querySelector('#publish-permission');

    const draft = {
        title: titleInput?.value.trim() || '',
        content: contentInput?.value.trim() || '',
        permission: permissionSelect?.value || 'public',
        images: state.publishImageUrls
    };

    localStorage.setItem('draftPostData', JSON.stringify(draft));
    state.draftPostData = draft;

    showToast('草稿已保存');
}

// 读取草稿到发布页
function renderDraftToPublishForm() {
    const draft = JSON.parse(localStorage.getItem('draftPostData') || 'null');
    state.draftPostData = draft;

    const titleInput = document.querySelector('#publish-title');
    const contentInput = document.querySelector('#publish-content');
    const permissionSelect = document.querySelector('#publish-permission');

    if (!draft) {
        if (titleInput) titleInput.value = '';
        if (contentInput) contentInput.value = '';
        if (permissionSelect) permissionSelect.value = 'public';
        state.publishImageUrls = [];
        return;
    }

    if (titleInput) titleInput.value = draft.title || '';
    if (contentInput) contentInput.value = draft.content || '';
    if (permissionSelect) permissionSelect.value = draft.permission || 'public';

    state.publishImageUrls = Array.isArray(draft.images) ? draft.images : [];
    renderPublishImageList();
}

// 清空草稿
function clearDraftPost() {
    localStorage.removeItem('draftPostData');
    state.draftPostData = null;
}

// 重置发布表单
function resetPublishForm() {
    const titleInput = document.querySelector('#publish-title');
    const contentInput = document.querySelector('#publish-content');
    const permissionSelect = document.querySelector('#publish-permission');

    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
    if (permissionSelect) permissionSelect.value = 'public';

    state.publishImageUrls = [];
    renderPublishImageList();
}

// 处理图片选择
async function handlePublishImageChange(event) {
    const files = Array.from(event.target.files || []);

    if (!files.length) return;

    const maxCount = 9;
    const remainCount = maxCount - state.publishImageUrls.length;

    if (remainCount <= 0) {
        showToast('最多只能上传 9 张图片');
        event.target.value = '';
        return;
    }

    const selectedFiles = files.slice(0, remainCount);

    for (const file of selectedFiles) {
        const maxSize = 3 * 1024 * 1024;

        if (file.size > maxSize) {
            showToast(`图片 ${file.name} 超过 3MB，无法上传`);
            continue;
        }

        const imageUrl = await uploadPublishImage(file);
        if (imageUrl) {
            state.publishImageUrls.push(imageUrl);
        }
    }

    renderPublishImageList();
    event.target.value = '';
}

// 上传单张图片
async function uploadPublishImage(file) {
    try {
        toggleGlobalLoading(true);

        const token = getToken();
        const formData = new FormData();
        formData.append('img', file);

        const response = await fetch(`${BASE_URL}/user/uploadImg`, {
            method: 'POST',
            headers: {
                Authorization: token
            },
            body: formData
        });

        const text = await response.text();
        console.log('上传图片原始返回:', text);

        let result = null;

        try {
            result = JSON.parse(text);
        } catch (error) {
            console.error('上传图片返回不是标准 JSON:', error);
            showToast('上传图片返回格式异常');
            return '';
        }

        if (result.code !== 200) {
            showToast(result.msg || '图片上传失败');
            return '';
        }

        return result.data || '';
    } catch (error) {
        console.error('上传图片失败:', error);
        showToast('图片上传失败，请稍后重试');
        return '';
    } finally {
        toggleGlobalLoading(false);
    }
}

// 渲染已上传图片列表
function renderPublishImageList() {
    const list = document.querySelector('#publish-image-list');
    if (!list) return;

    if (!state.publishImageUrls.length) {
        list.innerHTML = '<div class="empty-block">暂未选择图片</div>';
        return;
    }

    const html = state.publishImageUrls.map((url, index) => {
        return `
            <div class="publish-image-card">
                <img class="publish-image-card__img" src="${url}" alt="已上传图片">
                <button class="publish-image-card__delete" type="button" data-image-index="${index}">删除</button>
            </div>
        `;
    }).join('');

    list.innerHTML = html;
    bindPublishImageDeleteEvents();
}

// 删除已选图片
function bindPublishImageDeleteEvents() {
    const buttons = document.querySelectorAll('.publish-image-card__delete');

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const index = Number(btn.dataset.imageIndex);
            if (Number.isNaN(index)) return;

            state.publishImageUrls.splice(index, 1);
            renderPublishImageList();
        });
    });
}

// 获取评论列表
async function fetchCommentList(postId) {
    try {
        const token = getToken();

        const params = new URLSearchParams({
            lastCommentId: '0',
            limit: '10',
            sortType: String(state.currentCommentSortType)
        });

        const response = await fetch(`${BASE_URL}/comment/list/${postId}?${params.toString()}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();
        console.log('评论列表返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '获取评论失败');
            return;
        }

        state.commentList = result.data || [];
        renderCommentList();
    } catch (error) {
        console.error('获取评论失败:', error);
        showToast('获取评论失败，请稍后重试');
    }
}

// 渲染评论列表
function renderCommentList() {
    const list = document.querySelector('#comment-list');
    if (!list) return;

    if (!state.commentList.length) {
        list.innerHTML = '<div class="empty-block">暂无评论，快来抢沙发吧</div>';
        return;
    }

    const html = state.commentList.map((item) => {
        const content = item.content || '';
        const createTime = item.createTime || '';
        const userId = item.userId || '';
        const commentId = item.commentId || item.id || '';

        const currentUserId = localStorage.getItem('userId');
        const isSelfComment = String(userId) === String(currentUserId);

        return `
            <article class="comment-card" data-comment-id="${commentId}">
                <div class="comment-card__header">
                    <strong class="comment-card__user">用户 ${userId}</strong>
                    <div class="comment-card__header-right">
                        <span class="comment-card__time">${escapeHTML(createTime)}</span>
                        ${isSelfComment
                ? `<button class="comment-delete-btn" type="button" data-comment-id="${commentId}">删除</button>`
                : ''
            }
                    </div>
                </div>
                <p class="comment-card__content">${escapeHTML(content)}</p>
            </article>
        `;
    }).join('');

    list.innerHTML = html;
    bindCommentDeleteEvents();
}

// 绑定评论输入提交
function bindDetailCommentEvents() {
    const sendBtn = document.querySelector('#detail-comment-send-btn');

    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            handleCommentSubmit();
        });
    }
}

// 提交评论
async function handleCommentSubmit() {
    const input = document.querySelector('#detail-comment-input');
    const content = input?.value.trim() || '';

    if (!content) {
        showToast('评论内容不能为空');
        return;
    }

    const query = getRouteQuery();
    const postId = query.get('id');

    if (!postId) {
        showToast('帖子 id 不存在');
        return;
    }

    const requestBody = {
        postId: Number(postId),
        parentId: 0,
        content
    };

    try {
        toggleGlobalLoading(true);

        const token = getToken();

        const response = await fetch(`${BASE_URL}/comment`, {
            method: 'POST',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();
        console.log('创建评论返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '评论失败');
            return;
        }

        if (input) {
            input.value = '';
        }

        showToast('评论成功');
        fetchCommentList(postId);
    } catch (error) {
        console.error('评论失败:', error);
        showToast('评论失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 绑定详情页按钮事件
function bindDetailActionEvents() {
    const likeBtn = document.querySelector('#detail-like-btn');
    const favoriteBtn = document.querySelector('#detail-favorite-btn');

    if (likeBtn) {
        likeBtn.addEventListener('click', () => {
            handleDetailLikeToggle();
        });
    }

    if (favoriteBtn) {
        favoriteBtn.addEventListener('click', () => {
            handleDetailFavoriteToggle();
        });
    }
}

// 点赞切换
async function handleDetailLikeToggle() {
    const query = getRouteQuery();
    const postId = query.get('id');

    if (!postId) {
        showToast('帖子 id 不存在');
        return;
    }

    try {
        toggleGlobalLoading(true);

        const token = getToken();
        const url = state.detailIsLiked
            ? `${BASE_URL}/post/unlike/${postId}`
            : `${BASE_URL}/post/like/${postId}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();
        console.log('点赞切换返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '操作失败');
            return;
        }

        const wasLiked = state.detailIsLiked;
        state.detailIsLiked = !wasLiked;

        showToast(wasLiked ? '已取消点赞' : '点赞成功');
        fetchPostDetail(postId);
    } catch (error) {
        console.error('点赞操作失败:', error);
        showToast('操作失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 收藏切换
async function handleDetailFavoriteToggle() {
    const query = getRouteQuery();
    const postId = query.get('id');

    if (!postId) {
        showToast('帖子 id 不存在');
        return;
    }

    try {
        toggleGlobalLoading(true);

        const token = getToken();
        const wasFavored = state.detailIsFavored;
        const url = wasFavored
            ? `${BASE_URL}/post/unfav/${postId}`
            : `${BASE_URL}/post/fav/${postId}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();
        console.log('收藏切换返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '操作失败');
            return;
        }

        state.detailIsFavored = !wasFavored;
        setFavoriteStatus(postId, state.detailIsFavored);

        showToast(wasFavored ? '已取消收藏' : '收藏成功');
        fetchPostDetail(postId);
    } catch (error) {
        console.error('收藏操作失败:', error);
        showToast('操作失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 绑定删除评论按钮事件
function bindCommentDeleteEvents() {
    const buttons = document.querySelectorAll('.comment-delete-btn');

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const commentId = btn.dataset.commentId;
            if (!commentId) return;

            handleCommentDelete(commentId);
        });
    });
}

//  删除评论
async function handleCommentDelete(commentId) {
    const query = getRouteQuery();
    const postId = query.get('id');

    if (!postId) {
        showToast('帖子 id 不存在');
        return;
    }

    try {
        toggleGlobalLoading(true);

        const token = getToken();

        const response = await fetch(`${BASE_URL}/comment/delete/${commentId}`, {
            method: 'POST',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();
        console.log('删除评论返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '删除评论失败');
            return;
        }

        showToast('删除评论成功');
        fetchCommentList(postId);
    } catch (error) {
        console.error('删除评论失败:', error);
        showToast('删除评论失败，请稍后重试');
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

        const isLiked = item.isLiked === true || item.isLiked === 1 || item.isLiked === '1';
        const backendFavored =
            item.isFavorited === true || item.isFavorited === 1 || item.isFavorited === '1' ||
            item.isFav === true || item.isFav === 1 || item.isFav === '1' ||
            item.isFavorite === true || item.isFavorite === 1 || item.isFavorite === '1' ||
            item.isFavored === true || item.isFavored === 1 || item.isFavored === '1';

        const isFavored = state.favoriteStatusMap[String(item.postId)] ?? backendFavored;

        return `
      <article class="post-card" data-post-id="${item.postId}">
        <div class="post-card__cover-wrap">
          ${cover
                ? `<img class="post-card__cover" src="${cover}" alt="${escapeHTML(title)}">`
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
            <button
              class="post-stat-btn recommend-like-btn"
              type="button"
              data-post-id="${item.postId}"
              data-liked="${isLiked ? '1' : '0'}"
            >
              ${isLiked ? '已赞' : '赞'} ${likeCount}
            </button>

            <button
              class="post-stat-btn recommend-favorite-btn"
              type="button"
              data-post-id="${item.postId}"
              data-favored="${isFavored ? '1' : '0'}"
            >
              ${isFavored ? '已藏' : '藏'} ${favCount}
            </button>

            <span>评 ${commentCount}</span>
          </div>
        </div>
      </article>
    `;
    }).join('');

    list.innerHTML = html;

    bindRecommendPostCardEvents();
    bindRecommendPostActionEvents();
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

// 绑定首页点赞收藏按钮事件
function bindRecommendPostActionEvents() {
    const likeButtons = document.querySelectorAll('.recommend-like-btn');
    const favoriteButtons = document.querySelectorAll('.recommend-favorite-btn');

    likeButtons.forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();

            const postId = btn.dataset.postId;
            const isLiked = btn.dataset.liked === '1';

            if (!postId) return;
            handleRecommendLikeToggle(postId, isLiked);
        });
    });

    favoriteButtons.forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();

            const postId = btn.dataset.postId;
            const isFavored = btn.dataset.favored === '1';

            if (!postId) return;
            handleRecommendFavoriteToggle(postId, isFavored);
        });
    });
}

// 首页点赞切换
async function handleRecommendLikeToggle(postId, isLiked) {
    try {
        toggleGlobalLoading(true);

        const token = getToken();
        const url = isLiked
            ? `${BASE_URL}/post/unlike/${postId}`
            : `${BASE_URL}/post/like/${postId}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();
        console.log('首页点赞切换返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '操作失败');
            return;
        }

        showToast(isLiked ? '已取消点赞' : '点赞成功');
        fetchRecommendPosts();
    } catch (error) {
        console.error('首页点赞操作失败:', error);
        showToast('操作失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 首页收藏切换
async function handleRecommendFavoriteToggle(postId, isFavored) {
    try {
        toggleGlobalLoading(true);

        const token = getToken();
        const url = isFavored
            ? `${BASE_URL}/post/unfav/${postId}`
            : `${BASE_URL}/post/fav/${postId}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();
        console.log('首页收藏切换返回结果:', result);

        if (result.code !== 200) {
            showToast(result.msg || '操作失败');
            return;
        }

        setFavoriteStatus(postId, !isFavored);

        showToast(isFavored ? '已取消收藏' : '收藏成功');
        fetchRecommendPosts();
    } catch (error) {
        console.error('首页收藏操作失败:', error);
        showToast('操作失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
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

                addSearchHistory(keyword);
                goTo(`/search-result?keyword=${encodeURIComponent(keyword)}`);
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

            addSearchHistory(keyword);
            goTo(`/search-result?keyword=${encodeURIComponent(keyword)}`);
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (searchInput) {
                searchInput.value = '';
            }
        });
    }

    const clearSearchHistoryBtn = document.querySelector('#clear-search-history-btn');

    if (clearSearchHistoryBtn) {
        clearSearchHistoryBtn.addEventListener('click', () => {
            clearSearchHistory();
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