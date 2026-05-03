// 05-search-topic

function normalizeSearchRecommendKeywords(sourceList = []) {
    const keywords = [];

    sourceList.forEach((item) => {
        if (!item) return;

        if (typeof item === 'string') {
            keywords.push(item);
            return;
        }

        const values = [
            item.keyword,
            item.keyWord,
            item.searchWord,
            item.title,
            item.topic,
            item.userName
        ];

        values.forEach((value) => {
            const text = String(value || '').trim();
            if (text) {
                keywords.push(text);
            }
        });
    });

    return [...new Set(keywords)].slice(0, 30);
}

function getLocalSearchRecommendKeywords() {
    const keywords = [];

    state.searchHistoryList.forEach((item) => {
        if (item) keywords.push(item);
    });

    state.recommendPosts.forEach((post) => {
        if (post.title) keywords.push(post.title);
        if (post.topic) keywords.push(post.topic);
    });

    state.followPosts.forEach((post) => {
        if (post.title) keywords.push(post.title);
        if (post.topic) keywords.push(post.topic);
    });

    const defaultKeywords = [
        '前端',
        '头像推荐',
        '测试',
        '校园',
        '美食',
        '篮球',
        '旅行',
        '日常'
    ];

    defaultKeywords.forEach((item) => keywords.push(item));

    return [...new Set(keywords)].slice(0, 30);
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

        if (result.code !== 200) {
            state.searchRecommendList = getLocalSearchRecommendKeywords();
            renderSearchRecommend();
            return;
        }

        const data = result.data || {};

        const apiKeywords = [
            ...normalizeSearchRecommendKeywords(data.keywords || []),
            ...normalizeSearchRecommendKeywords(data.keywordList || []),
            ...normalizeSearchRecommendKeywords(data.searchList || []),
            ...normalizeSearchRecommendKeywords(data.postLists || []),
            ...normalizeSearchRecommendKeywords(Array.isArray(data) ? data : [])
        ];

        const localKeywords = getLocalSearchRecommendKeywords();

        state.searchRecommendList = [...new Set([...apiKeywords, ...localKeywords])].slice(0, 30);
        state.searchRecommendExpanded = false;

        renderSearchRecommend();
    } catch (error) {
        console.error('获取搜索推荐失败:', error);

        state.searchRecommendList = getLocalSearchRecommendKeywords();
        renderSearchRecommend();
    }
}

// 渲染搜索推荐

function renderSearchRecommend() {
    const list = document.querySelector('#search-suggest-list');
    const moreBtn = document.querySelector('#more-search-suggest-btn');

    if (!list) return;

    const keywords = Array.isArray(state.searchRecommendList)
        ? state.searchRecommendList
        : [];

    if (!keywords.length) {
        list.innerHTML = '<div class="empty-block">暂无推荐内容</div>';

        if (moreBtn) {
            moreBtn.classList.add('hidden');
        }

        return;
    }

    const visibleKeywords = state.searchRecommendExpanded
        ? keywords
        : keywords.slice(0, 6);

    const html = visibleKeywords.map((keyword) => {
        return `
            <button class="search-tag-btn search-recommend-btn" type="button" data-keyword="${escapeHTML(keyword)}">
                ${escapeHTML(keyword)}
            </button>
        `;
    }).join('');

    list.innerHTML = html;

    if (moreBtn) {
        moreBtn.classList.toggle('hidden', keywords.length <= 6);
        moreBtn.textContent = state.searchRecommendExpanded ? '收起' : '更多';
    }

    bindSearchRecommendEvents();
}


// 获取主题帖子

async function loadTopicPage(topic) {
    try {
        toggleGlobalLoading(true);

        const token = getToken();
        const params = new URLSearchParams({
            lastPostId: '0',
            limit: '100'
        });

        const response = await fetch(`${BASE_URL}/post/all?${params.toString()}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || '获取主题帖子失败');
            return;
        }

        const allPosts = Array.isArray(result.data) ? result.data : [];

        state.topicPostList = allPosts.filter((item) => {
            return String(item.topic || '').trim() === String(topic).trim();
        });

        renderTopicPage();
    } catch (error) {
        console.error('获取主题帖子失败:', error);
        showToast('获取主题帖子失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 渲染主题页

function createTopicPostCard(item) {
    const imageList = item.images ? item.images.split(',') : [];
    const cover = imageList[0] || '';
    const title = item.title || '未命名帖子';

    return `
        <article class="post-card topic-post-card" data-post-id="${item.postId}">
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
    `;
}

function renderTopicPage() {
    const topic = state.currentTopicName || '';
    const title = document.querySelector('#topic-page-title');
    const topicName = document.querySelector('#topic-name');
    const postCount = document.querySelector('#topic-post-count');
    const relatedList = document.querySelector('#related-topic-list');
    const postList = document.querySelector('#topic-post-list');

    if (title) {
        title.textContent = `${topic} 主题`;
    }

    if (topicName) {
        topicName.textContent = `#${topic}`;
    }

    if (postCount) {
        postCount.textContent = '猜你想看';
    }

    if (relatedList) {
        const sourcePosts = [
            ...(Array.isArray(state.recommendPosts) ? state.recommendPosts : []),
            ...(Array.isArray(state.topicPostList) ? state.topicPostList : [])
        ];
        const allTopics = [...new Set(
            sourcePosts
                .map((item) => String(item.topic || '').trim())
                .filter((item) => item && item !== topic)
        )].slice(0, 8);

        if (!allTopics.length) {
            relatedList.innerHTML = '<span class="related-topic-empty">暂无推荐主题</span>';
        } else {
            relatedList.innerHTML = allTopics.map((item) => {
                return `<button class="related-topic-btn" type="button" data-topic="${escapeHTML(item)}">#${escapeHTML(item)}</button>`;
            }).join('');
        }
    }

    if (!postList) return;

    if (!state.topicPostList.length) {
        postList.innerHTML = '<div class="empty-block">这个主题下还没有帖子</div>';
        bindRelatedTopicEvents();
        return;
    }

    postList.innerHTML = `
        <div id="topic-left-col" class="waterfall-col"></div>
        <div id="topic-right-col" class="waterfall-col"></div>
    `;

    const leftCol = document.querySelector('#topic-left-col');
    const rightCol = document.querySelector('#topic-right-col');

    state.topicPostList.forEach((item, index) => {
        const cardHtml = createTopicPostCard(item);
        const targetCol = index % 2 === 0 ? leftCol : rightCol;
        if (targetCol) {
            targetCol.insertAdjacentHTML('beforeend', cardHtml);
            const card = targetCol.lastElementChild;
            hydratePostCardAuthor(card, item);
        }
    });

    postList.style.visibility = 'hidden';
    waitImagesLoaded(postList).finally(() => {
        postList.querySelectorAll('.topic-post-card').forEach(applyCardImageRatio);
        postList.style.visibility = 'visible';
    });

    bindTopicPostCardEvents();
    bindRelatedTopicEvents();
    bindPostCardActionEvents(postList);
    bindPostCardAuthorEvents(postList);
}

// 主题点击

function bindTopicPostCardEvents() {
    const cards = document.querySelectorAll('#topic-post-list .topic-post-card');

    cards.forEach((card) => {
        card.addEventListener('click', () => {
            const postId = card.dataset.postId;
            if (!postId) return;

            goTo(`/post-detail?id=${postId}`);
        });
    });
}


// 相关主题点击

function bindRelatedTopicEvents() {
    const buttons = document.querySelectorAll('.related-topic-btn');

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const topic = btn.dataset.topic;
            if (!topic) return;

            goTo(`/topic?topic=${encodeURIComponent(topic)}`);
        });
    });
}

// 推荐词点击

function bindSearchRecommendEvents() {
    const buttons = document.querySelectorAll('#search-suggest-list .search-recommend-btn');

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

async function enrichSearchPostList(postLists = []) {
    const token = getToken();

    const requests = postLists.map(async (item) => {
        const postId = item.postId;
        if (!postId) {
            return {
                ...item,
                images: item.image || '',
                likeCount: 0
            };
        }

        try {
            const response = await fetch(`${BASE_URL}/post/${postId}`, {
                method: 'GET',
                headers: {
                    Authorization: token
                }
            });

            const result = await response.json();

            if (result.code === 200 && result.data) {
                return {
                    ...item,
                    ...result.data,
                    postId,
                    title: result.data.title || item.title || '',
                    content: result.data.content || item.content || '',
                    images: result.data.images || item.image || '',
                    createTime: result.data.createTime || item.createTime || '',
                    likeCount: result.data.likeCount ?? 0,
                    favCount: result.data.favCount ?? 0,
                    commentCount: result.data.commentCount ?? 0
                };
            }
        } catch (error) {
            console.error('补全搜索帖子详情失败:', error);
        }

        return {
            ...item,
            images: item.image || item.images || '',
            likeCount: item.likeCount ?? 0
        };
    });

    return Promise.all(requests);
}

async function enrichSearchUserList(userLists = []) {
    const requests = userLists.map(async (item) => {
        const userId = item.userId || item.id || '';

        if (!userId) {
            return item;
        }

        const detail = await fetchPostAuthor(userId);

        if (!detail) {
            return item;
        }

        return {
            ...item,
            ...detail,
            userId,
            username: detail.userName || item.username || item.userName || '',
            url: detail.image || item.url || item.image || '',
            signature: detail.signature || item.signature || ''
        };
    });

    return Promise.all(requests);
}

function isPostTitleMatched(post, keyword) {
    const title = String(post?.title || '').trim();
    const key = String(keyword || '').trim();

    if (!title || !key) return false;

    return normalizeSearchText(title).includes(normalizeSearchText(key));
}

function mergePostListsByPostId(...lists) {
    const map = new Map();

    lists.flat().forEach((post) => {
        if (!post) return;

        const postId = post.postId || post.id || '';
        if (!postId) return;

        const oldPost = map.get(String(postId)) || {};

        map.set(String(postId), {
            ...oldPost,
            ...post,
            postId,
            images: post.images || post.image || oldPost.images || oldPost.image || '',
            likeCount: post.likeCount ?? oldPost.likeCount ?? 0,
            favCount: post.favCount ?? oldPost.favCount ?? 0,
            commentCount: post.commentCount ?? oldPost.commentCount ?? 0
        });
    });

    return Array.from(map.values());
}

async function fetchTitleMatchedPosts(keyword) {
    const localPosts = [
        ...state.recommendPosts,
        ...state.followPosts,
        ...state.profilePosts,
        ...state.profileLikedPosts,
        ...state.profileFavoritedPosts,
        ...state.topicPostList
    ].filter((post) => isPostTitleMatched(post, keyword));

    let remotePosts = [];

    try {
        const token = getToken();

        const params = new URLSearchParams({
            lastPostId: '0',
            limit: '100'
        });

        const response = await fetch(`${BASE_URL}/post/all?${params.toString()}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code === 200 && Array.isArray(result.data)) {
            remotePosts = result.data
                .filter((post) => {
                    const authorId = getPostAuthorId(post);

                    if (authorId) {
                        rememberPostOwner(post.postId || post.id, authorId);
                    }

                    return isPostTitleMatched(post, keyword);
                })
                .filter(canViewPost);
        }
    } catch (error) {
        console.error('标题搜索补充帖子失败:', error);
    }

    return mergePostListsByPostId(localPosts, remotePosts);
}

// 获取搜索结果

async function fetchSearchResult(keyword, pageNum = 1) {
    try {
        toggleGlobalLoading(true);

        const token = getToken();

        state.currentSearchKeyword = keyword;

        const requestBody = {
            keyword,
            searchType: 0,
            order: state.searchResultSort === 'likes' ? 1 : 0,
            pageNum,
            pageSize: 30
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

        if (result.code !== 200) {
            showToast(result.msg || '搜索失败');
            return;
        }

        const data = result.data || {};
        const postLists = Array.isArray(data.postLists) ? data.postLists : [];
        const userLists = Array.isArray(data.userLists) ? data.userLists : [];

        const [titleMatchedPosts, enrichedPostLists, enrichedUserLists] = await Promise.all([
            fetchTitleMatchedPosts(keyword),
            enrichSearchPostList(postLists),
            enrichSearchUserList(userLists)
        ]);

        state.searchResultData = {
            ...data,
            postLists: mergePostListsByPostId(enrichedPostLists, titleMatchedPosts),
            userLists: enrichedUserLists
        };

        state.searchResultVisibleCount = state.searchResultPageSize;

        renderSearchResult(keyword);
    } catch (error) {
        console.error('搜索失败:', error);
        showToast('搜索失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

function buildTopicResultsFromPosts(posts = [], keyword = '') {
    const topicMap = {};

    posts.forEach((post) => {
        const topic = String(post.topic || post.topicName || post.tag || post.tagName || '').trim();
        if (!topic) return;

        if (!topicMap[topic]) {
            topicMap[topic] = {
                _resultType: 'topic',
                topic,
                postCount: 0
            };
        }

        topicMap[topic].postCount += 1;
    });

    const topicList = Object.values(topicMap);
    const cleanKeyword = String(keyword || '').trim().replace(/^#/, '');

    if (!topicList.length && cleanKeyword) {
        topicList.push({
            _resultType: 'topic',
            topic: cleanKeyword,
            postCount: 0
        });
    }

    return topicList;
}

function mergeTopicResults(topicLists = []) {
    const topicMap = {};

    topicLists.forEach((item) => {
        const topic = String(item.topic || item.name || item.title || item.topicName || '').trim();
        if (!topic) return;

        if (!topicMap[topic]) {
            topicMap[topic] = {
                ...item,
                topic,
                _resultType: 'topic',
                postCount: Number(item.postCount ?? item.count ?? 0) || 0
            };
            return;
        }

        topicMap[topic].postCount += Number(item.postCount ?? item.count ?? 0) || 0;
    });

    return Object.values(topicMap);
}

function getSearchResultItems() {
    const data = state.searchResultData || {};

    const postLists = []
        .concat(Array.isArray(data.postLists) ? data.postLists : [])
        .concat(Array.isArray(data.posts) ? data.posts : [])
        .concat(Array.isArray(data.postList) ? data.postList : []);

    const userLists = []
        .concat(Array.isArray(data.userLists) ? data.userLists : [])
        .concat(Array.isArray(data.users) ? data.users : [])
        .concat(Array.isArray(data.userList) ? data.userList : []);

    const topicLists = []
        .concat(Array.isArray(data.topicLists) ? data.topicLists : [])
        .concat(Array.isArray(data.topics) ? data.topics : [])
        .concat(Array.isArray(data.topicList) ? data.topicList : []);

    const posts = filterVisiblePosts(postLists).map((item) => {
        return {
            ...item,
            _resultType: 'post'
        };
    });

    const users = userLists.map((item) => {
        return {
            ...item,
            _resultType: 'user'
        };
    });

    const rawTopics = topicLists.map((item) => {
        return {
            ...item,
            _resultType: 'topic'
        };
    });

    // 主题搜索页现在直接展示对应主题下的帖子卡片，
    // 不再把 #主题 普通卡片混入综合/主题列表，避免出现两种结果样式。
    return [...posts, ...users];
}

function getSearchItemText(item) {
    return [
        item.title,
        item.content,
        item.topic,
        item.userName,
        item.username,
        item.name,
        item.account,
        item.signature
    ].filter(Boolean).join(' ');
}

function getSearchItemImage(item) {
    if (item.image) return item.image;

    if (item.images) {
        return String(item.images).split(',').map((src) => src.trim()).filter(Boolean)[0] || '';
    }

    if (item.avatar) return item.avatar;
    if (item.background) return item.background;

    return '';
}

function isSearchTopicPostMatched(item, keyword = '') {
    if (!item || item._resultType !== 'post') return false;

    const topic = String(item.topic || item.topicName || item.tag || item.tagName || '').trim();
    if (!topic) return false;

    const normalizedTopic = normalizeSearchText(topic);
    const normalizedKeyword = normalizeSearchText(keyword);

    if (!normalizedKeyword) return true;

    return normalizedTopic.includes(normalizedKeyword) || normalizedKeyword.includes(normalizedTopic);
}

function filterSearchResultItems(items) {
    const currentTab = state.searchResultTab || 'all';
    const contentType = state.searchResultContentType || 'all';
    const keyword = state.currentSearchKeyword || '';

    return items.filter((item) => {
        if (currentTab === 'topic') {
            if (!isSearchTopicPostMatched(item, keyword)) {
                return false;
            }
        } else if (currentTab !== 'all' && item._resultType !== currentTab) {
            return false;
        }

        if (keyword && currentTab !== 'topic') {
            const text = getSearchItemText(item);

            if (!normalizeSearchText(text).includes(normalizeSearchText(keyword))) {
                return false;
            }
        }

        if (item._resultType !== 'post') {
            return true;
        }

        const image = getSearchItemImage(item);

        if (contentType === 'image') {
            return Boolean(image);
        }

        if (contentType === 'text') {
            return !image;
        }

        return true;
    });
}

function sortSearchResultItems(items) {
    const sortType = state.searchResultSort || 'latest';

    return [...items].sort((a, b) => {
        if (a._resultType !== 'post' || b._resultType !== 'post') {
            return 0;
        }

        if (sortType === 'likes') {
            return Number(b.likeCount || 0) - Number(a.likeCount || 0);
        }

        const timeA = new Date(a.createTime || 0).getTime();
        const timeB = new Date(b.createTime || 0).getTime();

        return timeB - timeA;
    });
}

function getBestSearchResultComment(item) {
    const comments = []
        .concat(Array.isArray(item.commentList) ? item.commentList : [])
        .concat(Array.isArray(item.comments) ? item.comments : []);

    if (!comments.length) return null;

    const sortedComments = comments
        .filter((comment) => Number(comment.likeCount || 0) > 0)
        .sort((a, b) => Number(b.likeCount || 0) - Number(a.likeCount || 0));

    return sortedComments[0] || null;
}

function createSearchPostResultCard(item, keyword) {
    const cardItem = {
        ...item,
        postId: item.postId,
        images: item.images || item.image || '',
        title: item.title || '未命名帖子',
        content: item.content || '',
        likeCount: item.likeCount ?? 0,
        favCount: item.favCount ?? 0,
        commentCount: item.commentCount ?? 0
    };

    const card = createRecommendPostCard(cardItem);
    if (!card) return '';

    card.classList.add('search-result-home-card');

    const titleEl = card.querySelector('.post-card__title');

    if (titleEl) {
        titleEl.innerHTML = highlightKeyword(cardItem.title, keyword);
    }

    return `
        <div class="search-result-post-card-wrap" data-post-id="${cardItem.postId}">
            ${card.outerHTML}
        </div>
    `;
}

function hydrateSearchResultPostCards(items = []) {
    const postItems = items.filter((item) => item._resultType === 'post');

    postItems.forEach((item) => {
        const postId = item.postId || '';
        const card = document.querySelector(`.search-result-post-card-wrap[data-post-id="${postId}"] .post-card`);

        if (!card) return;

        applyCardImageRatio(card);
        hydratePostCardAuthor(card, item);
    });
}

function createSearchUserResultCard(item, keyword) {
    const userId = item.userId || item.id || '';
    const userName = item.userName || item.username || item.name || `用户 ${userId}`;
    const avatar = item.image || item.url || item.avatar || '';
    const createTime = item.createTime || '';
    const signature = item.signature || item.introduction || item.desc || '这个人很懒，还没有签名。';

    return `
        <article class="search-result-user-card search-result-card--user" data-user-id="${userId}">
            <div class="search-result-user-card__avatar">
                ${avatar
            ? `<img src="${avatar}" alt="${escapeHTML(userName)}">`
            : `<span class="search-result-user-card__avatar-placeholder">${escapeHTML(userName.slice(0, 1))}</span>`
        }
            </div>

            <div class="search-result-user-card__info">
                <div class="search-result-user-card__label">用户</div>

                <h3 class="search-result-user-card__name">
                    ${highlightKeyword(userName, keyword)}
                </h3>

                <p class="search-result-user-card__signature">
                    ${escapeHTML(signature)}
                </p>

                ${createTime
            ? `<p class="search-result-user-card__time">${escapeHTML(createTime)}</p>`
            : ''
        }
            </div>
        </article>
    `;
}

function createSearchTopicResultCard(item, keyword) {
    const topic = item.topic || item.name || item.title || '';
    const postCount = Number(item.postCount ?? item.count ?? 0) || 0;

    return `
        <article class="search-result-card search-result-card--topic search-result-topic-card" data-topic="${escapeHTML(topic)}">
            <div class="search-result-card__body">
                <div class="search-result-card__type">主题</div>
                <h3 class="search-result-card__title">#${highlightKeyword(topic, keyword)}</h3>
                <p class="search-result-card__content">
                    ${postCount > 0 ? `相关帖子 ${postCount} 篇` : '查看该主题下的相关帖子'}
                </p>
            </div>
        </article>
    `;
}

// 渲染搜索结果

function renderSearchResult(keyword = '') {
    const list = document.querySelector('#search-result-list');
    const input = document.querySelector('#result-search-input');
    const loadMoreBtn = document.querySelector('#search-result-load-more-btn');
    const clearBtn = document.querySelector('#clear-result-search-btn');

    if (!list) return;

    const searchKeyword = keyword || state.currentSearchKeyword || '';

    if (input) {
        input.value = searchKeyword;
    }

    if (clearBtn) {
        clearBtn.classList.toggle('hidden', !searchKeyword);
    }

    const resultItems = getSearchResultItems();
    const filteredItems = filterSearchResultItems(resultItems);
    const sortedItems = sortSearchResultItems(filteredItems);

    const visibleItems = sortedItems.slice(0, state.searchResultVisibleCount);

    list.classList.remove('search-result-list--posts-only');

    if (!visibleItems.length) {
        const emptyText = state.searchResultTab === 'topic'
            ? '没有找到该主题下的相关帖子'
            : '没有找到相关内容';

        list.innerHTML = `<div class="empty-block">${emptyText}</div>`;

        if (loadMoreBtn) {
            loadMoreBtn.classList.add('hidden');
        }

        return;
    }

    const isPostOnlyResult = visibleItems.every((item) => item._resultType === 'post');
    list.classList.toggle('search-result-list--posts-only', isPostOnlyResult);

    if (isPostOnlyResult) {
        const leftColumnItems = [];
        const rightColumnItems = [];

        visibleItems.forEach((item, index) => {
            const cardHtml = createSearchPostResultCard(item, searchKeyword);

            if (index % 2 === 0) {
                leftColumnItems.push(cardHtml);
            } else {
                rightColumnItems.push(cardHtml);
            }
        });

        list.innerHTML = `
            <div class="search-result-waterfall-list">
                <div class="search-result-waterfall-col">${leftColumnItems.join('')}</div>
                <div class="search-result-waterfall-col">${rightColumnItems.join('')}</div>
            </div>
        `;
    } else {
        list.innerHTML = visibleItems.map((item) => {
            if (item._resultType === 'user') {
                return createSearchUserResultCard(item, searchKeyword);
            }

            if (item._resultType === 'topic') {
                return createSearchTopicResultCard(item, searchKeyword);
            }

            return createSearchPostResultCard(item, searchKeyword);
        }).join('');
    }

    if (loadMoreBtn) {
        const hasMore = sortedItems.length > state.searchResultVisibleCount;
        loadMoreBtn.classList.toggle('hidden', !hasMore);
    }

    hydrateSearchResultPostCards(visibleItems);
    bindSearchResultCardEvents();
    bindSearchResultTopicEvents();
}

// 搜索结果主题点击

function bindSearchResultTopicEvents() {
    const cards = document.querySelectorAll('.search-result-topic-card, .search-result-card--topic');

    cards.forEach((card) => {
        if (card.dataset.topicBound === '1') return;
        card.dataset.topicBound = '1';

        card.addEventListener('click', (event) => {
            event.stopPropagation();

            const topic = card.dataset.topic;
            if (!topic) return;

            goTo(`/topic?topic=${encodeURIComponent(topic)}`);
        });
    });
}

function bindSearchResultCardEvents() {
    const postCards = document.querySelectorAll('.search-result-post-card-wrap .post-card');
    const userCards = document.querySelectorAll('.search-result-card--user');
    const topicCards = document.querySelectorAll('.search-result-card--topic');

    postCards.forEach((card) => {
        card.addEventListener('click', () => {
            const postId = card.dataset.postId;
            if (!postId) return;

            goTo(`/post-detail?id=${postId}`);
        });
    });

    userCards.forEach((card) => {
        card.addEventListener('click', () => {
            const userId = card.dataset.userId;
            if (!userId) return;

            goTo(`/profile?userId=${userId}`);
        });
    });

    topicCards.forEach((card) => {
        card.addEventListener('click', () => {
            const topic = card.dataset.topic;
            if (!topic) return;

            goTo(`/topic?topic=${encodeURIComponent(topic)}`);
        });
    });

    bindPostCardActionEvents(document.querySelector('#search-result-list'));
    bindPostCardAuthorEvents(document.querySelector('#search-result-list'));
}

// 获取消息

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

function bindSearchEvents() {
    const searchInput = document.querySelector('#search-input');
    const searchSubmitBtn = document.querySelector('#search-submit-btn');
    const resultSearchBtn = document.querySelector('#result-search-btn');
    const clearSearchBtn = document.querySelector('#clear-search-input-btn');
    const clearResultSearchBtn = document.querySelector('#clear-result-search-btn');
    const clearSearchHistoryBtn = document.querySelector('#clear-search-history-btn');
    const moreSearchSuggestBtn = document.querySelector('#more-search-suggest-btn');
    const resultInput = document.querySelector('#result-search-input');
    const resultTabButtons = document.querySelectorAll('[data-result-tab]');
    const resultSortButtons = document.querySelectorAll('[data-sort]');
    const resultContentTypeButtons = document.querySelectorAll('[data-content-type]');
    const loadMoreBtn = document.querySelector('#search-result-load-more-btn');

    function toggleSearchClearBtn() {
        if (!clearSearchBtn || !searchInput) return;

        const hasValue = Boolean(searchInput.value.trim());
        clearSearchBtn.classList.toggle('hidden', !hasValue);
    }

    function toggleResultClearBtn() {
        if (!clearResultSearchBtn || !resultInput) return;

        const hasValue = Boolean(resultInput.value.trim());
        clearResultSearchBtn.classList.toggle('hidden', !hasValue);
    }

    function searchFromMainInput() {
        if (!searchInput) return;

        const keyword = searchInput.value.trim();

        if (!keyword) {
            showToast('请输入搜索内容');
            return;
        }

        addSearchHistory(keyword);
        goTo(`/search-result?keyword=${encodeURIComponent(keyword)}`);
    }

    function searchFromResultInput() {
        if (!resultInput) return;

        const keyword = resultInput.value.trim();

        if (!keyword) {
            showToast('请输入搜索内容');
            return;
        }

        addSearchHistory(keyword);
        goTo(`/search-result?keyword=${encodeURIComponent(keyword)}`);
    }

    if (searchInput) {
        searchInput.addEventListener('input', toggleSearchClearBtn);

        searchInput.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;

            event.preventDefault();
            searchFromMainInput();
        });

        toggleSearchClearBtn();
    }

    if (searchSubmitBtn) {
        searchSubmitBtn.addEventListener('click', searchFromMainInput);
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', () => {
            if (!searchInput) return;

            searchInput.value = '';
            toggleSearchClearBtn();
            searchInput.focus();
        });
    }

    if (resultInput) {
        resultInput.addEventListener('input', toggleResultClearBtn);

        resultInput.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;

            event.preventDefault();
            searchFromResultInput();
        });

        toggleResultClearBtn();
    }

    if (resultSearchBtn) {
        resultSearchBtn.addEventListener('click', searchFromResultInput);
    }

    if (clearResultSearchBtn) {
        clearResultSearchBtn.addEventListener('click', () => {
            goTo('/search');
        });
    }

    if (clearSearchHistoryBtn) {
        clearSearchHistoryBtn.addEventListener('click', () => {
            clearSearchHistory();
            renderSearchRecommend();
        });
    }

    if (moreSearchSuggestBtn) {
        moreSearchSuggestBtn.addEventListener('click', () => {
            state.searchRecommendExpanded = !state.searchRecommendExpanded;
            renderSearchRecommend();
        });
    }

    resultTabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            resultTabButtons.forEach((item) => item.classList.remove('active'));
            btn.classList.add('active');

            state.searchResultTab = btn.dataset.resultTab || 'all';
            state.searchResultVisibleCount = state.searchResultPageSize;

            renderSearchResult(state.currentSearchKeyword);
        });
    });

    resultSortButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            resultSortButtons.forEach((item) => item.classList.remove('active'));
            btn.classList.add('active');

            state.searchResultSort = btn.dataset.sort || 'latest';
            state.searchResultVisibleCount = state.searchResultPageSize;

            renderSearchResult(state.currentSearchKeyword);
        });
    });

    resultContentTypeButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            resultContentTypeButtons.forEach((item) => item.classList.remove('active'));
            btn.classList.add('active');

            state.searchResultContentType = btn.dataset.contentType || 'all';
            state.searchResultVisibleCount = state.searchResultPageSize;

            renderSearchResult(state.currentSearchKeyword);
        });
    });

    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', () => {
            state.searchResultVisibleCount += state.searchResultPageSize;
            renderSearchResult(state.currentSearchKeyword);
        });
    }
}
