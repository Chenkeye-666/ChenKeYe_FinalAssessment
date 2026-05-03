// 03-comments

function isCommentLiked(comment) {
    return (
        comment?.isLiked === true || comment?.isLiked === 1 || comment?.isLiked === '1' ||
        comment?.isLike === true || comment?.isLike === 1 || comment?.isLike === '1' ||
        comment?.liked === true || comment?.liked === 1 || comment?.liked === '1' ||
        comment?.hasLiked === true || comment?.hasLiked === 1 || comment?.hasLiked === '1'
    );
}

function getCommentId(comment) {
    return comment?.commentId ?? comment?.id ?? comment?.comment_id ?? '';
}

function getCommentLikeCount(comment) {
    const value = comment?.likeCount ?? comment?.likedCount ?? comment?.likeNum ?? comment?.likes ?? 0;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : 0;
}


function getCommentChildCount(comment) {
    const value = comment?.childrenCount ?? comment?.childCount ?? 0;
    const numberValue = Number(value);

    if (Number.isFinite(numberValue) && numberValue > 0) {
        return numberValue;
    }

    const commentId = getCommentId(comment);
    const loadedChildren = state.commentChildMap?.[String(commentId)];

    return Array.isArray(loadedChildren) ? loadedChildren.length : 0;
}

function getCurrentCommentTotalCount() {
    if (!Array.isArray(state.commentList)) return 0;

    return state.commentList.reduce((total, comment) => {
        return total + 1 + getCommentChildCount(comment);
    }, 0);
}

function syncDetailCommentCountFromComments() {
    const total = getCurrentCommentTotalCount();

    if (state.currentPostDetail) {
        state.currentPostDetail.commentCount = total;
    }

    const commentBtn = document.querySelector('#detail-comment-btn');
    if (commentBtn) {
        commentBtn.innerHTML = `${commentIcon()} ${total}`;
    }

    const postId = getCurrentDetailPostId();
    if (postId) {
        updatePostInAllLists(postId, (post) => {
            post.commentCount = total;
        });
    }
}

function updateCommentInState(commentId, updater) {
    const targetId = String(commentId);
    if (!targetId) return;

    const updateOne = (comment) => {
        if (!comment || String(getCommentId(comment)) !== targetId) return false;

        updater(comment);
        return true;
    };

    if (Array.isArray(state.commentList)) {
        for (const comment of state.commentList) {
            if (updateOne(comment)) return;
        }
    }

    Object.values(state.commentChildMap || {}).forEach((childList) => {
        if (!Array.isArray(childList)) return;

        childList.forEach((comment) => {
            updateOne(comment);
        });
    });
}

function restoreCommentDraftToInput(postId) {
    const commentInput = document.querySelector('#detail-comment-input');
    if (!commentInput) return;

    commentInput.value = loadCommentDraft(postId);
}

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

        if (result.code !== 200) {
            showToast(result.msg || '获取评论失败');
            return;
        }

        state.commentList = result.data || [];
        syncDetailCommentCountFromComments();
        renderCommentList();

        preloadCommentUsers(state.commentList).then(() => {
            renderCommentList();
        });
    } catch (error) {
        console.error('获取评论失败:', error);
        showToast('获取评论失败，请稍后重试');
    }
}

async function fetchChildComments(parentId) {
    try {
        const token = getToken();

        const params = new URLSearchParams({
            lastCommentId: '0',
            limit: '5'
        });

        const response = await fetch(`${BASE_URL}/comment/child/${parentId}?${params.toString()}`, {
            method: 'GET',
            headers: {
                Authorization: token
            }
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || '获取回复失败');
            return;
        }

        const childList = Array.isArray(result.data) ? result.data : [];
        state.commentChildMap[String(parentId)] = childList;
        syncDetailCommentCountFromComments();
        renderCommentList();

        preloadCommentUsers(childList).then(() => {
            renderCommentList();
        });
    } catch (error) {
        console.error('获取二级评论失败:', error);
        showToast('获取回复失败，请稍后重试');
    }
}

async function preloadCommentUsers(comments) {
    const userIds = [...new Set(
        comments
            .map((item) => item.userId)
            .filter((userId) => userId !== undefined && userId !== null && userId !== '')
            .map((userId) => String(userId))
    )];

    const missingUserIds = userIds.filter((userId) => !state.postAuthorMap[userId]);

    if (!missingUserIds.length) return;

    await Promise.all(missingUserIds.map((userId) => fetchPostAuthor(userId)));
}

// 渲染评论列表

function renderCommentList() {
    const list = document.querySelector('#comment-list');
    if (!list) return;

    if (!state.commentList.length) {
        list.innerHTML = '<div class="empty-block">暂无评论，快来抢沙发吧</div>';
        return;
    }

    const currentUserId = localStorage.getItem('userId');
    const detailAuthorId = getPostAuthorId(state.currentPostDetail) || state.currentPostDetail?.userId || '';
    const isDetailOwner = Boolean(currentUserId && detailAuthorId && String(currentUserId) === String(detailAuthorId));

    const html = state.commentList.map((item) => {
        const content = item.content || '';
        const createTime = item.createTime || '';
        const userId = item.userId || '';
        const commentId = item.commentId || item.id || '';

        const cachedUser = state.postAuthorMap[String(userId)] || null;
        const userName = item.userName || cachedUser?.userName || `用户 ${userId}`;
        const userAvatar = item.userImage || item.avatar || item.image || cachedUser?.image || '';

        const childCount = Number(item.childrenCount ?? item.childCount ?? 0);
        const childList = state.commentChildMap[String(commentId)] || [];
        const isSelfComment = String(userId) === String(currentUserId);
        const isAuthorComment = detailAuthorId && String(userId) === String(detailAuthorId);
        const canDeleteComment = isSelfComment || isDetailOwner;
        const commentLikeCount = getCommentLikeCount(item);
        const commentIsLiked = isCommentLiked(item);

        return `
            <article class="comment-card" data-comment-id="${commentId}">
                <div class="comment-card__main">
                    <button class="comment-avatar-btn" type="button" data-user-id="${userId}">
                        ${userAvatar
                ? `<img class="comment-avatar-img" src="${userAvatar}" alt="${escapeHTML(userName)}">`
                : ''
            }
                    </button>

                    <div class="comment-card__body">
                        <div class="comment-card__header">
                            <span class="comment-user-line">
                                <strong class="comment-card__user comment-user-btn" data-user-id="${userId}">
                                    ${escapeHTML(userName)}
                                </strong>
                                ${isAuthorComment ? '<span class="comment-author-badge">作者</span>' : ''}
                            </span>

                            <div class="comment-card__header-right">
                                <span class="comment-card__time">${escapeHTML(createTime)}</span>
                                ${canDeleteComment
                ? `<button class="comment-delete-btn" type="button" data-comment-id="${commentId}">删除</button>`
                : ''
            }
                            </div>
                        </div>

                        <div class="comment-card__content">
                            <span class="comment-card__content-text">${escapeHTML(content)}</span>
                            <button
                                class="comment-like-btn comment-inline-like-btn ${commentIsLiked ? 'active' : ''}"
                                type="button"
                                data-comment-id="${commentId}"
                                data-liked="${commentIsLiked ? '1' : '0'}"
                            >
                                ${heartIcon(commentIsLiked)}
                                <span class="comment-like-count">${commentLikeCount}</span>
                            </button>
                        </div>

                        <div class="comment-card__actions">
                            <button
                                class="comment-reply-btn"
                                type="button"
                                data-comment-id="${commentId}"
                                data-user-id="${userId}"
                                data-user-name="${escapeHTML(userName)}"
                            >
                                回复
                            </button>

                            ${childCount > 0
                ? `<button class="comment-toggle-children-btn" type="button" data-comment-id="${commentId}">
                                    ${childList.length ? '收起回复' : `展开回复 (${childCount})`}
                                </button>`
                : ''
            }
                        </div>

                        <div class="comment-children-list">
                            ${childList.map((child) => {
                const childUserId = child.userId || '';
                const cachedChildUser = state.postAuthorMap[String(childUserId)] || null;

                const childUserName = child.userName || cachedChildUser?.userName || `用户 ${childUserId}`;
                const childAvatar = child.userImage || child.avatar || child.image || cachedChildUser?.image || '';

                const replyToUserName = child.replyToUserName || '';
                const childContent = child.content || '';
                const childTime = child.createTime || '';
                const childCommentId = child.commentId || child.id || '';
                const isSelfChildComment = String(childUserId) === String(currentUserId);
                const isAuthorChildComment = detailAuthorId && String(childUserId) === String(detailAuthorId);
                const canDeleteChildComment = isSelfChildComment || isDetailOwner;
                const childLikeCount = getCommentLikeCount(child);
                const childIsLiked = isCommentLiked(child);

                return `
                                    <div class="comment-child-item" data-comment-id="${childCommentId}">
                                        <button class="comment-child-avatar-btn" type="button" data-user-id="${childUserId}">
                                            ${childAvatar
                        ? `<img class="comment-child-avatar-img" src="${childAvatar}" alt="${escapeHTML(childUserName)}">`
                        : ''
                    }
                                        </button>

                                        <div class="comment-child-item__body">
                                            <div class="comment-child-item__header">
                                                <span class="comment-user-line">
                                                    <strong class="comment-user-btn" data-user-id="${childUserId}">
                                                        ${escapeHTML(childUserName)}
                                                    </strong>
                                                    ${isAuthorChildComment ? '<span class="comment-author-badge">作者</span>' : ''}
                                                </span>

                                                <div class="comment-card__header-right">
                                                    <span>${escapeHTML(childTime)}</span>
                                                    ${canDeleteChildComment
                        ? `<button class="comment-child-delete-btn" type="button" data-comment-id="${childCommentId}" data-parent-id="${commentId}">删除</button>`
                        : ''
                    }
                                                </div>
                                            </div>

                                            <div class="comment-child-item__content">
                                                <span class="comment-child-item__content-text">${replyToUserName ? `回复 ${escapeHTML(replyToUserName)}：` : ''}${escapeHTML(childContent)}</span>
                                                <button
                                                    class="comment-like-btn comment-child-like-btn comment-inline-like-btn ${childIsLiked ? 'active' : ''}"
                                                    type="button"
                                                    data-comment-id="${childCommentId}"
                                                    data-liked="${childIsLiked ? '1' : '0'}"
                                                >
                                                    ${heartIcon(childIsLiked)}
                                                    <span class="comment-like-count">${childLikeCount}</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                `;
            }).join('')}
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');

    list.innerHTML = html;
    bindCommentDeleteEvents();
    bindCommentReplyEvents();
    bindCommentToggleChildrenEvents();
    bindChildCommentDeleteEvents();
    bindCommentUserJumpEvents();
    bindCommentLikeEvents();
}

function bindCommentLikeEvents() {
    const buttons = document.querySelectorAll('.comment-like-btn');

    buttons.forEach((btn) => {
        if (btn.dataset.likeBound === '1') return;
        btn.dataset.likeBound = '1';

        btn.addEventListener('click', (event) => {
            event.stopPropagation();

            const commentId = btn.dataset.commentId || '';
            const isLiked = btn.dataset.liked === '1';

            if (!commentId) return;
            handleCommentLikeToggle(commentId, isLiked, btn);
        });
    });
}

async function handleCommentLikeToggle(commentId, isLiked, clickedBtn = null) {
    if (!commentId) {
        showToast('评论 id 不存在');
        return;
    }

    if (clickedBtn) {
        clickedBtn.disabled = true;
    }

    try {
        const token = getToken();
        const url = isLiked
            ? `${BASE_URL}/comment/unlike/${commentId}`
            : `${BASE_URL}/comment/like/${commentId}`;

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

        updateCommentInState(commentId, (comment) => {
            const currentLikeCount = getCommentLikeCount(comment);

            comment.isLiked = nextLiked;
            comment.isLike = nextLiked;
            comment.liked = nextLiked;
            comment.hasLiked = nextLiked;
            comment.likeCount = nextLiked
                ? currentLikeCount + 1
                : Math.max(0, currentLikeCount - 1);
        });

        renderCommentList();
        showToast(nextLiked ? '评论点赞成功' : '已取消评论点赞');
    } catch (error) {
        console.error('评论点赞切换失败:', error);
        showToast('操作失败，请稍后重试');
    } finally {
        if (clickedBtn) {
            clickedBtn.disabled = false;
        }
    }
}

function bindCommentUserJumpEvents() {
    const buttons = document.querySelectorAll('.comment-avatar-btn, .comment-child-avatar-btn, .comment-user-btn');

    buttons.forEach((btn) => {
        btn.addEventListener('click', (event) => {
            event.stopPropagation();

            const userId = btn.dataset.userId;
            if (!userId) return;

            goTo(`/profile?userId=${userId}`);
        });
    });
}

function bindCommentReplyEvents() {
    const buttons = document.querySelectorAll('.comment-reply-btn');
    const input = document.querySelector('#detail-comment-input');

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const commentId = Number(btn.dataset.commentId || 0);
            const userId = Number(btn.dataset.userId || 0);
            const userName = btn.dataset.userName || '';

            state.currentReplyParentId = commentId;
            state.currentReplyToUserId = userId;
            state.currentReplyToUserName = userName;

            if (input) {
                input.placeholder = userName
                    ? `回复 ${userName}...`
                    : '回复这条评论...';
                input.focus();
            }
        });
    });
}

function bindCommentToggleChildrenEvents() {
    const buttons = document.querySelectorAll('.comment-toggle-children-btn');

    buttons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const commentId = btn.dataset.commentId || '';
            if (!commentId) return;

            const cached = state.commentChildMap[String(commentId)];

            if (Array.isArray(cached) && cached.length) {
                delete state.commentChildMap[String(commentId)];
                syncDetailCommentCountFromComments();
                renderCommentList();
                return;
            }

            fetchChildComments(commentId);
        });
    });
}

function resetReplyState() {
    const input = document.querySelector('#detail-comment-input');

    state.currentReplyParentId = 0;
    state.currentReplyToUserId = 0;
    state.currentReplyToUserName = '';

    if (input) {
        input.placeholder = '写下你的评论...';
    }
}

// 绑定评论输入提交

function bindDetailCommentEvents() {
    const sendBtn = document.querySelector('#detail-comment-send-btn');
    const commentInput = document.querySelector('#detail-comment-input');

    if (sendBtn) {
        sendBtn.addEventListener('click', () => {
            handleCommentSubmit();
        });
    }

    if (commentInput) {
        commentInput.addEventListener('input', () => {
            const postId = getCurrentDetailPostId();
            saveCommentDraft(postId, commentInput.value);
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
        parentId: Number(state.currentReplyParentId || 0),
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

        if (result.code !== 200) {
            showToast(result.msg || '评论失败');
            return;
        }

        state.currentReplyParentId = 0;
        state.currentReplyToUserId = 0;
        state.currentReplyToUserName = '';

        if (input) {
            input.value = '';
            input.placeholder = '写下你的评论...';
        }

        clearCommentDraft(postId);

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

async function deleteCommentById(commentId) {
    const token = getToken();

    const response = await fetch(`${BASE_URL}/comment/delete/${commentId}`, {
        method: 'POST',
        headers: {
            Authorization: token
        }
    });

    return response.json();
}


let pendingDeleteCommentInfo = null;

function ensureCommentDeleteConfirmDialog() {
    let dialog = document.querySelector('#comment-delete-confirm');

    if (dialog) return dialog;

    dialog = document.createElement('div');
    dialog.id = 'comment-delete-confirm';
    dialog.className = 'confirm-dialog hidden';
    dialog.innerHTML = `
        <div id="comment-delete-confirm-mask" class="confirm-dialog__mask"></div>

        <div class="confirm-dialog__panel">
            <h3 class="confirm-dialog__title">删除评论</h3>
            <p class="confirm-dialog__text">确定要删除这条评论吗？删除后不可恢复。</p>

            <div class="confirm-dialog__actions">
                <button id="comment-delete-cancel-btn" class="confirm-dialog__btn" type="button">
                    取消
                </button>
                <button id="comment-delete-confirm-btn" class="confirm-dialog__btn confirm-dialog__btn--danger" type="button">
                    删除
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(dialog);

    const close = () => closeCommentDeleteConfirmDialog();

    dialog.querySelector('#comment-delete-confirm-mask')?.addEventListener('click', close);
    dialog.querySelector('#comment-delete-cancel-btn')?.addEventListener('click', close);
    dialog.querySelector('#comment-delete-confirm-btn')?.addEventListener('click', handleConfirmDeleteComment);

    return dialog;
}

function openCommentDeleteConfirmDialog(commentId, parentId = '') {
    if (!commentId) return;

    pendingDeleteCommentInfo = {
        commentId: String(commentId),
        parentId: parentId ? String(parentId) : ''
    };

    const dialog = ensureCommentDeleteConfirmDialog();
    dialog.classList.remove('hidden');
}

function closeCommentDeleteConfirmDialog() {
    const dialog = document.querySelector('#comment-delete-confirm');
    if (dialog) {
        dialog.classList.add('hidden');
    }

    pendingDeleteCommentInfo = null;
}

async function handleConfirmDeleteComment() {
    const info = pendingDeleteCommentInfo;
    if (!info?.commentId) return;

    try {
        toggleGlobalLoading(true);

        const result = await deleteCommentById(info.commentId);

        if (result.code !== 200) {
            showToast(result.msg || '删除失败');
            return;
        }

        closeCommentDeleteConfirmDialog();
        showToast('删除成功');

        const query = getRouteQuery();
        const postId = query.get('id');
        if (!postId) return;

        if (info.parentId) {
            await fetchCommentList(postId);
            await fetchChildComments(info.parentId);
            return;
        }

        state.commentChildMap = {};
        await fetchCommentList(postId);
    } catch (error) {
        console.error('删除评论失败:', error);
        showToast('删除失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 绑定删除一级评论按钮事件

function bindCommentDeleteEvents() {
    const buttons = document.querySelectorAll('.comment-delete-btn');

    buttons.forEach((btn) => {
        if (btn.dataset.deleteBound === '1') return;
        btn.dataset.deleteBound = '1';

        btn.addEventListener('click', (event) => {
            event.stopPropagation();

            const commentId = btn.dataset.commentId;
            if (!commentId) return;

            openCommentDeleteConfirmDialog(commentId);
        });
    });
}

// 绑定删除二级评论按钮事件

function bindChildCommentDeleteEvents() {
    const buttons = document.querySelectorAll('.comment-child-delete-btn');

    buttons.forEach((btn) => {
        if (btn.dataset.deleteBound === '1') return;
        btn.dataset.deleteBound = '1';

        btn.addEventListener('click', (event) => {
            event.stopPropagation();

            const commentId = btn.dataset.commentId;
            const parentId = btn.dataset.parentId;
            if (!commentId) return;

            openCommentDeleteConfirmDialog(commentId, parentId);
        });
    });
}

// 渲染帖子列表
