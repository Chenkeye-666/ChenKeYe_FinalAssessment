// 08-chat

function getChatMessageTimeValue(message) {
    const rawTime = message?.createTime || message?.sendTime || '';

    if (rawTime) {
        const normalizedTime = String(rawTime).replace(' ', 'T');
        const timeValue = new Date(normalizedTime).getTime();

        if (!Number.isNaN(timeValue)) {
            return timeValue;
        }
    }

    const idValue = Number(message?.chatMsgId || 0);
    return Number.isNaN(idValue) ? 0 : idValue;
}

function sortChatHistoryList() {
    state.chatHistoryList.sort((a, b) => {
        return getChatMessageTimeValue(a) - getChatMessageTimeValue(b);
    });
}

function getChatLocalKey(prefix) {
    return `${prefix}${getCurrentUserId() || 'guest'}`;
}

function readLocalStringList(key) {
    try {
        const raw = localStorage.getItem(key);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list.map((item) => String(item)) : [];
    } catch (error) {
        return [];
    }
}

function saveLocalStringList(key, list) {
    const safeList = Array.isArray(list) ? Array.from(new Set(list.map((item) => String(item)))) : [];
    localStorage.setItem(key, JSON.stringify(safeList));
}

function loadChatLocalState() {
    state.chatPinnedUserIds = readLocalStringList(getChatLocalKey(CHAT_PINNED_KEY_PREFIX));
    state.chatDeletedUserIds = readLocalStringList(getChatLocalKey(CHAT_DELETED_KEY_PREFIX));
    state.chatRevokedMessageIds = readLocalStringList(getChatLocalKey(CHAT_REVOKED_KEY_PREFIX));
}

function saveChatPinnedIds() {
    saveLocalStringList(getChatLocalKey(CHAT_PINNED_KEY_PREFIX), state.chatPinnedUserIds);
}

function saveChatDeletedIds() {
    saveLocalStringList(getChatLocalKey(CHAT_DELETED_KEY_PREFIX), state.chatDeletedUserIds);
}

function saveChatRevokedIds() {
    saveLocalStringList(getChatLocalKey(CHAT_REVOKED_KEY_PREFIX), state.chatRevokedMessageIds);
}

function isChatUserPinned(userId) {
    return state.chatPinnedUserIds.some((id) => String(id) === String(userId));
}

function isChatUserDeleted(userId) {
    return state.chatDeletedUserIds.some((id) => String(id) === String(userId));
}

function isChatMessageRevoked(message) {
    return state.chatRevokedMessageIds.some((id) => String(id) === String(message?.chatMsgId));
}

function toggleChatSessionPinned(userId) {
    const id = String(userId || '');
    if (!id) return;

    if (isChatUserPinned(id)) {
        state.chatPinnedUserIds = state.chatPinnedUserIds.filter((item) => String(item) !== id);
        showToast('已取消置顶');
    } else {
        state.chatPinnedUserIds.unshift(id);
        state.chatPinnedUserIds = Array.from(new Set(state.chatPinnedUserIds));
        showToast('已置顶');
    }

    saveChatPinnedIds();
    renderChatSessionListPage();
}

function ensureChatDeleteConfirmDialog() {
    let dialog = document.querySelector('#chat-delete-confirm');

    if (dialog) return dialog;

    dialog = document.createElement('div');
    dialog.id = 'chat-delete-confirm';
    dialog.className = 'confirm-dialog hidden';
    dialog.innerHTML = `
        <div id="chat-delete-confirm-mask" class="confirm-dialog__mask"></div>

        <div class="confirm-dialog__panel">
            <h3 class="confirm-dialog__title">删除私聊会话</h3>
            <p id="chat-delete-confirm-text" class="confirm-dialog__text">
                确定要从当前设备移除这个私聊会话吗？不会删除服务器聊天记录。
            </p>

            <div class="confirm-dialog__actions">
                <button id="chat-delete-cancel-btn" class="confirm-dialog__btn" type="button">
                    取消
                </button>
                <button id="chat-delete-confirm-btn" class="confirm-dialog__btn confirm-dialog__btn--danger" type="button">
                    删除
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const mask = dialog.querySelector('#chat-delete-confirm-mask');
    const cancelBtn = dialog.querySelector('#chat-delete-cancel-btn');
    const confirmBtn = dialog.querySelector('#chat-delete-confirm-btn');

    if (mask) {
        mask.addEventListener('click', closeChatDeleteConfirm);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeChatDeleteConfirm);
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmDeleteChatSessionLocally);
    }

    return dialog;
}

function openChatDeleteConfirm(userId) {
    const id = String(userId || '');
    if (!id) return;

    state.pendingDeleteChatUserId = id;

    const dialog = ensureChatDeleteConfirmDialog();
    const text = dialog.querySelector('#chat-delete-confirm-text');

    if (text) {
        text.textContent = `确定要从当前设备移除与用户 ${id} 的私聊会话吗？不会删除服务器聊天记录。`;
    }

    dialog.classList.remove('hidden');
}

function closeChatDeleteConfirm() {
    const dialog = document.querySelector('#chat-delete-confirm');

    if (dialog) {
        dialog.classList.add('hidden');
    }

    state.pendingDeleteChatUserId = '';
}

function confirmDeleteChatSessionLocally() {
    const id = String(state.pendingDeleteChatUserId || '');
    if (!id) return;

    if (!isChatUserDeleted(id)) {
        state.chatDeletedUserIds.push(id);
        state.chatDeletedUserIds = Array.from(new Set(state.chatDeletedUserIds));
        saveChatDeletedIds();
    }

    closeChatDeleteConfirm();
    showToast('已删除会话');
    renderChatSessionListPage();
}

function deleteChatSessionLocally(userId) {
    openChatDeleteConfirm(userId);
}

function restoreDeletedChatSession(userId) {
    const id = String(userId || '');
    if (!id) return;

    state.chatDeletedUserIds = state.chatDeletedUserIds.filter((item) => String(item) !== id);
    saveChatDeletedIds();
}

function revokeChatMessageLocally(messageId) {
    const id = String(messageId || '');
    if (!id) return;

    if (!state.chatRevokedMessageIds.some((item) => String(item) === id)) {
        state.chatRevokedMessageIds.push(id);
        saveChatRevokedIds();
    }

    const message = state.chatHistoryList.find((item) => String(item.chatMsgId) === id);
    if (message) {
        message.isRevoked = true;
    }

    renderChatHistory(false);
    showToast('已撤回');
}

function shouldShowChatTimeDivider(currentMessage, previousMessage) {
    if (!previousMessage) return true;

    const currentTime = getChatMessageTimeValue(currentMessage);
    const previousTime = getChatMessageTimeValue(previousMessage);

    if (!currentTime || !previousTime) return true;

    const currentDate = new Date(currentTime);
    const previousDate = new Date(previousTime);
    const isDifferentDay = currentDate.toDateString() !== previousDate.toDateString();
    const isLongGap = currentTime - previousTime >= 5 * 60 * 1000;

    return isDifferentDay || isLongGap;
}

function formatChatDividerTime(message) {
    const timeValue = getChatMessageTimeValue(message);
    if (!timeValue) return '';

    const date = new Date(timeValue);
    const now = new Date();
    const today = now.toDateString();
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);

    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');

    if (date.toDateString() === today) {
        return `${hour}:${minute}`;
    }

    if (date.toDateString() === yesterdayDate.toDateString()) {
        return `昨天 ${hour}:${minute}`;
    }

    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
}

// 获取聊天历史

async function fetchChatHistory(receiverId, pageNum = 1, pageSize = 20) {
    try {
        toggleGlobalLoading(true);

        const token = getToken();
        const senderId = localStorage.getItem('userId');

        if (!senderId || !receiverId) {
            showToast('聊天参数不完整');
            return;
        }

        const params = new URLSearchParams({
            senderId: String(senderId),
            receiverId: String(receiverId),
            pageNum: String(pageNum),
            pageSize: String(pageSize)
        });

        const response = await fetch(`${BASE_URL}/chat/history?${params.toString()}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || '获取聊天记录失败');
            return;
        }

        const records = Array.isArray(result.data?.records) ? result.data.records : [];

        state.chatHistoryList = records.map((item) => {
            const message = {
                ...item,
                createTime: item.createTime || item.sendTime || ''
            };

            message.isRevoked = isChatMessageRevoked(message);
            return message;
        });

        sortChatHistoryList();
        renderChatHistory();
    } catch (error) {
        console.error('获取聊天记录失败:', error);
        showToast('获取聊天记录失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

function connectChatSocket() {
    const token = getToken();

    if (!token) {
        console.warn('聊天连接失败：没有 token');
        return;
    }

    if (state.chatSocket) {
        if (state.chatSocket.readyState === WebSocket.OPEN) {
            return;
        }

        if (state.chatSocket.readyState === WebSocket.CONNECTING) {
            return;
        }
    }

    const wsUrl = `wss://duck1437.shop/ws/chat?token=${encodeURIComponent(token)}`;


    const socket = new WebSocket(wsUrl);
    state.chatSocket = socket;

    socket.onopen = () => {
        showToast('私聊连接成功');
    };

    socket.onmessage = (event) => {

        try {
            const data = JSON.parse(event.data);
            const message = data.data || data;

            if (Number(message.type) === 0 && message.content) {
                const incomingMsgId = message.chatMsgId || `ws_${Date.now()}`;
                const currentUserId = getCurrentUserId();
                const currentChatUserId = String(state.currentChatUserId || '');

                const senderId = String(message.senderId || '');
                const receiverId = String(message.receiverId || '');

                const isCurrentChatMessage =
                    (
                        senderId === String(currentUserId) &&
                        receiverId === currentChatUserId
                    ) ||
                    (
                        senderId === currentChatUserId &&
                        receiverId === String(currentUserId)
                    );

                if (!isCurrentChatMessage) {
                    return;
                }

                const existed = state.chatHistoryList.some((item) => {
                    return String(item.chatMsgId) === String(incomingMsgId);
                });

                if (!existed) {
                    state.chatHistoryList.push({
                        chatMsgId: incomingMsgId,
                        senderId: message.senderId,
                        receiverId: message.receiverId,
                        content: message.content || '',
                        createTime: message.sendTime || message.createTime || new Date().toLocaleString(),
                        isRevoked: false
                    });

                    sortChatHistoryList();

                    renderChatHistory();
                }

                return;
            }

            if (Number(message.type) === 1 && message.chatMsgId) {
                revokeChatMessageLocally(message.chatMsgId);
                return;
            }

            if (Number(message.type) === 2) {
                showToast(message.content || '聊天异常');
                return;
            }
        } catch (error) {
            console.error('解析聊天消息失败:', error);
        }
    };

    socket.onerror = (error) => {
        console.error('聊天 WebSocket 错误:', error);
    };

    socket.onclose = (event) => {
        console.warn('聊天 WebSocket 已关闭:', event.code, event.reason);

        if (state.chatSocket === socket) {
            state.chatSocket = null;
        }
    };
}

// 渲染聊天头部

function renderChatHeader(userId) {
    const title = document.querySelector('#chat-page-title');
    if (!title) return;

    title.textContent = `与用户 ${userId} 私聊中`;

    fetchPostAuthor(userId).then((user) => {
        if (!user || !title) return;

        const userName = user.userName || user.name || `用户 ${userId}`;
        title.textContent = `与${userName}私聊中`;
    });
}

function createChatSessionAvatar(user, userId) {
    const userName = user?.userName || user?.name || `用户 ${userId}`;
    const userImage = user?.image || user?.avatar || user?.userImage || '';

    if (userImage) {
        return `<img class="chat-session-card__avatar-img" src="${escapeHTML(userImage)}" alt="${escapeHTML(userName)}">`;
    }

    return `<span>${escapeHTML(String(userName).slice(0, 2) || '用户')}</span>`;
}

// 渲染私聊列表

async function renderChatSessionListPage() {
    const list = document.querySelector('#chat-session-list-page');
    if (!list) return;

    const currentUserId = localStorage.getItem('userId');

    if (!currentUserId) {
        list.innerHTML = '<div class="empty-block">用户 id 不存在</div>';
        return;
    }

    loadChatLocalState();

    try {
        toggleGlobalLoading(true);

        const token = getToken();

        const followResponse = await fetch(`${BASE_URL}/follow/getFollowingIds/${currentUserId}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const followResult = await followResponse.json();

        if (followResult.code !== 200) {
            list.innerHTML = '<div class="empty-block">获取私聊列表失败</div>';
            return;
        }

        const ids = Array.isArray(followResult.data) ? followResult.data : [];
        const visibleIds = ids.filter((userId) => !isChatUserDeleted(userId));

        if (!visibleIds.length) {
            list.innerHTML = '<div class="empty-block">暂无可私聊用户，先去关注一些用户吧</div>';
            return;
        }

        const sessionResults = await Promise.all(visibleIds.map(async (userId) => {
            const params = new URLSearchParams({
                senderId: String(currentUserId),
                receiverId: String(userId),
                pageNum: '1',
                pageSize: '1'
            });

            const [historyResult, user] = await Promise.all([
                fetch(`${BASE_URL}/chat/history?${params.toString()}`, {
                    method: 'GET',
                    headers: {
                        Authorization: token
                    }
                }).then((res) => res.json()).catch(() => null),
                fetchPostAuthor(userId).catch(() => null)
            ]);

            const records = Array.isArray(historyResult?.data?.records) ? historyResult.data.records : [];
            const latest = records[0] || null;

            return {
                userId,
                user,
                latest,
                pinned: isChatUserPinned(userId)
            };
        }));

        sessionResults.sort((a, b) => {
            if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;

            const timeA = getChatMessageTimeValue(a.latest || {});
            const timeB = getChatMessageTimeValue(b.latest || {});
            return timeB - timeA;
        });

        list.innerHTML = sessionResults.map((item) => {
            const latestText = item.latest?.content || '点击开始私聊';
            const latestTime = item.latest?.createTime || item.latest?.sendTime || '';
            const pinned = item.pinned;
            const userName = item.user?.userName || item.user?.name || `用户 ${item.userId}`;

            return `
                <article class="chat-session-card ${pinned ? 'is-pinned' : ''}" data-chat-user-id="${item.userId}">
                    <div class="chat-session-card__avatar">${createChatSessionAvatar(item.user, item.userId)}</div>
                    <div class="chat-session-card__body">
                        <div class="chat-session-card__title-row">
                            <h3>${escapeHTML(userName)}</h3>
                            ${pinned ? '<span class="chat-session-pin-badge">置顶</span>' : ''}
                        </div>
                        <p>${escapeHTML(latestText)}</p>
                    </div>
                    <div class="chat-session-card__side">
                        <span class="chat-session-card__time">${escapeHTML(latestTime)}</span>
                        <div class="chat-session-card__actions">
                            <button class="chat-session-pin-btn" type="button" data-chat-user-id="${item.userId}">
                                ${pinned ? '取消置顶' : '置顶'}
                            </button>
                            <button class="chat-session-delete-btn" type="button" data-chat-user-id="${item.userId}">
                                删除
                            </button>
                        </div>
                    </div>
                </article>
            `;
        }).join('');

        bindChatSessionListPageEvents();
    } catch (error) {
        console.error('获取私聊列表失败:', error);
        list.innerHTML = '<div class="empty-block">获取私聊列表失败，请稍后重试</div>';
    } finally {
        toggleGlobalLoading(false);
    }
}

function bindChatSessionListPageEvents() {
    const cards = document.querySelectorAll('#chat-session-list-page .chat-session-card');
    const pinButtons = document.querySelectorAll('#chat-session-list-page .chat-session-pin-btn');
    const deleteButtons = document.querySelectorAll('#chat-session-list-page .chat-session-delete-btn');

    cards.forEach((card) => {
        card.addEventListener('click', () => {
            const userId = card.dataset.chatUserId;
            if (!userId) return;

            goTo(`/chat?userId=${userId}`);
        });
    });

    pinButtons.forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleChatSessionPinned(btn.dataset.chatUserId);
        });
    });

    deleteButtons.forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            deleteChatSessionLocally(btn.dataset.chatUserId);
        });
    });
}

// 渲染聊天记录

function renderChatHistory(shouldScrollToBottom = true) {
    const list = document.querySelector('#chat-message-list');
    if (!list) return;

    if (!state.chatHistoryList.length) {
        list.innerHTML = '<div class="empty-block">还没有聊天记录，快开始聊天吧</div>';
        return;
    }

    const currentUserId = String(localStorage.getItem('userId') || '');

    const html = state.chatHistoryList.map((item, index) => {
        const previous = index > 0 ? state.chatHistoryList[index - 1] : null;
        const isMine = String(item.senderId) === currentUserId;
        const isRevoked = item.isRevoked || isChatMessageRevoked(item);
        const content = isRevoked
            ? (isMine ? '你撤回了一条消息' : '对方撤回了一条消息')
            : (item.content || '');
        const timeDivider = shouldShowChatTimeDivider(item, previous)
            ? `<div class="chat-time-divider">${escapeHTML(formatChatDividerTime(item))}</div>`
            : '';

        return `
            ${timeDivider}
            <div class="chat-bubble-row ${isMine ? 'chat-bubble-row--mine' : 'chat-bubble-row--other'}">
                <div class="chat-bubble-wrap ${isMine ? 'chat-bubble-wrap--mine' : 'chat-bubble-wrap--other'}">
                    <div class="chat-bubble ${isMine ? 'chat-bubble--mine' : 'chat-bubble--other'} ${isRevoked ? 'chat-bubble--revoked' : ''}">
                        <p class="chat-bubble__text">${escapeHTML(content)}</p>
                    </div>
                    ${isMine && !isRevoked
                        ? `<button class="chat-revoke-btn" type="button" data-chat-msg-id="${escapeHTML(item.chatMsgId)}">撤回</button>`
                        : ''
                    }
                </div>
            </div>
        `;
    }).join('');

    list.innerHTML = html;
    bindChatMessageActionEvents();

    if (shouldScrollToBottom) {
        list.scrollTop = list.scrollHeight;
    }
}

function bindChatMessageActionEvents() {
    const revokeButtons = document.querySelectorAll('.chat-revoke-btn');

    revokeButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const messageId = btn.dataset.chatMsgId;
            if (!messageId) return;

            revokeChatMessageLocally(messageId);
        });
    });
}

function bindChatEvents() {
    const sendBtn = document.querySelector('#chat-send-btn');
    const input = document.querySelector('#chat-input');

    if (!sendBtn || !input) return;

    sendBtn.addEventListener('click', () => {
        const content = input.value.trim();
        if (!content) {
            showToast('请输入消息内容');
            return;
        }

        const senderId = localStorage.getItem('userId');
        const receiverId = state.currentChatUserId;

        if (!senderId || !receiverId) {
            showToast('聊天参数不完整');
            return;
        }

        if (!state.chatSocket) {
            showToast('聊天连接未建立');
            console.warn('发送失败：state.chatSocket 不存在');
            return;
        }


        if (state.chatSocket.readyState !== WebSocket.OPEN) {
            showToast('聊天连接未建立，请稍后重试');
            return;
        }

        const messageData = {
            type: 0,
            chatMsgId: Date.now(),
            senderId: Number(senderId),
            receiverId: Number(receiverId),
            content,
            sendTime: formatLocalDateTime()
        };

        state.chatSocket.send(JSON.stringify(messageData));

        state.chatHistoryList.push({
            chatMsgId: messageData.chatMsgId,
            senderId: messageData.senderId,
            receiverId: messageData.receiverId,
            content: messageData.content,
            createTime: messageData.sendTime,
            isRevoked: false
        });

        sortChatHistoryList();
        renderChatHistory();

        input.value = '';
    });
}

// 获取未读消息
