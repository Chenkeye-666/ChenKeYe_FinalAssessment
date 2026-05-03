// 07-messages

async function fetchAllMessages() {
    try {
        toggleGlobalLoading(true);

        const token = getToken();

        const response = await fetch(`${BASE_URL}/message/all`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || '获取消息失败');
            return;
        }

        state.messageList = Array.isArray(result.data?.messages) ? result.data.messages : [];
        syncMessageGroups();
    } catch (error) {
        console.error('获取消息失败:', error);
        showToast('获取消息失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 本地时间格式化

function getMessageId(item) {
    return String(item?.messageId ?? item?.id ?? item?.msgId ?? '');
}


function normalizeMessagePostId(value) {
    const text = String(value ?? '').trim();

    if (!text || text === 'null' || text === 'undefined' || text === '0') {
        return '';
    }

    return text;
}

function getMessageTargetPostId(item) {
    return normalizeMessagePostId(item?.postId);
}

function getMessageItemByCard(card) {
    const messageId = card?.dataset?.messageId || '';
    if (!messageId) return null;

    return state.messageList.find((item) => getMessageId(item) === String(messageId)) || null;
}

async function checkMessageTargetPostExists(postId) {
    try {
        const token = getToken();

        const response = await fetch(`${BASE_URL}/post/${postId}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();
        return result.code === 200 && result.data;
    } catch (error) {
        console.error('校验消息跳转帖子失败:', error);
        return false;
    }
}

async function openMessageTargetPost(card, options = {}) {
    const item = getMessageItemByCard(card);
    const postId = getMessageTargetPostId(item) || normalizeMessagePostId(card?.dataset?.postId);
    const shouldValidate = options.validate === true;
    const failMessage = options.failMessage || '相关内容已被删除或暂不支持跳转';

    if (!postId) {
        showToast(failMessage);
        return;
    }

    if (shouldValidate) {
        toggleGlobalLoading(true);
        const exists = await checkMessageTargetPostExists(postId);
        toggleGlobalLoading(false);

        if (!exists) {
            showToast(failMessage);
            return;
        }
    }

    goTo(`/post-detail?id=${encodeURIComponent(postId)}`);
}

function getMessageReadStorageKey() {
    return `${MESSAGE_READ_KEY_PREFIX}${getCurrentUserId() || 'guest'}`;
}

function loadLocalReadMessageIds() {
    try {
        const raw = localStorage.getItem(getMessageReadStorageKey());
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list.map(String) : [];
    } catch (error) {
        return [];
    }
}

function saveLocalReadMessageIds(ids) {
    localStorage.setItem(getMessageReadStorageKey(), JSON.stringify(Array.from(new Set(ids.map(String)))));
}

function markMessageAsRead(item) {
    const messageId = getMessageId(item);
    if (!messageId) return;

    item.isRead = 1;

    const readIds = loadLocalReadMessageIds();
    if (!readIds.includes(messageId)) {
        readIds.push(messageId);
        saveLocalReadMessageIds(readIds);
    }

    syncMessageUnreadCountsOnly();
    renderMessageTabBadges();
    renderGlobalMessageBadge();
}

function markMessageAsReadById(messageId) {
    const targetId = String(messageId || '');
    if (!targetId) return;

    const target = state.messageList.find((item) => getMessageId(item) === targetId);
    if (target) {
        markMessageAsRead(target);
    }
}

function syncMessageUnreadCountsOnly() {
    state.followUnreadCount = state.followMessageList.filter((item) => !isMessageRead(item)).length;
    state.commentUnreadCount = state.commentMessageList.filter((item) => !isMessageRead(item)).length;
    state.likeUnreadCount = state.likeMessageList.filter((item) => !isMessageRead(item)).length;
    state.commentLikeUnreadCount = state.commentLikeMessageList.filter((item) => !isMessageRead(item)).length;
}

function startMessageUnreadPolling() {
    if (!state.isLogin) return;

    if (state.messageUnreadPollTimer) {
        return;
    }

    state.messageUnreadPollTimer = window.setInterval(() => {
        if (!state.isLogin) {
            stopMessageUnreadPolling();
            return;
        }

        if (document.hidden) return;

        fetchUnreadMessages(true);
    }, MESSAGE_UNREAD_POLL_INTERVAL);
}

function stopMessageUnreadPolling() {
    if (!state.messageUnreadPollTimer) return;

    window.clearInterval(state.messageUnreadPollTimer);
    state.messageUnreadPollTimer = null;
}

function bindMessageUnreadPollingEvents() {
    if (document.body?.dataset.messagePollingBound === '1') return;

    if (document.body) {
        document.body.dataset.messagePollingBound = '1';
    }

    document.addEventListener('visibilitychange', () => {
        if (!state.isLogin) return;

        if (document.hidden) {
            stopMessageUnreadPolling();
            return;
        }

        fetchUnreadMessages(true);
        startMessageUnreadPolling();
    });
}

async function fetchUnreadMessages(silent = false) {
    try {
        const token = getToken();

        const response = await fetch(`${BASE_URL}/message/unread`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            if (!silent) {
                showToast(result.msg || '获取未读消息失败');
            }
            return;
        }

        const unreadMessages = Array.isArray(result.data?.messages) ? result.data.messages : [];

        state.followUnreadCount = unreadMessages.filter((item) => Number(item.type) === 4 && !isMessageRead(item)).length;
        state.commentUnreadCount = unreadMessages.filter((item) => Number(item.type) === 3 && !isMessageRead(item)).length;

        state.likeUnreadCount = unreadMessages.filter((item) => {
            const type = Number(item.type);
            return (type === 1 || type === 2) && !isMessageRead(item);
        }).length;

        state.commentLikeUnreadCount = unreadMessages.filter((item) => Number(item.type) === 5 && !isMessageRead(item)).length;

        renderMessageTabBadges();
        renderGlobalMessageBadge();
    } catch (error) {
        console.error('获取未读消息失败:', error);
        if (!silent) {
            showToast('获取未读消息失败，请稍后重试');
        }
    }
}

function renderMessageTabBadges() {
    const followBtn = document.querySelector('[data-message-tab="follow"]');
    const commentBtn = document.querySelector('[data-message-tab="comment"]');
    const likeBtn = document.querySelector('[data-message-tab="like"]');
    const commentLikeBtn = document.querySelector('[data-message-tab="comment-like"]');

    if (followBtn) {
        followBtn.textContent = state.followUnreadCount > 0
            ? `关注我 (${state.followUnreadCount})`
            : '关注我';
    }

    if (commentBtn) {
        commentBtn.textContent = state.commentUnreadCount > 0
            ? `评论我 (${state.commentUnreadCount})`
            : '评论我';
    }

    if (likeBtn) {
        likeBtn.textContent = state.likeUnreadCount > 0
            ? `赞和收藏 (${state.likeUnreadCount})`
            : '赞和收藏';
    }

    if (commentLikeBtn) {
        commentLikeBtn.textContent = state.commentLikeUnreadCount > 0
            ? `评论获赞 (${state.commentLikeUnreadCount})`
            : '评论获赞';
    }
}

function renderGlobalMessageBadge() {
    const badge = document.querySelector('#global-message-badge');
    if (!badge) return;

    const totalUnread =
        state.followUnreadCount +
        state.commentUnreadCount +
        state.likeUnreadCount +
        state.commentLikeUnreadCount;

    if (totalUnread > 0) {
        badge.textContent = totalUnread > 99 ? '99+' : String(totalUnread);
        badge.classList.remove('hidden');
    } else {
        badge.textContent = '0';
        badge.classList.add('hidden');
    }
}

// 消息分类

function syncMessageGroups() {
    const list = Array.isArray(state.messageList) ? state.messageList : [];

    state.followMessageList = list.filter((item) => Number(item.type) === 4);
    state.commentMessageList = list.filter((item) => Number(item.type) === 3);

    state.likeMessageList = list.filter((item) => {
        const type = Number(item.type);
        return type === 1 || type === 2;
    });

    state.commentLikeMessageList = list.filter((item) => Number(item.type) === 5);

    state.followUnreadCount = state.followMessageList.filter((item) => !isMessageRead(item)).length;
    state.commentUnreadCount = state.commentMessageList.filter((item) => !isMessageRead(item)).length;
    state.likeUnreadCount = state.likeMessageList.filter((item) => !isMessageRead(item)).length;
    state.commentLikeUnreadCount = state.commentLikeMessageList.filter((item) => !isMessageRead(item)).length;

    renderFollowMessages();
    renderCommentMessages();
    renderLikeMessages();
    renderCommentLikeMessages();
    renderMessageTabBadges();
    renderGlobalMessageBadge();
}

function isMessageRead(item) {
    const messageId = getMessageId(item);
    const localReadIds = loadLocalReadMessageIds();

    return (
        item.isRead === true || item.isRead === 1 || item.isRead === '1' ||
        (messageId && localReadIds.includes(String(messageId)))
    );
}

function formatMessageContent(item, fallback = '') {
    const rawContent = String(item?.content || item?.message || item?.msg || fallback || '').trim();

    if (!rawContent) return fallback;

    const commentReplyMatch = rawContent.match(/^您的评论《(.+?)》被(.+?)评论$/);
    if (commentReplyMatch) {
        return `${commentReplyMatch[2]}回复了你的评论《${commentReplyMatch[1]}》`;
    }

    const postCommentMatch = rawContent.match(/^您的帖子《(.+?)》被(.+?)评论$/);
    if (postCommentMatch) {
        return `${postCommentMatch[2]}评论了你的帖子《${postCommentMatch[1]}》`;
    }

    return rawContent;
}

// 渲染“关注我”

function renderFollowMessages() {
    const list = document.querySelector('#follow-message-list');
    if (!list) return;

    if (!state.followMessageList.length) {
        list.innerHTML = '<div class="empty-block">还没有新的关注消息</div>';
        return;
    }

    const html = state.followMessageList.map((item) => {
        const senderId = item.senderId || '';
        const content = formatMessageContent(item, '有用户关注了你');
        const createTime = item.createTime || '';
        const isRead = isMessageRead(item);
        const messageId = getMessageId(item);

        return `
            <article class="message-card follow-message-card ${isRead ? '' : 'message-card--unread'}"
                     data-sender-id="${senderId}" data-message-id="${escapeHTML(messageId)}">
                <div class="message-card__main">
                    <h3 class="message-card__title">用户 ${senderId}</h3>
                    <p class="message-card__content">${escapeHTML(content)}</p>
                    <p class="message-card__time">${escapeHTML(createTime)}</p>
                </div>
                <div class="message-card__status ${isRead ? 'is-read' : 'is-unread'}">
                    ${isRead ? '已读' : '未读'}
                </div>
            </article>
        `;
    }).join('');

    list.innerHTML = html;
    bindFollowMessageEvents();
}

// 渲染“点赞我”

function renderLikeMessages() {
    const list = document.querySelector('#like-message-list');
    if (!list) return;

    if (!state.likeMessageList.length) {
        list.innerHTML = '<div class="empty-block">还没有新的点赞消息</div>';
        return;
    }

    const html = state.likeMessageList.map((item) => {
        const senderId = item.senderId || '';
        const postId = getMessageTargetPostId(item);
        const content = formatMessageContent(item, '有人点赞了你的帖子');
        const createTime = item.createTime || '';
        const isRead = isMessageRead(item);
        const messageId = getMessageId(item);

        return `
            <article class="message-card like-message-card ${isRead ? '' : 'message-card--unread'}"
                     data-post-id="${postId}" data-message-id="${escapeHTML(messageId)}">
                <div class="message-card__main">
                    <h3 class="message-card__title">用户 ${senderId}</h3>
                    <p class="message-card__content">${escapeHTML(content)}</p>
                    <p class="message-card__time">${escapeHTML(createTime)}</p>
                </div>
                <div class="message-card__status ${isRead ? 'is-read' : 'is-unread'}">
                    ${isRead ? '已读' : '未读'}
                </div>
            </article>
        `;
    }).join('');

    list.innerHTML = html;
    bindLikeMessageEvents();
}

// 渲染“评论我”

function renderCommentMessages() {
    const list = document.querySelector('#comment-message-list');
    if (!list) return;

    if (!state.commentMessageList.length) {
        list.innerHTML = '<div class="empty-block">还没有新的评论消息</div>';
        return;
    }

    const html = state.commentMessageList.map((item) => {
        const senderId = item.senderId || '';
        const postId = getMessageTargetPostId(item);
        const content = formatMessageContent(item, '有人评论了你的帖子');
        const createTime = item.createTime || '';
        const isRead = isMessageRead(item);
        const messageId = getMessageId(item);

        return `
            <article class="message-card comment-message-card ${isRead ? '' : 'message-card--unread'}"
                     data-post-id="${postId}" data-message-id="${escapeHTML(messageId)}">
                <div class="message-card__main">
                    <h3 class="message-card__title">用户 ${senderId}</h3>
                    <p class="message-card__content">${escapeHTML(content)}</p>
                    <p class="message-card__time">${escapeHTML(createTime)}</p>
                </div>
                <div class="message-card__status ${isRead ? 'is-read' : 'is-unread'}">
                    ${isRead ? '已读' : '未读'}
                </div>
            </article>
        `;
    }).join('');

    list.innerHTML = html;
    bindCommentMessageEvents();
}

// 渲染评论点赞

function renderCommentLikeMessages() {
    const list = document.querySelector('#comment-like-message-list');
    if (!list) return;

    if (!state.commentLikeMessageList.length) {
        list.innerHTML = '<div class="empty-block">暂无评论获赞消息</div>';
        return;
    }

    const html = state.commentLikeMessageList.map((item) => {
        const senderId = item.senderId || '';
        const postId = getMessageTargetPostId(item);
        const content = formatMessageContent(item, '有人点赞了你的评论');
        const createTime = item.createTime || item.time || '';
        const isRead = isMessageRead(item);
        const messageId = getMessageId(item);

        return `
            <article class="message-card comment-like-message-card ${isRead ? '' : 'message-card--unread'}"
                     data-post-id="${escapeHTML(postId)}"
                     data-message-id="${escapeHTML(messageId)}">
                <div class="message-card__main">
                    <h3 class="message-card__title">用户 ${escapeHTML(senderId)}</h3>
                    <p class="message-card__content">${escapeHTML(content)}</p>
                    <p class="message-card__time">${escapeHTML(createTime)}</p>
                </div>
                <div class="message-card__status ${isRead ? 'is-read' : 'is-unread'}">
                    ${isRead ? '已读' : '未读'}
                </div>
            </article>
        `;
    }).join('');

    list.innerHTML = html;
    bindCommentLikeMessageEvents();
}

function markMessageCardAsRead(card) {
    const messageId = card?.dataset?.messageId || '';
    if (!messageId) return;

    markMessageAsReadById(messageId);
    card.classList.remove('message-card--unread');

    const status = card.querySelector('.message-card__status');
    if (status) {
        status.textContent = '已读';
        status.classList.remove('is-unread');
        status.classList.add('is-read');
    }
}

// “关注我”消息点击

function bindFollowMessageEvents() {
    const cards = document.querySelectorAll('.follow-message-card');

    cards.forEach((card) => {
        card.addEventListener('click', () => {
            markMessageCardAsRead(card);

            const senderId = card.dataset.senderId;
            if (!senderId) return;

            goTo(`/profile?userId=${senderId}`);
        });
    });
}

// “点赞我”消息点击

function bindLikeMessageEvents() {
    const cards = document.querySelectorAll('.like-message-card');

    cards.forEach((card) => {
        card.addEventListener('click', () => {
            markMessageCardAsRead(card);

            openMessageTargetPost(card);
        });
    });
}

// “评论我”消息点击

function bindCommentMessageEvents() {
    const cards = document.querySelectorAll('.comment-message-card');

    cards.forEach((card) => {
        card.addEventListener('click', () => {
            markMessageCardAsRead(card);

            openMessageTargetPost(card);
        });
    });
}

// “评论获赞”消息点击

function bindCommentLikeMessageEvents() {
    const cards = document.querySelectorAll('.comment-like-message-card');

    cards.forEach((card) => {
        card.addEventListener('click', () => {
            markMessageCardAsRead(card);

            openMessageTargetPost(card, {
                validate: true,
                failMessage: '这条评论获赞暂不支持直接跳转原帖'
            });
        });
    });
}

// 读取搜索历史

function bindMessageTabs() {
    const buttons = document.querySelectorAll('[data-message-tab]');
    const panels = {
        follow: document.querySelector('#message-follow-panel'),
        comment: document.querySelector('#message-comment-panel'),
        like: document.querySelector('#message-like-panel'),
        'comment-like': document.querySelector('#message-comment-like-panel')
    };

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            buttons.forEach((item) => item.classList.remove('active'));

            Object.values(panels).forEach((panel) => {
                if (!panel) return;
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
