// 02-posts-home-detail

function getPostAuthorId(post) {
    const postId = post?.postId || post?.id || '';

    return String(
        post?._authorUserId ??
        post?.authorUserId ??
        post?.userId ??
        post?.authorId ??
        post?.publisherId ??
        post?.createUserId ??
        state.postOwnerMap[String(postId)] ??
        ''
    );
}

function rememberPostOwner(postId, userId) {
    if (!postId || !userId) return;

    state.postOwnerMap[String(postId)] = String(userId);
}

function normalizePostWithAuthor(post, authorUserId) {
    const normalizedPost = {
        ...post,
        _authorUserId: String(authorUserId),
        userId: post.userId ?? authorUserId
    };

    rememberPostOwner(normalizedPost.postId || normalizedPost.id, authorUserId);

    return normalizedPost;
}

function normalizePostPermission(post) {
    const raw = post?.permission ?? post?.visibleType ?? post?.visibility ?? post?.auth;

    if (raw === 0 || raw === '0' || raw === 'draft') return 'draft';
    if (raw === 1 || raw === '1' || raw === 'public') return 'public';
    if (raw === 2 || raw === '2' || raw === 'friends' || raw === 'followers') return 'friends';
    if (raw === 3 || raw === '3' || raw === 'private') return 'private';

    return 'public';
}

function createPostPermissionBadge(post) {
    const permission = normalizePostPermission(post);

    const labelMap = {
        draft: '草稿',
        public: '公开',
        friends: '好友可见',
        private: '私密'
    };

    const classMap = {
        draft: 'post-permission-badge--draft',
        public: 'post-permission-badge--public',
        friends: 'post-permission-badge--friends',
        private: 'post-permission-badge--private'
    };

    const label = labelMap[permission] || '公开';
    const className = classMap[permission] || 'post-permission-badge--public';

    return `<span class="post-permission-badge ${className}">${label}</span>`;
}

function getPostCardAuthorInfo(post) {
    const authorId = getPostAuthorId(post);
    const author = state.postAuthorMap[String(authorId)] || null;

    return {
        authorId,
        authorName: author?.userName || (authorId ? `用户 ${authorId}` : '未知用户'),
        authorAvatar: author?.image || ''
    };
}

function createPostCardAuthorRow(item, likeBtnClass = 'post-like-btn', options = {}) {
    const likeCount = item.likeCount ?? 0;
    const favCount = item.favCount ?? item.favoriteCount ?? 0;
    const isLiked = isPostLiked(item);
    const isFavored = isPostFavored(item);
    const { authorId, authorName, authorAvatar } = getPostCardAuthorInfo(item);
    const showFavorite = options.showFavorite === true;
    const favoriteBtnClass = options.favoriteBtnClass || 'post-favorite-btn';

    return `
        <div class="post-card__author-row">
            <button
                class="post-card__author"
                type="button"
                data-author-id="${escapeHTML(authorId)}"
            >
                <span class="post-card__avatar">
                    ${authorAvatar
            ? `<img class="post-card__avatar-img" src="${authorAvatar}" alt="${escapeHTML(authorName)}">`
            : ''
        }
                </span>
                <span class="post-card__author-name">${escapeHTML(authorName)}</span>
            </button>

            <div class="post-card__action-group">
                <button
                    class="post-stat-btn post-card__like ${likeBtnClass}"
                    type="button"
                    data-post-id="${item.postId}"
                    data-liked="${isLiked ? '1' : '0'}"
                >
                    ${heartIcon(isLiked)} ${likeCount}
                </button>

                ${showFavorite
            ? `<button
                    class="post-stat-btn post-card__favorite ${favoriteBtnClass}"
                    type="button"
                    data-post-id="${item.postId}"
                    data-favored="${isFavored ? '1' : '0'}"
                >
                    ${starIcon(isFavored)} ${favCount}
                </button>`
            : ''
        }
            </div>
        </div>
    `;
}

function canViewPost(post) {
    const currentUserId = getCurrentUserId();
    const authorId = getPostAuthorId(post);
    const permission = normalizePostPermission(post);

    if (currentUserId && authorId && currentUserId === authorId) {
        return true;
    }

    if (permission === 'public') {
        return true;
    }

    if (permission === 'draft') {
        return false;
    }

    if (permission === 'private') {
        return false;
    }

    if (permission === 'friends') {
        return state.homeFollowingIds.some((id) => String(id) === String(authorId));
    }
    return true;
}

function isCurrentUserPost(post) {
    const currentUserId = getCurrentUserId();
    const authorId = getPostAuthorId(post);

    return Boolean(currentUserId && authorId && String(currentUserId) === String(authorId));
}

function isViewingSelfProfile() {
    const query = getRouteQuery();
    const profileUserId = query.get('userId') || '';
    const currentUserId = getCurrentUserId();

    return Boolean(profileUserId && currentUserId && String(profileUserId) === String(currentUserId));
}

function openPostActionSheet() {
    const sheet = document.querySelector('#post-action-sheet');
    if (!sheet) return;

    sheet.classList.remove('hidden');
}

function closePostActionSheet() {
    const sheet = document.querySelector('#post-action-sheet');
    if (!sheet) return;

    sheet.classList.add('hidden');
}

function openPostDeleteConfirm() {
    const dialog = document.querySelector('#post-delete-confirm');
    if (!dialog) return;

    dialog.classList.remove('hidden');
}

function closePostDeleteConfirm() {
    const dialog = document.querySelector('#post-delete-confirm');
    if (!dialog) return;

    dialog.classList.add('hidden');
}

function filterVisiblePosts(posts) {
    if (!Array.isArray(posts)) return [];
    return posts.filter(canViewPost);
}

function loadFavoriteStatusMap() {
    const map = JSON.parse(localStorage.getItem('favoriteStatusMap') || '{}');
    state.favoriteStatusMap = map && typeof map === 'object' ? map : {};
}

function setFavoriteStatus(postId, isFavored) {
    state.favoriteStatusMap[String(postId)] = Boolean(isFavored);
    localStorage.setItem('favoriteStatusMap', JSON.stringify(state.favoriteStatusMap));
}

function setLikedStatus(postId, isLiked) {
    state.likedStatusMap[String(postId)] = Boolean(isLiked);
}

function syncLikedPostIds(postId, isLiked) {
    const id = Number(postId);

    if (!Array.isArray(state.likedPostIds)) {
        state.likedPostIds = [];
    }

    if (isLiked) {
        if (!state.likedPostIds.some((item) => String(item) === String(postId))) {
            state.likedPostIds.push(id);
        }
    } else {
        state.likedPostIds = state.likedPostIds.filter((item) => String(item) !== String(postId));
    }
}

function isPostLiked(post) {
    const postId = post?.postId || post?.id || '';

    if (postId && state.likedStatusMap[String(postId)] !== undefined) {
        return state.likedStatusMap[String(postId)];
    }

    if (postId && Array.isArray(state.likedPostIds)) {
        const inLikedList = state.likedPostIds.some((item) => String(item) === String(postId));
        if (inLikedList) return true;
    }

    return post?.isLiked === true || post?.isLiked === 1 || post?.isLiked === '1';
}

function isPostFavored(post) {
    const postId = post?.postId || post?.id || '';

    return state.favoriteStatusMap[String(postId)] ??
        (
            post?.isFavorited === true || post?.isFavorited === 1 || post?.isFavorited === '1' ||
            post?.isFav === true || post?.isFav === 1 || post?.isFav === '1' ||
            post?.isFavorite === true || post?.isFavorite === 1 || post?.isFavorite === '1' ||
            post?.isFavored === true || post?.isFavored === 1 || post?.isFavored === '1'
        );
}

function updatePostInAllLists(postId, updater) {
    const lists = [
        state.recommendPosts,
        state.followPosts,
        state.profilePosts,
        state.profileLikedPosts,
        state.profileFavoritedPosts,
        state.topicPostList
    ];

    lists.forEach((list) => {
        if (!Array.isArray(list)) return;

        const post = list.find((item) => String(item.postId) === String(postId));
        if (post) {
            updater(post);
        }
    });

    if (state.currentPostDetail && String(state.currentPostDetail.postId) === String(postId)) {
        updater(state.currentPostDetail);
    }
}

function updatePostCardActionUI(postId) {
    const cards = document.querySelectorAll(`.post-card[data-post-id="${postId}"]`);

    cards.forEach((card) => {
        const likeBtn = card.querySelector('.post-like-btn, .recommend-like-btn');
        const favoriteBtn = card.querySelector('.post-favorite-btn, .recommend-favorite-btn');

        const post =
            state.recommendPosts.find((item) => String(item.postId) === String(postId)) ||
            state.followPosts.find((item) => String(item.postId) === String(postId)) ||
            state.profilePosts.find((item) => String(item.postId) === String(postId)) ||
            state.profileLikedPosts.find((item) => String(item.postId) === String(postId)) ||
            state.profileFavoritedPosts.find((item) => String(item.postId) === String(postId)) ||
            state.topicPostList.find((item) => String(item.postId) === String(postId)) ||
            null;

        if (!post) {
            cards.forEach((card) => {
                const likeBtn = card.querySelector('.post-like-btn, .recommend-like-btn');
                const favoriteBtn = card.querySelector('.post-favorite-btn, .recommend-favorite-btn');

                if (likeBtn) {
                    const liked = state.likedStatusMap[String(postId)] === true;
                    likeBtn.dataset.liked = liked ? '1' : '0';
                    const countText = likeBtn.textContent.trim().replace(/[^\d]/g, '') || '0';
                    likeBtn.innerHTML = `${heartIcon(liked)} ${countText}`;
                }

                if (favoriteBtn) {
                    const favored = state.favoriteStatusMap[String(postId)] === true;
                    favoriteBtn.dataset.favored = favored ? '1' : '0';
                    const countText = favoriteBtn.textContent.trim().replace(/[^\d]/g, '') || '0';
                    favoriteBtn.innerHTML = `${starIcon(favored)} ${countText}`;
                }
            });

            return;
        }

        const liked = isPostLiked(post) || state.likedStatusMap[String(postId)] === true;
        const favored = isPostFavored(post);

        if (likeBtn) {
            likeBtn.dataset.liked = liked ? '1' : '0';
            likeBtn.innerHTML = `${heartIcon(liked)} ${post.likeCount ?? 0}`;
        }

        if (favoriteBtn) {
            favoriteBtn.dataset.favored = favored ? '1' : '0';
            favoriteBtn.innerHTML = `${starIcon(favored)} ${post.favCount ?? 0}`;
        }
    });
}

async function handlePostCardLikeToggle(postId, isLiked, clickedBtn = null) {
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

        if (result.code !== 200) {
            showToast(result.msg || '操作失败');
            return;
        }

        const nextLiked = !isLiked;

        setLikedStatus(postId, nextLiked);
        syncLikedPostIds(postId, nextLiked);

        updatePostInAllLists(postId, (post) => {
            const currentLikeCount = Number(post.likeCount ?? 0);

            post.isLiked = nextLiked;

            post.likeCount = nextLiked
                ? currentLikeCount + 1
                : Math.max(0, currentLikeCount - 1);
        });

        updatePostCardActionUI(postId);

        if (state.currentPostDetail && String(state.currentPostDetail.postId) === String(postId)) {
            renderPostDetail();
        }

        showToast(isLiked ? '已取消点赞' : '点赞成功');
    } catch (error) {
        console.error('帖子卡片点赞失败:', error);
        showToast('操作失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

async function handlePostCardFavoriteToggle(postId, isFavored, clickedBtn = null) {
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

        if (result.code !== 200) {
            showToast(result.msg || '操作失败');
            return;
        }

        const nextFavored = !isFavored;
        setFavoriteStatus(postId, nextFavored);

        updatePostInAllLists(postId, (post) => {
            const currentFavCount = Number(post.favCount ?? 0);

            post.isFavorited = nextFavored;
            post.isFav = nextFavored;
            post.isFavorite = nextFavored;
            post.isFavored = nextFavored;

            post.favCount = nextFavored
                ? currentFavCount + 1
                : Math.max(0, currentFavCount - 1);
        });

        updatePostCardActionUI(postId);

        if (state.currentPostDetail && String(state.currentPostDetail.postId) === String(postId)) {
            renderPostDetail();
        }

        showToast(isFavored ? '已取消收藏' : '收藏成功');
    } catch (error) {
        console.error('帖子卡片收藏失败:', error);
        showToast('操作失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

function bindPostCardActionEvents(container = document) {
    const likeButtons = container.querySelectorAll('.post-like-btn, .recommend-like-btn');
    const favoriteButtons = container.querySelectorAll('.post-favorite-btn, .recommend-favorite-btn');

    likeButtons.forEach((btn) => {
        if (btn.dataset.actionBound === '1') return;
        btn.dataset.actionBound = '1';

        btn.addEventListener('click', (event) => {
            event.stopPropagation();

            const postId = btn.dataset.postId;
            const isLiked = btn.dataset.liked === '1';

            if (!postId) return;
            handlePostCardLikeToggle(postId, isLiked, btn);
        });
    });

    favoriteButtons.forEach((btn) => {
        if (btn.dataset.actionBound === '1') return;
        btn.dataset.actionBound = '1';

        btn.addEventListener('click', (event) => {
            event.stopPropagation();

            const postId = btn.dataset.postId;
            const isFavored = btn.dataset.favored === '1';

            if (!postId) return;
            handlePostCardFavoriteToggle(postId, isFavored, btn);
        });
    });
}

function bindPostCardAuthorEvents(container = document) {
    const authorButtons = container.querySelectorAll('.post-card__author');

    authorButtons.forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();

            const authorId = btn.dataset.authorId;
            if (!authorId) return;

            goTo(`/profile?userId=${authorId}`);
        });
    });
}

async function hydratePostCardAuthor(card, item) {
    const authorId = getPostAuthorId(item);
    if (!authorId || !card) return;

    const author = await fetchPostAuthor(authorId);
    if (!author) return;

    const avatar = card.querySelector('.post-card__avatar');
    const name = card.querySelector('.post-card__author-name');

    if (avatar && author.image) {
        avatar.innerHTML = `
            <img class="post-card__avatar-img" src="${author.image}" alt="${escapeHTML(author.userName || '用户头像')}">
        `;
    }

    if (name) {
        name.textContent = author.userName || `用户 ${authorId}`;
    }
}

// 读取路由参数

async function fetchRecommendPosts(reset = false) {
    try {
        if (state.isRecommendLoadingMore) return;

        if (!reset && !state.hasMoreRecommendPosts) {
            updateRecommendListFooter();
            return;
        }

        state.isRecommendLoadingMore = true;

        if (reset) {
            state.recommendLastPostId = 0;
            state.hasMoreRecommendPosts = true;
            toggleGlobalLoading(true);
        }

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

        if (result.code !== 200) {
            showToast(result.msg || '获取帖子失败');
            return;
        }

        const rawPosts = Array.isArray(result.data) ? result.data : [];

        rawPosts.forEach((post) => {
            const authorId = getPostAuthorId(post);
            if (authorId) {
                rememberPostOwner(post.postId || post.id, authorId);
            }
        });

        const newPosts = filterVisiblePosts(rawPosts);

        let postsToRender = [];

        if (reset) {
            state.recommendPosts = newPosts;
            postsToRender = newPosts;
        } else {
            const oldIds = new Set(state.recommendPosts.map((item) => item.postId));
            const appendPosts = newPosts.filter((item) => !oldIds.has(item.postId));
            state.recommendPosts = [...state.recommendPosts, ...appendPosts];
            postsToRender = appendPosts;
        }

        if (rawPosts.length) {
            const lastRawPost = rawPosts[rawPosts.length - 1];
            state.recommendLastPostId = lastRawPost?.postId || 0;
        }

        state.hasMoreRecommendPosts = rawPosts.length >= state.recommendLimit;

        await renderRecommendPostList(reset, postsToRender);

        if (!postsToRender.length && state.hasMoreRecommendPosts) {
            await fetchRecommendPosts(false);
        }
    } catch (error) {
        console.error('获取帖子列表失败:', error);
        showToast('获取帖子失败，请稍后重试');
    } finally {
        state.isRecommendLoadingMore = false;
        updateRecommendListFooter();
        toggleGlobalLoading(false);
    }
}

// 绑定首页和推荐页滚动加载

function bindHomeScrollLoadMore() {
    window.addEventListener('scroll', () => {
        if (state.currentRoute !== '/home') return;

        const doc = document.documentElement;
        const scrollTop = window.scrollY || doc.scrollTop || 0;
        const clientHeight = window.innerHeight || doc.clientHeight || 0;
        const scrollHeight = doc.scrollHeight || 0;
        const distanceToBottom = scrollHeight - (scrollTop + clientHeight);

        if (distanceToBottom > state.recommendScrollThreshold) return;

        const followPanel = document.querySelector('#home-follow-panel');

        if (followPanel && followPanel.classList.contains('active')) {
            loadMoreFollowPosts();
            return;
        }

        const now = Date.now();

        if (now - state.lastRecommendLoadTime < 600) {
            return;
        }

        state.lastRecommendLoadTime = now;
        fetchRecommendPosts(false);
    });
}

// 更新底部文案

function updateRecommendListFooter() {
    const footer = document.querySelector('#home-recommend-panel .list-footer');
    if (!footer) return;

    if (state.isRecommendLoadingMore) {
        footer.textContent = '加载中...';
        return;
    }

    if (!state.recommendPosts.length) {
        footer.textContent = '暂无内容';
        return;
    }

    footer.textContent = state.hasMoreRecommendPosts ? '上拉加载更多' : '没有更多内容了';
}

async function fetchPostActionStatus() {
    try {
        const token = getToken();

        const [likedResponse, favoredResponse] = await Promise.all([
            fetch(`${BASE_URL}/post/liked`, {
                method: 'GET',
                headers: {
                    Authorization: token
                }
            }),
            fetch(`${BASE_URL}/post/favorited`, {
                method: 'GET',
                headers: {
                    Authorization: token
                }
            })
        ]);

        const likedResult = await likedResponse.json();
        const favoredResult = await favoredResponse.json();


        if (likedResult.code === 200 && Array.isArray(likedResult.data)) {
            state.likedPostIds = likedResult.data;
            likedResult.data.forEach((postId) => {
                setLikedStatus(postId, true);
            });
        }

        if (favoredResult.code === 200 && Array.isArray(favoredResult.data)) {
            state.favoritedPostIds = favoredResult.data;
            favoredResult.data.forEach((postId) => {
                setFavoriteStatus(postId, true);
            });
        }
    } catch (error) {
        console.error('获取帖子点赞收藏状态失败:', error);
    }
}

// 请求首页关注列表

async function fetchHomeFollowPosts() {
    try {
        const currentUserId = localStorage.getItem('userId');
        if (!currentUserId) return;

        const token = getToken();

        const followResponse = await fetch(`${BASE_URL}/follow/getFollowingIds/${currentUserId}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const followResult = await followResponse.json();

        if (followResult.code !== 200) {
            showToast(followResult.msg || '获取关注列表失败');
            return;
        }

        const followingIds = Array.isArray(followResult.data) ? followResult.data : [];
        state.homeFollowingIds = followingIds;

        if (!followingIds.length) {
            state.followPosts = [];
            state.followVisibleCount = 0;
            state.hasMoreFollowPosts = false;
            renderHomeFollowPosts();
            return;
        }

        const requests = followingIds.map((userId) => {
            return fetch(`${BASE_URL}/post/getPostByUser/${userId}`, {
                method: 'POST',
                headers: {
                    Authorization: token
                }
            }).then((res) => res.json());
        });

        const results = await Promise.all(requests);

        const allPosts = results.flatMap((item, index) => {
            const authorUserId = followingIds[index];

            if (item.code === 200 && Array.isArray(item.data)) {
                return item.data.map((post) => normalizePostWithAuthor(post, authorUserId));
            }

            return [];
        });

        allPosts.sort((a, b) => {
            const timeA = new Date(a.createTime || 0).getTime();
            const timeB = new Date(b.createTime || 0).getTime();
            return timeB - timeA;
        });

        state.followPosts = allPosts.filter((post) => {
            const permission = normalizePostPermission(post);

            return permission === 'public' || permission === 'friends';
        });
        state.followVisibleCount = Math.min(state.followPageSize, state.followPosts.length);
        state.hasMoreFollowPosts = state.followPosts.length > state.followVisibleCount;

        const firstPosts = state.followPosts.slice(0, state.followVisibleCount);
        renderHomeFollowPosts(true, firstPosts);
    } catch (error) {
        console.error('获取首页关注流失败:', error);
        showToast('获取关注内容失败，请稍后重试');
    }
}

function appendToShorterColumn(leftCol, rightCol, cardHtml) {
    const temp = document.createElement('div');
    temp.innerHTML = cardHtml.trim();

    const cardEl = temp.firstElementChild;
    if (!cardEl) return;

    const leftHeight = leftCol.scrollHeight;
    const rightHeight = rightCol.scrollHeight;

    if (leftHeight <= rightHeight) {
        leftCol.appendChild(cardEl);
    } else {
        rightCol.appendChild(cardEl);
    }
}

// 创建推荐卡片

function createRecommendPostCard(item) {
    const imageList = item.images ? item.images.split(',') : [];
    const cover = imageList[0] || '';
    const title = item.title || '未命名帖子';

    const temp = document.createElement('div');
    temp.innerHTML = `
        <article class="post-card recommend-post-card" data-post-id="${item.postId}">
            <div class="post-card__cover-wrap">
                ${createPostPermissionBadge(item)}
                ${cover
            ? `<img class="post-card__cover" src="${cover}" alt="${escapeHTML(title)}">`
            : `<div class="post-card__cover post-card__cover--empty">暂无图片</div>`
        }
            </div>

            <div class="post-card__body">
                <h3 class="post-card__title">${escapeHTML(title)}</h3>
                ${createPostCardAuthorRow(item, 'recommend-like-btn', { showFavorite: true, favoriteBtnClass: 'recommend-favorite-btn' })}
            </div>
        </article>
    `.trim();

    return temp.firstElementChild;
}

function createFollowPostCard(item) {
    const imageList = item.images ? item.images.split(',') : [];
    const cover = imageList[0] || '';
    const title = item.title || '未命名帖子';

    const temp = document.createElement('div');
    temp.innerHTML = `
        <article class="post-card follow-post-card" data-post-id="${item.postId}">
            <div class="post-card__cover-wrap">
                ${createPostPermissionBadge(item)}
                ${cover
            ? `<img class="post-card__cover" src="${cover}" alt="${escapeHTML(title)}">`
            : `<div class="post-card__cover post-card__cover--empty">暂无图片</div>`
        }
            </div>            

            <div class="post-card__body">
                <h3 class="post-card__title">${escapeHTML(title)}</h3>
                ${createPostCardAuthorRow(item, 'post-like-btn', { showFavorite: true, favoriteBtnClass: 'post-favorite-btn' })}
            </div>
        </article>
    `.trim();

    return temp.firstElementChild;
}

function createProfileSimplePostCard(item) {
    const imageList = item.images ? item.images.split(',') : [];
    const cover = imageList[0] || '';
    const title = item.title || '未命名帖子';

    const temp = document.createElement('div');

    temp.innerHTML = `
        <article class="post-card" data-post-id="${item.postId}">
            <div class="post-card__cover-wrap">
                ${createPostPermissionBadge(item)}
                ${cover
            ? `<img class="post-card__cover" src="${cover}" alt="${escapeHTML(title)}">`
            : `<div class="post-card__cover post-card__cover--empty">暂无图片</div>`
        }
            </div>

            <div class="post-card__body">
                <h3 class="post-card__title">${escapeHTML(title)}</h3>
                ${createPostCardAuthorRow(item, 'post-like-btn')}
            </div>
        </article>
    `.trim();

    return temp.firstElementChild;
}

async function appendProfileSimplePostCard(leftCol, rightCol, item, index = 0) {
    const card = createProfileSimplePostCard(item);
    if (!card) return;

    card.style.visibility = 'hidden';

    const image = card.querySelector('img');

    if (image) {
        try {
            if (image.decode) {
                await image.decode();
            } else if (!image.complete) {
                await new Promise((resolve) => {
                    image.addEventListener('load', resolve, { once: true });
                    image.addEventListener('error', resolve, { once: true });
                });
            }
        } catch (error) {
            // 图片失败也继续显示
        }
    }

    applyCardImageRatio(card);

    const list = leftCol.closest('.waterfall-list');
    const isHiddenList = !list || list.offsetParent === null;

    let targetCol;

    if (isHiddenList) {
        targetCol = index % 2 === 0 ? leftCol : rightCol;
    } else {
        targetCol = leftCol.scrollHeight <= rightCol.scrollHeight ? leftCol : rightCol;
    }

    targetCol.appendChild(card);

    hydratePostCardAuthor(card, item);

    requestAnimationFrame(() => {
        card.style.visibility = 'visible';
    });
}

async function appendFollowPostCardStable(leftCol, rightCol, item) {
    const card = createFollowPostCard(item);
    if (!card) return;

    card.style.visibility = 'hidden';

    const image = card.querySelector('img');

    if (image) {
        try {
            if (image.decode) {
                await image.decode();
            } else if (!image.complete) {
                await new Promise((resolve) => {
                    image.addEventListener('load', resolve, { once: true });
                    image.addEventListener('error', resolve, { once: true });
                });
            }
        } catch (error) {
            // 图片失败也继续显示，避免列表卡住
        }
    }

    applyCardImageRatio(card);
    const targetCol = leftCol.scrollHeight <= rightCol.scrollHeight ? leftCol : rightCol;
    targetCol.appendChild(card);
    hydratePostCardAuthor(card, item);

    requestAnimationFrame(() => {
        card.style.visibility = 'visible';
    });
}

function applyCardImageRatio(card) {
    const wrap = card.querySelector('.post-card__cover-wrap');
    const img = card.querySelector('.post-card__cover');

    if (!wrap || !img || !img.naturalWidth || !img.naturalHeight) return;

    const rawRatio = img.naturalWidth / img.naturalHeight;

    const minRatio = 0.8;
    const maxRatio = 1.25;

    const finalRatio = Math.min(maxRatio, Math.max(minRatio, rawRatio));

    wrap.style.setProperty('--cover-ratio', `${finalRatio}`);
}

// 等单张卡片图片加载完再插入

async function appendRecommendPostCardStable(leftCol, rightCol, item) {
    const card = createRecommendPostCard(item);
    if (!card) return;

    card.style.visibility = 'hidden';

    const image = card.querySelector('img');

    if (image) {
        try {
            if (image.decode) {
                await image.decode();
            } else if (!image.complete) {
                await new Promise((resolve) => {
                    image.addEventListener('load', resolve, { once: true });
                    image.addEventListener('error', resolve, { once: true });
                });
            }
        } catch (error) {
            // 图片加载失败也继续插入，避免卡住列表
        }
    }

    applyCardImageRatio(card);
    const targetCol = leftCol.scrollHeight <= rightCol.scrollHeight ? leftCol : rightCol;
    targetCol.appendChild(card);
    hydratePostCardAuthor(card, item);

    requestAnimationFrame(() => {
        card.style.visibility = 'visible';
    });
}

function waitImagesLoaded(container) {
    const images = Array.from(container.querySelectorAll('img'));

    if (!images.length) {
        return Promise.resolve();
    }

    return Promise.all(images.map((img) => {
        if (img.complete && img.naturalWidth > 0) {
            return Promise.resolve();
        }

        if (img.decode) {
            return img.decode().catch(() => { });
        }

        return new Promise((resolve) => {
            img.addEventListener('load', resolve, { once: true });
            img.addEventListener('error', resolve, { once: true });
        });
    }));
}

// 渲染关注列表

async function renderHomeFollowPosts(reset = true, renderPosts = []) {
    const list = document.querySelector('#follow-post-list');
    const leftCol = document.querySelector('#follow-left-col');
    const rightCol = document.querySelector('#follow-right-col');

    if (!list || !leftCol || !rightCol) return;

    if (!state.followPosts.length) {
        leftCol.innerHTML = '<div class="empty-block">暂无关注内容，快去关注一些用户吧</div>';
        rightCol.innerHTML = '';
        list.style.visibility = 'visible';
        updateFollowListFooter();
        return;
    }

    if (reset) {
        list.style.visibility = 'hidden';
        leftCol.innerHTML = '';
        rightCol.innerHTML = '';
    } else {
        list.style.visibility = 'visible';
    }

    const posts = renderPosts.length ? renderPosts : state.followPosts.slice(0, state.followVisibleCount);

    for (const item of posts) {
        await appendFollowPostCardStable(leftCol, rightCol, item);
    }

    bindFollowPostCardEvents();
    bindPostCardActionEvents(list);
    bindPostCardAuthorEvents(list);
    updateFollowListFooter();
    list.style.visibility = 'visible';
}

// 加载更多关注内容

function loadMoreFollowPosts() {
    if (state.isFollowLoadingMore) return;

    if (!state.hasMoreFollowPosts) {
        updateFollowListFooter();
        return;
    }

    state.isFollowLoadingMore = true;
    updateFollowListFooter();

    const oldCount = state.followVisibleCount;
    const nextCount = Math.min(
        state.followVisibleCount + state.followPageSize,
        state.followPosts.length
    );

    const appendPosts = state.followPosts.slice(oldCount, nextCount);

    state.followVisibleCount = nextCount;
    state.hasMoreFollowPosts = state.followVisibleCount < state.followPosts.length;

    renderHomeFollowPosts(false, appendPosts).finally(() => {
        state.isFollowLoadingMore = false;
        updateFollowListFooter();
    });
}

// 更新关注页面底部文案

function updateFollowListFooter() {
    const footer = document.querySelector('#home-follow-panel .list-footer');
    if (!footer) return;

    if (!state.followPosts.length) {
        footer.textContent = '暂无内容';
        return;
    }

    if (state.isFollowLoadingMore) {
        footer.textContent = '加载中...';
        return;
    }

    footer.textContent = state.hasMoreFollowPosts ? '上拉加载更多' : '没有更多内容了';
}

// 关注列表卡片点击事件

function bindFollowPostCardEvents() {
    const cards = document.querySelectorAll('#follow-post-list .follow-post-card');

    cards.forEach((card) => {
        card.addEventListener('click', () => {
            const postId = card.dataset.postId;
            if (!postId) return;

            goTo(`/post-detail?id=${postId}`);
        });
    });
}

// 请求帖子详情


function isStalePostDetailRequest(postId, requestId = '') {
    if (requestId && state.activePostDetailRequestId !== requestId) {
        return true;
    }

    if (state.currentRoute !== '/post-detail') {
        return true;
    }

    const currentPostId = getRouteQuery().get('id') || '';
    return Boolean(currentPostId && String(currentPostId) !== String(postId));
}

async function fetchPostDetail(postId) {
    const requestId = `post_detail_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    state.activePostDetailRequestId = requestId;

    try {
        clearDetailSwiperTimer();
        state.detailSwiperIndex = 0;
        state.detailSwiperImageCount = 0;

        toggleGlobalLoading(true);

        const token = getToken();

        const response = await fetch(`${BASE_URL}/post/${postId}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (isStalePostDetailRequest(postId, requestId)) {
            return;
        }

        if (result.code !== 200) {
            showToast(result.msg || '获取帖子详情失败');
            return;
        }

        let post = result.data;

        const rememberedAuthorId = state.postOwnerMap[String(postId)];
        if (rememberedAuthorId && !getPostAuthorId(post)) {
            post = normalizePostWithAuthor(post, rememberedAuthorId);
        }

        if (!canViewPost(post)) {
            state.currentPostDetail = null;
            showToast('该帖子为私密内容，无权查看');
            goTo('/home');
            return;
        }

        state.currentPostDetail = post;
        renderPostDetail();

        if (state.currentPostDetail?.userId) {
            const authorId = getPostAuthorId(state.currentPostDetail) || state.currentPostDetail.userId;
            fetchPostAuthor(authorId).then(() => {
                renderPostDetail();
            });
            refreshDetailAuthorFollowStatus(authorId);
        }
    } catch (error) {
        console.error('获取帖子详情失败:', error);

        if (!isStalePostDetailRequest(postId, requestId)) {
            showToast('获取帖子详情失败，请稍后重试');
        }
    } finally {
        toggleGlobalLoading(false);
    }
}

async function fetchPostAuthor(userId) {
    if (!userId) return null;

    const key = String(userId);

    if (state.postAuthorMap[key]) {
        return state.postAuthorMap[key];
    }

    try {
        const token = getToken();

        const response = await fetch(`${BASE_URL}/user/getDetail/${userId}`, {
            method: 'POST',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            return null;
        }

        const user = result.data || null;
        state.postAuthorMap[key] = user;

        return user;
    } catch (error) {
        console.error('获取帖子作者信息失败:', error);
        return null;
    }
}

// 轮播图控制

function clearDetailSwiperTimer() {
    if (state.detailSwiperTimer) {
        clearInterval(state.detailSwiperTimer);
        state.detailSwiperTimer = null;
    }
}

function updateDetailSwiper() {
    const track = document.querySelector('#detail-swiper-track');
    const dots = document.querySelectorAll('.detail-swiper-dot');
    const counter = document.querySelector('#detail-swiper-counter');

    if (!track || !state.detailSwiperImageCount) return;

    if (state.detailSwiperIndex < 0) {
        state.detailSwiperIndex = state.detailSwiperImageCount - 1;
    }

    if (state.detailSwiperIndex >= state.detailSwiperImageCount) {
        state.detailSwiperIndex = 0;
    }

    track.style.transform = `translateX(-${state.detailSwiperIndex * 100}%)`;

    dots.forEach((dot, index) => {
        dot.classList.toggle('active', index === state.detailSwiperIndex);
    });

    if (counter) {
        counter.textContent = `${state.detailSwiperIndex + 1} / ${state.detailSwiperImageCount}`;
    }
}

function goDetailSwiperNext() {
    if (state.detailSwiperImageCount <= 1) return;

    state.detailSwiperIndex += 1;
    updateDetailSwiper();
}

function goDetailSwiperPrev() {
    if (state.detailSwiperImageCount <= 1) return;

    state.detailSwiperIndex -= 1;
    updateDetailSwiper();
}

function startDetailSwiperAutoPlay() {
    clearDetailSwiperTimer();

    if (state.detailSwiperImageCount <= 1) return;

    state.detailSwiperTimer = setInterval(() => {
        goDetailSwiperNext();
    }, 3000);
}

function bindDetailSwiperEvents() {
    const swiper = document.querySelector('#post-swiper');
    const dots = document.querySelectorAll('.detail-swiper-dot');

    if (!swiper) return;

    dots.forEach((dot) => {
        dot.addEventListener('click', () => {
            const index = Number(dot.dataset.index || 0);
            state.detailSwiperIndex = index;
            updateDetailSwiper();
            startDetailSwiperAutoPlay();
        });
    });

    let startX = 0;
    let startY = 0;
    let moveX = 0;
    let moveY = 0;

    swiper.addEventListener('touchstart', (event) => {
        const touch = event.touches[0];

        startX = touch.clientX;
        startY = touch.clientY;
        moveX = 0;
        moveY = 0;
    }, { passive: true });

    swiper.addEventListener('touchmove', (event) => {
        const touch = event.touches[0];

        moveX = touch.clientX - startX;
        moveY = touch.clientY - startY;
    }, { passive: true });

    swiper.addEventListener('touchend', () => {
        if (state.detailSwiperImageCount <= 1) return;

        const isHorizontalSwipe = Math.abs(moveX) > Math.abs(moveY);
        const isEnoughDistance = Math.abs(moveX) >= 45;

        if (!isHorizontalSwipe || !isEnoughDistance) return;

        if (moveX < 0) {
            goDetailSwiperNext();
        } else {
            goDetailSwiperPrev();
        }

        startDetailSwiperAutoPlay();
    });
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
    const moreBtn = document.querySelector('#post-more-btn');

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
        const authorId = getPostAuthorId(detail) || detail.userId || '';
        const author = state.postAuthorMap[String(authorId)] || null;
        const authorName = author?.userName || `用户 ${authorId}`;
        const authorAvatar = author?.image || '';
        const isSelfPost = String(authorId) === String(getCurrentUserId());

        authorCard.innerHTML = `
        <div class="detail-user-card detail-user-card--clickable" data-user-id="${escapeHTML(authorId)}">
            <div class="detail-user-card__avatar">
                ${authorAvatar
                ? `<img class="detail-user-card__avatar-img" src="${authorAvatar}" alt="${escapeHTML(authorName)}">`
                : ''
            }
            </div>
            <div class="detail-user-card__info">
                <h3>${escapeHTML(authorName)}</h3>
                <p>${escapeHTML(createTime)}</p>
            </div>
            ${!isSelfPost
                ? `<button id="detail-author-follow-btn" class="detail-author-follow-btn ${state.detailAuthorIsFollowing ? 'is-following' : ''}" type="button">
                    ${state.detailAuthorIsFollowing ? '已关注' : '关注'}
                </button>`
                : ''
            }
        </div>
    `;

        authorCard.onclick = () => {
            if (!authorId) return;
            goTo(`/profile?userId=${authorId}`);
        };

        const followBtn = authorCard.querySelector('#detail-author-follow-btn');
        if (followBtn) {
            followBtn.addEventListener('click', (event) => {
                event.stopPropagation();
                handleFollowToggle(authorId);
            });
        }
    }

    if (swiper) {
        clearDetailSwiperTimer();

        state.detailSwiperIndex = 0;
        state.detailSwiperImageCount = imageList.length;

        if (!imageList.length) {
            swiper.innerHTML = `<div class="detail-image-empty">暂无图片</div>`;
        } else {
            swiper.innerHTML = `
            <div class="detail-swiper">
                <div id="detail-swiper-track" class="detail-swiper__track">
                    ${imageList.map((src, index) => {
                return `
                            <div class="detail-swiper__slide">
                                <img
                                    class="detail-swiper__image"
                                    src="${src.trim()}"
                                    alt="${escapeHTML(title)}-${index + 1}"
                                >
                            </div>
                        `;
            }).join('')}
                </div>

                ${imageList.length > 1
                    ? `
                        <div class="detail-swiper__dots">
                            ${imageList.map((_, index) => {
                        return `
                                    <button
                                        class="detail-swiper-dot ${index === 0 ? 'active' : ''}"
                                        type="button"
                                        data-index="${index}"
                                        aria-label="切换到第${index + 1}张图片"
                                    ></button>
                                `;
                    }).join('')}
                        </div>

                        <div id="detail-swiper-counter" class="detail-swiper__counter">
                            1 / ${imageList.length}
                        </div>
                    `
                    : ''
                }
            </div>
        `;

            bindDetailSwiperEvents();
            updateDetailSwiper();
            startDetailSwiperAutoPlay();
        }
    }

    if (contentBox) {
        contentBox.innerHTML = `
      <h1 class="detail-title">${escapeHTML(title)}</h1>
      <p class="detail-text">${escapeHTML(content)}</p>
      <div class="detail-extra">
        <button class="detail-topic-inline detail-topic-btn" type="button" data-topic="${escapeHTML(topic)}">#${escapeHTML(topic)}</button>
        <span>${escapeHTML(location)}</span>
      </div>
    `;
    }

    if (topicList) {
        topicList.innerHTML = '';
    }

    if (likeBtn) {
        likeBtn.innerHTML = `${heartIcon(state.detailIsLiked)} ${likeCount}`;
    }

    if (favoriteBtn) {
        favoriteBtn.innerHTML = `${starIcon(state.detailIsFavored)} ${favCount}`;
    }

    if (commentBtn) {
        commentBtn.innerHTML = `${commentIcon()} ${commentCount}`;
    }

    if (moreBtn) {
        if (isCurrentUserPost(detail)) {
            moreBtn.classList.remove('hidden');
        } else {
            moreBtn.classList.add('hidden');
        }
    }

    bindDetailTopicEvents();
}

// 详情页主题点击

function bindDetailTopicEvents() {
    const btn = document.querySelector('.detail-topic-btn');
    if (!btn) return;

    btn.addEventListener('click', () => {
        const topic = btn.dataset.topic;
        if (!topic) return;

        goTo(`/topic?topic=${encodeURIComponent(topic)}`);
    });
}

function bindDetailActionEvents() {
    const likeBtn = document.querySelector('#detail-like-btn');
    const favoriteBtn = document.querySelector('#detail-favorite-btn');
    const commentBtn = document.querySelector('#detail-comment-btn');

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

    if (commentBtn) {
        commentBtn.addEventListener('click', () => {
            const commentInput = document.querySelector('#detail-comment-input');
            if (!commentInput) return;

            commentInput.focus();
        });
    }
}

async function confirmDeleteCurrentPost() {
    const post = state.currentPostDetail;

    if (!post || !post.postId) {
        showToast('帖子信息不存在');
        closePostDeleteConfirm();
        return;
    }

    if (!isCurrentUserPost(post)) {
        showToast('只能删除自己的帖子');
        closePostDeleteConfirm();
        return;
    }

    try {
        closePostDeleteConfirm();
        toggleGlobalLoading(true);

        const result = await deletePostById(post.postId);

        if (result.code !== 200) {
            showToast(result.msg || '删除失败');
            return;
        }

        state.homeHasLoaded = false;
        state.homeScrollTop = 0;

        state.recommendPosts = state.recommendPosts.filter((item) => {
            return String(item.postId) !== String(post.postId);
        });

        state.followPosts = state.followPosts.filter((item) => {
            return String(item.postId) !== String(post.postId);
        });

        state.profilePosts = state.profilePosts.filter((item) => {
            return String(item.postId) !== String(post.postId);
        });

        state.profileLikedPosts = state.profileLikedPosts.filter((item) => {
            return String(item.postId) !== String(post.postId);
        });

        state.profileFavoritedPosts = state.profileFavoritedPosts.filter((item) => {
            return String(item.postId) !== String(post.postId);
        });

        showToast('删除成功');
        goTo(`/profile?userId=${getCurrentUserId()}`);
    } catch (error) {
        console.error('详情页删除帖子失败:', error);
        showToast('删除失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

async function hideCurrentPost() {
    const post = state.currentPostDetail;

    if (!post || !post.postId) {
        showToast('帖子信息不存在');
        return;
    }

    if (!isCurrentUserPost(post)) {
        showToast('只能隐藏自己的帖子');
        return;
    }

    const requestBody = {
        title: post.title || '',
        content: post.content || '',
        images: post.images || '',
        topic: post.topic || '',
        location: post.location || '',
        permission: 3
    };

    try {
        toggleGlobalLoading(true);

        const token = getToken();
        const response = await fetch(`${BASE_URL}/post/update/${post.postId}`, {
            method: 'POST',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || '隐藏失败');
            return;
        }

        state.currentPostDetail = {
            ...post,
            permission: 3,
            visibleType: 3,
            visibility: 'private',
            auth: 3
        };

        updatePostInAllLists(post.postId, (item) => {
            item.permission = 3;
            item.visibleType = 3;
            item.visibility = 'private';
            item.auth = 3;
        });

        state.homeHasLoaded = false;

        showToast('已隐藏帖子，仅自己可见');
        renderPostDetail();
    } catch (error) {
        console.error('隐藏帖子失败:', error);
        showToast('隐藏失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

function bindPostMoreEvents() {
    const moreBtn = document.querySelector('#post-more-btn');
    const sheet = document.querySelector('#post-action-sheet');
    const mask = document.querySelector('#post-action-sheet-mask');
    const editBtn = document.querySelector('#post-action-edit-btn');
    let hideBtn = document.querySelector('#post-action-hide-btn');
    const deleteBtn = document.querySelector('#post-action-delete-btn');
    const cancelBtn = document.querySelector('#post-action-cancel-btn');
    const deleteConfirmDialog = document.querySelector('#post-delete-confirm');
    const deleteConfirmMask = document.querySelector('#post-delete-confirm-mask');
    const deleteCancelBtn = document.querySelector('#post-delete-cancel-btn');
    const deleteConfirmBtn = document.querySelector('#post-delete-confirm-btn');

    if (!moreBtn || !sheet) return;

    if (!hideBtn && deleteBtn) {
        hideBtn = document.createElement('button');
        hideBtn.id = 'post-action-hide-btn';
        hideBtn.className = 'action-sheet__item';
        hideBtn.type = 'button';
        hideBtn.textContent = '隐藏帖子';
        deleteBtn.parentNode.insertBefore(hideBtn, deleteBtn);
    }

    moreBtn.addEventListener('click', () => {
        const post = state.currentPostDetail;

        if (!post || !post.postId) {
            showToast('帖子信息不存在');
            return;
        }

        if (!isCurrentUserPost(post)) {
            showToast('只能操作自己的帖子');
            return;
        }

        openPostActionSheet();
    });

    if (mask) {
        mask.addEventListener('click', closePostActionSheet);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closePostActionSheet);
    }

    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const post = state.currentPostDetail;
            if (!post || !post.postId) return;

            closePostActionSheet();
            goTo(`/publish?postId=${post.postId}`);
        });
    }

    if (hideBtn) {
        hideBtn.addEventListener('click', () => {
            const post = state.currentPostDetail;

            if (!post || !post.postId) {
                showToast('帖子信息不存在');
                closePostActionSheet();
                return;
            }

            if (!isCurrentUserPost(post)) {
                showToast('只能隐藏自己的帖子');
                closePostActionSheet();
                return;
            }

            closePostActionSheet();
            hideCurrentPost();
        });
    }

    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const post = state.currentPostDetail;

            if (!post || !post.postId) {
                showToast('帖子信息不存在');
                closePostActionSheet();
                return;
            }

            if (!isCurrentUserPost(post)) {
                showToast('只能删除自己的帖子');
                closePostActionSheet();
                return;
            }

            closePostActionSheet();
            openPostDeleteConfirm();
        });
    }

    if (deleteConfirmMask) {
        deleteConfirmMask.addEventListener('click', closePostDeleteConfirm);
    }

    if (deleteCancelBtn) {
        deleteCancelBtn.addEventListener('click', closePostDeleteConfirm);
    }

    if (deleteConfirmBtn) {
        deleteConfirmBtn.addEventListener('click', confirmDeleteCurrentPost);
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

// 统一删除函数

async function renderRecommendPostList(reset = true, renderPosts = state.recommendPosts) {
    const list = document.querySelector('#recommend-post-list');
    const leftCol = document.querySelector('#recommend-left-col');
    const rightCol = document.querySelector('#recommend-right-col');

    if (!list || !leftCol || !rightCol) return;

    if (!state.recommendPosts.length) {
        list.innerHTML = '<div class="empty-block">暂无帖子内容</div>';
        list.style.visibility = 'visible';
        updateRecommendListFooter();
        return;
    }

    if (reset) {
        list.style.visibility = 'hidden';
        leftCol.innerHTML = '';
        rightCol.innerHTML = '';
    } else {
        list.style.visibility = 'visible';
    }

    for (const item of renderPosts) {
        await appendRecommendPostCardStable(leftCol, rightCol, item);
    }

    bindRecommendPostCardEvents();
    bindRecommendPostActionEvents();
    bindPostCardAuthorEvents(list);
    updateRecommendListFooter();

    list.style.visibility = 'visible';
}

// 点击帖子卡片事件

function bindRecommendPostCardEvents() {
    const cards = document.querySelectorAll('.recommend-post-card');

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
        if (btn.dataset.actionBound === '1') return;
        btn.dataset.actionBound = '1';

        btn.addEventListener('click', (event) => {
            event.stopPropagation();

            const postId = btn.dataset.postId;
            const isLiked = btn.dataset.liked === '1';

            if (!postId) return;
            handlePostCardLikeToggle(postId, isLiked, btn);
        });
    });

    favoriteButtons.forEach((btn) => {
        if (btn.dataset.actionBound === '1') return;
        btn.dataset.actionBound = '1';

        btn.addEventListener('click', (event) => {
            event.stopPropagation();

            const postId = btn.dataset.postId;
            const isFavored = btn.dataset.favored === '1';

            if (!postId) return;
            handlePostCardFavoriteToggle(postId, isFavored, btn);
        });
    });
}

// 更新首页单张卡片按钮

function updateRecommendPostActionUI(postId) {
    const post = state.recommendPosts.find((item) => String(item.postId) === String(postId));
    if (!post) return;

    const card = document.querySelector(`.recommend-post-card[data-post-id="${postId}"]`);
    if (!card) return;

    const likeBtn = card.querySelector('.recommend-like-btn');
    const favoriteBtn = card.querySelector('.recommend-favorite-btn');

    const isLiked =
        post.isLiked === true ||
        post.isLiked === 1 ||
        post.isLiked === '1';

    const isFavored =
        state.favoriteStatusMap[String(postId)] ??
        (
            post.isFavorited === true || post.isFavorited === 1 || post.isFavorited === '1' ||
            post.isFav === true || post.isFav === 1 || post.isFav === '1' ||
            post.isFavorite === true || post.isFavorite === 1 || post.isFavorite === '1' ||
            post.isFavored === true || post.isFavored === 1 || post.isFavored === '1'
        );

    if (likeBtn) {
        likeBtn.dataset.liked = isLiked ? '1' : '0';
        likeBtn.innerHTML = `${heartIcon(isLiked)} ${post.likeCount ?? 0}`;
    }

    if (favoriteBtn) {
        favoriteBtn.dataset.favored = isFavored ? '1' : '0';
        favoriteBtn.innerHTML = `${starIcon(isFavored)} ${post.favCount ?? 0}`;
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

                requestAnimationFrame(() => {
                    renderRecommendPostList();
                    updateRecommendListFooter();
                });
            } else {
                followPanel.classList.add('active');
                followPanel.classList.remove('hidden');
                recommendPanel.classList.remove('active');
                recommendPanel.classList.add('hidden');

                if (!state.followPosts.length) {
                    fetchHomeFollowPosts();
                } else {
                    requestAnimationFrame(() => {
                        renderHomeFollowPosts(true);
                        updateFollowListFooter();
                    });
                }
            }
        });
    });
}
