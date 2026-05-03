// 04-profile-follow

async function fetchProfileUser(userId) {
    try {
        toggleGlobalLoading(true);

        const token = getToken();

        const response = await fetch(`${BASE_URL}/user/getDetail/${userId}`, {
            method: 'POST',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || '获取用户信息失败');
            return;
        }

        state.currentProfileUser = result.data || null;
        state.profilePostCount = result.data?.postCount ?? 0;
        state.profileLikeCount = result.data?.likeCount ?? 0;
        state.profileFollowingCount = result.data?.followingCount ?? 0;
        state.profileFollowerCount = result.data?.followerCount ?? 0;

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

        if (result.code !== 200) {
            showToast(result.msg || '获取个人帖子失败');
            return;
        }

        const rawPosts = Array.isArray(result.data) ? result.data : [];
        const postsWithAuthor = rawPosts.map((post) => normalizePostWithAuthor(post, userId));

        state.profilePosts = filterVisiblePosts(postsWithAuthor);
        renderProfilePosts();
    } catch (error) {
        console.error('获取个人帖子失败:', error);
        showToast('获取个人帖子失败，请稍后重试');
    }
}

// 删除个人帖子

async function deletePostById(postId) {
    const token = getToken();

    const response = await fetch(`${BASE_URL}/post/delete/${postId}`, {
        method: 'POST',
        headers: {
            Authorization: token
        }
    });

    return response.json();
}

// 获取关注状态

async function fetchFollowStatus(userId) {
    try {
        const token = getToken();

        const response = await fetch(`${BASE_URL}/follow/status/${userId}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || '获取关注状态失败');
            return;
        }

        state.profileIsFollowing = Boolean(result.data?.isFollowing);
        renderProfileUser();
    } catch (error) {
        console.error('获取关注状态失败:', error);
        showToast('获取关注状态失败，请稍后重试');
    }
}

async function fetchUserFollowStatus(userId) {
    if (!userId || String(userId) === String(getCurrentUserId())) return false;

    try {
        const token = getToken();

        const response = await fetch(`${BASE_URL}/follow/status/${userId}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            return false;
        }

        return Boolean(result.data?.isFollowing);
    } catch (error) {
        console.error('获取用户关注状态失败:', error);
        return false;
    }
}

async function refreshDetailAuthorFollowStatus(userId) {
    state.detailAuthorIsFollowing = await fetchUserFollowStatus(userId);

    if (state.currentRoute === '/post-detail') {
        renderPostDetail();
    }
}

// 获取点赞帖子ids

async function fetchLikedPostIds() {
    try {
        const token = getToken();

        const response = await fetch(`${BASE_URL}/post/liked`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || '获取点赞列表失败');
            return;
        }

        state.likedPostIds = Array.isArray(result.data) ? result.data : [];
        await fetchLikedPostDetails();
    } catch (error) {
        console.error('获取点赞列表失败:', error);
        showToast('获取点赞列表失败，请稍后重试');
    }
}

// 加载点赞帖子列表

async function fetchLikedPostDetails() {
    try {
        const token = getToken();
        const ids = Array.isArray(state.likedPostIds) ? state.likedPostIds : [];

        if (!ids.length) {
            state.profileLikedPosts = [];
            renderProfileLikedPosts();
            return;
        }

        const requests = ids.map((postId) => {
            return fetch(`${BASE_URL}/post/${postId}`, {
                method: 'GET',
                headers: {
                    Authorization: token
                }
            }).then((res) => res.json());
        });

        const results = await Promise.all(requests);

        state.profileLikedPosts = results
            .filter((item) => item.code === 200 && item.data)
            .map((item) => item.data);

        renderProfileLikedPosts();
    } catch (error) {
        console.error('获取点赞帖子详情失败:', error);
        showToast('获取点赞帖子失败，请稍后重试');
    }
}

// 获取收藏帖子ids

async function fetchFavoritedPostIds() {
    try {
        const token = getToken();

        const response = await fetch(`${BASE_URL}/post/favorited`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || '获取收藏列表失败');
            return;
        }

        state.favoritedPostIds = Array.isArray(result.data) ? result.data : [];
        await fetchFavoritedPostDetails();
    } catch (error) {
        console.error('获取收藏列表失败:', error);
        showToast('获取收藏列表失败，请稍后重试');
    }
}

// 加载收藏帖子列表

async function fetchFavoritedPostDetails() {
    try {
        const token = getToken();
        const ids = Array.isArray(state.favoritedPostIds) ? state.favoritedPostIds : [];

        if (!ids.length) {
            state.profileFavoritedPosts = [];
            renderProfileFavoritedPosts();
            return;
        }

        const requests = ids.map((postId) => {
            return fetch(`${BASE_URL}/post/${postId}`, {
                method: 'GET',
                headers: {
                    Authorization: token
                }
            }).then((res) => res.json());
        });

        const results = await Promise.all(requests);

        state.profileFavoritedPosts = results
            .filter((item) => item.code === 200 && item.data)
            .map((item) => item.data);

        renderProfileFavoritedPosts();
    } catch (error) {
        console.error('获取收藏帖子详情失败:', error);
        showToast('获取收藏帖子失败，请稍后重试');
    }
}

// 获取关注列表ids

async function fetchFollowingIds(userId) {
    try {
        const token = getToken();

        const response = await fetch(`${BASE_URL}/follow/getFollowingIds/${userId}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || '获取关注列表失败');
            return;
        }

        state.profileFollowingIds = Array.isArray(result.data) ? result.data : [];
        renderProfileFollowingUsers();
    } catch (error) {
        console.error('获取关注列表失败:', error);
        showToast('获取关注列表失败，请稍后重试');
    }
}

async function createRelationUserItem(userId, className) {
    const user = await fetchPostAuthor(userId);

    const userName = user?.userName || `用户 ${userId}`;
    const userAvatar = user?.image || '';
    const signature = user?.signature || '这个人很懒，还没有签名。';

    return `
        <button class="relation-user-item ${className}" type="button" data-user-id="${userId}">
            <span class="relation-user-avatar">
                ${userAvatar
            ? `<img class="relation-user-avatar__img" src="${userAvatar}" alt="${escapeHTML(userName)}">`
            : ''
        }
            </span>

            <span class="relation-user-info">
                <strong>${escapeHTML(userName)}</strong>
                <span>${escapeHTML(signature)}</span>
            </span>
        </button>
    `;
}

// 渲染关注列表

async function renderProfileFollowingUsers() {
    const list = document.querySelector('#profile-following-user-list');
    const count = document.querySelector('#profile-following-entry-count');

    if (count) {
        count.textContent = String(state.profileFollowingIds.length);
    }

    if (!list) return;

    if (!state.profileFollowingIds.length) {
        list.innerHTML = '<div class="empty-block">暂无关注用户</div>';
        return;
    }

    list.innerHTML = '<div class="empty-block">加载中...</div>';

    const htmlList = await Promise.all(
        state.profileFollowingIds.map((userId) => {
            return createRelationUserItem(userId, 'following-user-btn');
        })
    );

    list.innerHTML = htmlList.join('');
    bindProfileFollowingUserEvents();
}

// 获取粉丝列表 ids

async function fetchFollowerIds(userId) {
    try {
        const token = getToken();

        const response = await fetch(`${BASE_URL}/follow/getFollowerIds/${userId}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || '获取粉丝列表失败');
            return;
        }

        state.profileFollowerIds = Array.isArray(result.data) ? result.data : [];
        renderProfileFollowerUsers();
    } catch (error) {
        console.error('获取粉丝列表失败:', error);
        showToast('获取粉丝列表失败，请稍后重试');
    }
}

// 渲染粉丝列表

async function renderProfileFollowerUsers() {
    const list = document.querySelector('#profile-follower-user-list');
    const count = document.querySelector('#profile-follower-entry-count');

    if (count) {
        count.textContent = String(state.profileFollowerIds.length);
    }

    if (!list) return;

    if (!state.profileFollowerIds.length) {
        list.innerHTML = '<div class="empty-block">暂无粉丝用户</div>';
        return;
    }

    list.innerHTML = '<div class="empty-block">加载中...</div>';

    const htmlList = await Promise.all(
        state.profileFollowerIds.map((userId) => {
            return createRelationUserItem(userId, 'follower-user-btn');
        })
    );

    list.innerHTML = htmlList.join('');
    bindProfileFollowerUserEvents();
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

    bindProfileImagePreviewEvents();

    if (name) {
        name.textContent = user.userName || '未命名用户';
    }

    if (signature) {
        signature.textContent = user.signature || '这个人很懒，还没有签名。';
    }

    if (stats) {
        stats.innerHTML = `
      <div class="profile-stat-item">
        <strong>${state.profilePostCount}</strong>
        <span>帖子</span>
      </div>
      <div class="profile-stat-item">
        <strong>${state.profileLikeCount}</strong>
        <span>获赞</span>
      </div>
      <div class="profile-stat-item">
        <strong>${state.profileFollowingCount}</strong>
        <span>关注</span>
      </div>
      <div class="profile-stat-item">
        <strong>${state.profileFollowerCount}</strong>
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
        <button id="follow-user-btn" class="primary-btn" type="button">
          ${state.profileIsFollowing ? '已关注' : '关注'}
        </button>
        <button id="chat-user-btn" class="secondary-btn" type="button">私聊</button>
      `;
        }
    }

    bindProfileActionEvents();
}

async function renderProfilePosts() {
    const list = document.querySelector('#profile-post-list');
    if (!list) return;

    let leftCol = document.querySelector('#profile-post-left-col');
    let rightCol = document.querySelector('#profile-post-right-col');

    if (!leftCol || !rightCol) {
        list.innerHTML = `
            <div id="profile-post-left-col" class="waterfall-col"></div>
            <div id="profile-post-right-col" class="waterfall-col"></div>
        `;

        leftCol = document.querySelector('#profile-post-left-col');
        rightCol = document.querySelector('#profile-post-right-col');
    }

    if (!leftCol || !rightCol) return;

    if (!state.profilePosts.length) {
        leftCol.innerHTML = '<div class="empty-block">这个用户还没有发布帖子</div>';
        rightCol.innerHTML = '';
        renderProfileUser();
        return;
    }

    leftCol.innerHTML = '';
    rightCol.innerHTML = '';

    for (let index = 0; index < state.profilePosts.length; index += 1) {
        await appendProfileSimplePostCard(leftCol, rightCol, state.profilePosts[index], index);
    }

    bindProfilePostCardEvents();
    bindPostCardActionEvents(list);
    bindPostCardAuthorEvents(list);
    renderProfileUser();
}

// 渲染点赞列表

async function renderProfileLikedPosts() {
    const list = document.querySelector('#profile-liked-list');
    if (!list) return;

    let leftCol = document.querySelector('#profile-liked-left-col');
    let rightCol = document.querySelector('#profile-liked-right-col');

    if (!leftCol || !rightCol) {
        list.innerHTML = `
            <div id="profile-liked-left-col" class="waterfall-col"></div>
            <div id="profile-liked-right-col" class="waterfall-col"></div>
        `;

        leftCol = document.querySelector('#profile-liked-left-col');
        rightCol = document.querySelector('#profile-liked-right-col');
    }

    if (!leftCol || !rightCol) return;

    if (!isViewingSelfProfile()) {
        list.innerHTML = `
        <div class="empty-block empty-block--full">
            无权访问该用户的点赞列表
        </div>
    `;
        return;
    }

    if (!state.profileLikedPosts.length) {
        leftCol.innerHTML = '<div class="empty-block">还没有点赞过帖子</div>';
        rightCol.innerHTML = '';
        return;
    }

    leftCol.innerHTML = '';
    rightCol.innerHTML = '';

    for (let index = 0; index < state.profileLikedPosts.length; index += 1) {
        await appendProfileSimplePostCard(leftCol, rightCol, state.profileLikedPosts[index], index);
    }

    bindProfileLikedPostCardEvents();
    bindPostCardActionEvents(list);
    bindPostCardAuthorEvents(list);
}

// 渲染收藏列表

async function renderProfileFavoritedPosts() {
    const list = document.querySelector('#profile-favorites-list');
    if (!list) return;

    let leftCol = document.querySelector('#profile-favorite-left-col');
    let rightCol = document.querySelector('#profile-favorite-right-col');

    if (!leftCol || !rightCol) {
        list.innerHTML = `
            <div id="profile-favorite-left-col" class="waterfall-col"></div>
            <div id="profile-favorite-right-col" class="waterfall-col"></div>
        `;

        leftCol = document.querySelector('#profile-favorite-left-col');
        rightCol = document.querySelector('#profile-favorite-right-col');
    }

    if (!leftCol || !rightCol) return;

    if (!isViewingSelfProfile()) {
        list.innerHTML = `
        <div class="empty-block empty-block--full">
            无权访问该用户的收藏列表
        </div>
    `;
        return;
    }

    if (!state.profileFavoritedPosts.length) {
        leftCol.innerHTML = '<div class="empty-block">还没有收藏过帖子</div>';
        rightCol.innerHTML = '';
        return;
    }

    leftCol.innerHTML = '';
    rightCol.innerHTML = '';

    for (let index = 0; index < state.profileFavoritedPosts.length; index += 1) {
        await appendProfileSimplePostCard(leftCol, rightCol, state.profileFavoritedPosts[index], index);
    }

    bindProfileFavoritedPostCardEvents();
    bindPostCardActionEvents(list);
    bindPostCardAuthorEvents(list);
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

// 删除按钮事件

function bindProfilePostDeleteEvents() {
    const buttons = document.querySelectorAll('#profile-post-list .post-delete-btn');

    buttons.forEach((btn) => {
        btn.addEventListener('click', async (event) => {
            event.stopPropagation();

            const postId = btn.dataset.postId;
            if (!postId) return;

            try {
                toggleGlobalLoading(true);

                const result = await deletePostById(postId);

                if (result.code !== 200) {
                    showToast(result.msg || '删除失败');
                    return;
                }

                showToast('删除成功');

                const query = getRouteQuery();
                const userId = query.get('userId');
                if (!userId) return;

                await fetchProfilePosts(userId);
                await fetchProfileUser(userId);
            } catch (error) {
                console.error('删除帖子失败:', error);
                showToast('删除失败，请稍后重试');
            } finally {
                toggleGlobalLoading(false);
            }
        });
    });
}

// 编辑按钮事件

function bindProfilePostEditEvents() {
    const buttons = document.querySelectorAll('#profile-post-list .post-edit-btn');

    buttons.forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();

            const postId = btn.dataset.postId;
            if (!postId) return;

            goTo(`/publish?postId=${postId}`);
        });
    });
}

// 点赞列表卡片点击

function bindProfileLikedPostCardEvents() {
    const cards = document.querySelectorAll('#profile-liked-list .post-card');

    cards.forEach((card) => {
        card.addEventListener('click', () => {
            const postId = card.dataset.postId;
            if (!postId) return;

            goTo(`/post-detail?id=${postId}`);
        });
    });
}

// 收藏列表卡片点击

function bindProfileFavoritedPostCardEvents() {
    const cards = document.querySelectorAll('#profile-favorites-list .post-card');

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
    const followUserBtn = document.querySelector('#follow-user-btn');
    const chatUserBtn = document.querySelector('#chat-user-btn');

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

    if (followUserBtn) {
        followUserBtn.addEventListener('click', () => {
            handleFollowToggle();
        });
    }

    if (chatUserBtn) {
        chatUserBtn.addEventListener('click', () => {
            const query = getRouteQuery();
            const userId = query.get('userId');

            if (!userId) {
                showToast('聊天用户 id 不存在');
                return;
            }

            goTo(`/chat?userId=${userId}`);
        });
    }
}

// 关注切换

async function handleFollowToggle(targetUserId = '') {
    const query = getRouteQuery();
    const userId = targetUserId || query.get('userId');

    if (!userId) {
        showToast('用户 id 不存在');
        return;
    }

    try {
        toggleGlobalLoading(true);

        const token = getToken();
        const wasFollowing = state.currentRoute === '/post-detail'
            ? state.detailAuthorIsFollowing
            : state.profileIsFollowing;
        const url = wasFollowing
            ? `${BASE_URL}/follow/unfollow/${userId}`
            : `${BASE_URL}/follow/${userId}`;

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || '操作失败');
            return;
        }

        state.profileIsFollowing = !wasFollowing;
        state.detailAuthorIsFollowing = !wasFollowing;

        showToast(wasFollowing ? '已取消关注' : '关注成功');

        if (state.currentRoute === '/profile') {
            fetchFollowStatus(userId);
            fetchProfileUser(userId);
        }

        if (state.currentRoute === '/post-detail') {
            renderPostDetail();
            refreshDetailAuthorFollowStatus(userId);
        }
    } catch (error) {
        console.error('关注操作失败:', error);
        showToast('操作失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 关注列表点击事件

function bindProfileFollowingUserEvents() {
    const buttons = document.querySelectorAll('.following-user-btn');

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const userId = btn.dataset.userId;
            if (!userId) return;

            goTo(`/profile?userId=${userId}`);
        });
    });
}

// 粉丝列表点击事件

function bindProfileFollowerUserEvents() {
    const buttons = document.querySelectorAll('.follower-user-btn');

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const userId = btn.dataset.userId;
            if (!userId) return;

            goTo(`/profile?userId=${userId}`);
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
            const nextTab = btn.dataset.profileTab;
            if (!nextTab) return;
            if (nextTab === state.currentProfileTab) return;

            saveProfileTabScroll();

            buttons.forEach((item) => item.classList.remove('active'));
            btn.classList.add('active');

            postsPanel.classList.remove('active');
            likesPanel.classList.remove('active');
            favoritesPanel.classList.remove('active');

            postsPanel.classList.add('hidden');
            likesPanel.classList.add('hidden');
            favoritesPanel.classList.add('hidden');

            if (nextTab === 'posts') {
                postsPanel.classList.add('active');
                postsPanel.classList.remove('hidden');
                restoreProfileTabScroll('posts');
            } else if (nextTab === 'likes') {
                likesPanel.classList.add('active');
                likesPanel.classList.remove('hidden');
                restoreProfileTabScroll('likes');
            } else if (nextTab === 'favorites') {
                favoritesPanel.classList.add('active');
                favoritesPanel.classList.remove('hidden');
                restoreProfileTabScroll('favorites');
            }

            state.currentProfileTab = nextTab;
        });
    });
}

function bindProfileRelationPanelEvents() {
    const openFollowingBtn = document.querySelector('#open-profile-following-btn');
    const openFollowerBtn = document.querySelector('#open-profile-follower-btn');
    const closeButtons = document.querySelectorAll('.profile-relation-close-btn');

    if (openFollowingBtn) {
        openFollowingBtn.addEventListener('click', () => {
            openProfileRelationPanel('following');
        });
    }

    if (openFollowerBtn) {
        openFollowerBtn.addEventListener('click', () => {
            openProfileRelationPanel('follower');
        });
    }

    closeButtons.forEach((btn) => {
        btn.addEventListener('click', closeProfileRelationPanels);
    });
}

function openProfileRelationPanel(type) {
    const followingPanel = document.querySelector('#profile-following-panel');
    const followerPanel = document.querySelector('#profile-follower-panel');

    if (!followingPanel || !followerPanel) return;

    followingPanel.classList.add('hidden');
    followerPanel.classList.add('hidden');

    if (type === 'following') {
        followingPanel.classList.remove('hidden');
        renderProfileFollowingUsers();
        return;
    }

    if (type === 'follower') {
        followerPanel.classList.remove('hidden');
        renderProfileFollowerUsers();
    }
}

function closeProfileRelationPanels() {
    const followingPanel = document.querySelector('#profile-following-panel');
    const followerPanel = document.querySelector('#profile-follower-panel');

    if (followingPanel) {
        followingPanel.classList.add('hidden');
    }

    if (followerPanel) {
        followerPanel.classList.add('hidden');
    }
}

// 消息页切换函数
