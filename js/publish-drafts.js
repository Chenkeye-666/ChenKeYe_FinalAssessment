// 06-publish-drafts

function getPublishAutoDraftKey() {
    return `${PUBLISH_AUTOSAVE_KEY_PREFIX}${getCurrentUserId() || 'guest'}`;
}

function getPublishFormData() {
    const titleInput = document.querySelector('#publish-title');
    const contentInput = document.querySelector('#publish-content');
    const topicInput = document.querySelector('#publish-topic');
    const locationInput = document.querySelector('#publish-location');
    const permissionSelect = document.querySelector('#publish-permission');

    return {
        title: titleInput?.value || '',
        content: contentInput?.value || '',
        topic: topicInput?.value || '',
        location: locationInput?.value || '',
        permission: permissionSelect?.value || 'public',
        images: Array.isArray(state.publishImageUrls) ? [...state.publishImageUrls] : [],
        updateTime: Date.now()
    };
}

function hasPublishAutoDraftData(draft) {
    if (!draft || typeof draft !== 'object') return false;

    return Boolean(
        String(draft.title || '').trim() ||
        String(draft.content || '').trim() ||
        String(draft.topic || '').trim() ||
        String(draft.location || '').trim() ||
        (Array.isArray(draft.images) && draft.images.length)
    );
}

function isPublishAutoSaveEnabled() {
    const query = getRouteQuery();
    const editingPostId = query.get('postId') || state.currentEditingPostId || '';
    const editingDraftId = query.get('draftId') || state.currentDraftId || '';

    return state.currentRoute === '/publish' && !editingPostId && !editingDraftId;
}

function savePublishAutoDraft() {
    if (!isPublishAutoSaveEnabled()) return;

    const draft = getPublishFormData();
    const key = getPublishAutoDraftKey();

    if (!hasPublishAutoDraftData(draft)) {
        localStorage.removeItem(key);
        return;
    }

    localStorage.setItem(key, JSON.stringify(draft));
}

function loadPublishAutoDraft() {
    try {
        const raw = localStorage.getItem(getPublishAutoDraftKey());
        return raw ? JSON.parse(raw) : null;
    } catch (error) {
        return null;
    }
}

function clearPublishAutoDraft() {
    localStorage.removeItem(getPublishAutoDraftKey());
}

function restorePublishAutoDraftToForm() {
    if (!isPublishAutoSaveEnabled()) return;

    const draft = loadPublishAutoDraft();
    if (!hasPublishAutoDraftData(draft)) return;

    const titleInput = document.querySelector('#publish-title');
    const contentInput = document.querySelector('#publish-content');
    const topicInput = document.querySelector('#publish-topic');
    const locationInput = document.querySelector('#publish-location');
    const permissionSelect = document.querySelector('#publish-permission');

    if (titleInput) titleInput.value = draft.title || '';
    if (contentInput) contentInput.value = draft.content || '';
    if (topicInput) topicInput.value = draft.topic || '';
    if (locationInput) locationInput.value = draft.location || '';
    if (permissionSelect) permissionSelect.value = draft.permission || 'public';

    state.publishImageUrls = Array.isArray(draft.images) ? draft.images : [];
    renderPublishImageList();
}

function bindPublishAutoSaveEvents() {
    const fields = [
        '#publish-title',
        '#publish-content',
        '#publish-topic',
        '#publish-location',
        '#publish-permission'
    ];

    fields.forEach((selector) => {
        const field = document.querySelector(selector);
        if (!field || field.dataset.publishAutosaveBound === '1') return;

        field.dataset.publishAutosaveBound = '1';
        field.addEventListener('input', savePublishAutoDraft);
        field.addEventListener('change', savePublishAutoDraft);
    });
}

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
            if (state.publishImageUrls.length >= 9) {
                showToast('最多只能上传 9 张图片');
                return;
            }

            publishImageInput.click();
        });
    }

    if (publishImageInput) {
        publishImageInput.addEventListener('change', handlePublishImageChange);
    }

    bindPublishTopicSuggestEvents();
    bindPublishAutoSaveEvents();
}

function normalizePublishTopic(topic) {
    return String(topic || '').trim().replace(/^#+/, '').trim();
}

function getPublishTopicCandidates(keyword = '') {
    const keywordText = normalizePublishTopic(keyword).toLowerCase();
    const topicSet = new Set();

    const pushTopic = (topic) => {
        const text = normalizePublishTopic(topic);
        if (!text) return;
        topicSet.add(text);
    };

    PUBLISH_DEFAULT_TOPICS.forEach(pushTopic);

    const postLists = [
        state.recommendPosts,
        state.followPosts,
        state.profilePosts,
        state.profileLikedPosts,
        state.profileFavoritedPosts,
        state.topicPostList
    ];

    postLists.forEach((list) => {
        if (!Array.isArray(list)) return;
        list.forEach((post) => pushTopic(post?.topic));
    });

    if (Array.isArray(state.searchRecommendList)) {
        state.searchRecommendList.forEach(pushTopic);
    }

    try {
        const draftList = JSON.parse(localStorage.getItem('draftList') || '[]');
        if (Array.isArray(draftList)) {
            draftList.forEach((draft) => pushTopic(draft?.topic));
        }
    } catch (error) {
        // 本地草稿解析失败时忽略，不影响发布功能
    }

    const candidates = Array.from(topicSet);

    if (!keywordText) {
        return candidates.slice(0, 10);
    }

    const matched = candidates.filter((topic) => topic.toLowerCase().includes(keywordText));

    if (!matched.some((topic) => topic.toLowerCase() === keywordText)) {
        matched.unshift(normalizePublishTopic(keyword));
    }

    return matched.slice(0, 10);
}

function ensurePublishTopicSuggestPanel() {
    let panel = document.querySelector('#publish-topic-suggest-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'publish-topic-suggest-panel';
    panel.className = 'publish-topic-suggest-panel hidden';

    const topicInput = document.querySelector('#publish-topic');
    const topicFormItem = topicInput?.closest('.form-item');

    if (topicFormItem) {
        topicFormItem.appendChild(panel);
    }

    return panel;
}

function hidePublishTopicSuggestPanel() {
    const panel = document.querySelector('#publish-topic-suggest-panel');
    if (panel) panel.classList.add('hidden');
}

function renderPublishTopicSuggestPanel(keyword = '', mode = 'topic') {
    const panel = ensurePublishTopicSuggestPanel();
    if (!panel) return;

    const topics = getPublishTopicCandidates(keyword);

    if (!topics.length) {
        panel.classList.add('hidden');
        return;
    }

    panel.dataset.mode = mode;
    panel.innerHTML = topics.map((topic) => {
        return `
            <button class="publish-topic-suggest-item" type="button" data-topic="${escapeHTML(topic)}">
                #${escapeHTML(topic)}
            </button>
        `;
    }).join('');

    panel.classList.remove('hidden');

    panel.querySelectorAll('.publish-topic-suggest-item').forEach((btn) => {
        btn.addEventListener('click', () => {
            const topic = btn.dataset.topic || '';
            if (!topic) return;
            applyPublishTopic(topic, panel.dataset.mode || 'topic');
        });
    });
}

function getContentHashKeyword(textarea) {
    if (!textarea) return null;

    const cursor = textarea.selectionStart ?? textarea.value.length;
    const beforeCursor = textarea.value.slice(0, cursor);
    const match = beforeCursor.match(/#([\u4e00-\u9fa5\w-]*)$/);

    return match ? match[1] : null;
}

function replaceCurrentHashTopic(textarea, topic) {
    if (!textarea) return;

    const cursor = textarea.selectionStart ?? textarea.value.length;
    const beforeCursor = textarea.value.slice(0, cursor);
    const afterCursor = textarea.value.slice(cursor);
    const match = beforeCursor.match(/#([\u4e00-\u9fa5\w-]*)$/);
    const insertText = `#${topic} `;

    if (!match) {
        const prefix = beforeCursor && !/\s$/.test(beforeCursor) ? ' ' : '';
        textarea.value = `${beforeCursor}${prefix}${insertText}${afterCursor}`;
        const nextCursor = beforeCursor.length + prefix.length + insertText.length;
        textarea.setSelectionRange(nextCursor, nextCursor);
        return;
    }

    const start = beforeCursor.length - match[0].length;
    textarea.value = `${beforeCursor.slice(0, start)}${insertText}${afterCursor}`;
    const nextCursor = start + insertText.length;
    textarea.setSelectionRange(nextCursor, nextCursor);
}

function applyPublishTopic(topic, mode = 'topic') {
    const safeTopic = normalizePublishTopic(topic);
    if (!safeTopic) return;

    const topicInput = document.querySelector('#publish-topic');
    const contentInput = document.querySelector('#publish-content');

    if (topicInput) {
        topicInput.value = safeTopic;
        topicInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    if (mode === 'content-topic' && contentInput) {
        replaceCurrentTriggerText(contentInput, '#', safeTopic);
        contentInput.dispatchEvent(new Event('input', { bubbles: true }));
        contentInput.focus();
    } else if (topicInput) {
        topicInput.focus();
    }

    savePublishAutoDraft();
    hidePublishTopicSuggestPanel();
    hidePublishContentSuggestPanel();
}

function getPublishContentTrigger(textarea) {
    if (!textarea) return null;

    const cursor = textarea.selectionStart ?? textarea.value.length;
    const beforeCursor = textarea.value.slice(0, cursor);
    const hashMatch = beforeCursor.match(/#([\u4e00-\u9fa5\w-]*)$/);
    const atMatch = beforeCursor.match(/@([\u4e00-\u9fa5\w-]*)$/);

    if (hashMatch) {
        return {
            type: 'topic',
            marker: '#',
            keyword: hashMatch[1] || ''
        };
    }

    if (atMatch) {
        return {
            type: 'friend',
            marker: '@',
            keyword: atMatch[1] || ''
        };
    }

    return null;
}

function replaceCurrentTriggerText(textarea, marker, value) {
    if (!textarea || !marker || !value) return;

    const cursor = textarea.selectionStart ?? textarea.value.length;
    const beforeCursor = textarea.value.slice(0, cursor);
    const afterCursor = textarea.value.slice(cursor);
    const escapedMarker = marker === '#' ? '#' : '@';
    const reg = new RegExp(`${escapedMarker}([\\u4e00-\\u9fa5\\w-]*)$`);
    const match = beforeCursor.match(reg);
    const insertText = `${marker}${value} `;

    if (!match) {
        const prefix = beforeCursor && !/\s$/.test(beforeCursor) ? ' ' : '';
        textarea.value = `${beforeCursor}${prefix}${insertText}${afterCursor}`;
        const nextCursor = beforeCursor.length + prefix.length + insertText.length;
        textarea.setSelectionRange(nextCursor, nextCursor);
        return;
    }

    const start = beforeCursor.length - match[0].length;
    textarea.value = `${beforeCursor.slice(0, start)}${insertText}${afterCursor}`;
    const nextCursor = start + insertText.length;
    textarea.setSelectionRange(nextCursor, nextCursor);
}

function ensurePublishContentSuggestPanel() {
    let panel = document.querySelector('#publish-content-suggest-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'publish-content-suggest-panel';
    panel.className = 'publish-topic-suggest-panel hidden';

    const contentInput = document.querySelector('#publish-content');
    const contentFormItem = contentInput?.closest('.form-item');

    if (contentFormItem) {
        contentFormItem.appendChild(panel);
    }

    return panel;
}

function hidePublishContentSuggestPanel() {
    const panel = document.querySelector('#publish-content-suggest-panel');
    if (panel) panel.classList.add('hidden');
}

function renderPublishContentTopicSuggestPanel(keyword = '') {
    const panel = ensurePublishContentSuggestPanel();
    if (!panel) return;

    const topics = getPublishTopicCandidates(keyword);

    if (!topics.length) {
        panel.classList.add('hidden');
        return;
    }

    panel.dataset.mode = 'content-topic';
    panel.dataset.type = 'topic';
    panel.innerHTML = topics.map((topic) => {
        return `
            <button class="publish-topic-suggest-item publish-content-topic-item" type="button" data-topic="${escapeHTML(topic)}">
                #${escapeHTML(topic)}
            </button>
        `;
    }).join('');

    panel.classList.remove('hidden');

    panel.querySelectorAll('.publish-content-topic-item').forEach((btn) => {
        btn.addEventListener('click', () => {
            const topic = btn.dataset.topic || '';
            if (!topic) return;
            applyPublishTopic(topic, 'content-topic');
        });
    });
}

async function fetchPublishFriendCandidates(keyword = '') {
    const keywordText = String(keyword || '').trim().toLowerCase();
    const currentUserId = getCurrentUserId();
    const idSet = new Set();

    const pushId = (id) => {
        if (!id) return;
        if (String(id) === String(currentUserId)) return;
        idSet.add(String(id));
    };

    [state.homeFollowingIds, state.profileFollowingIds, state.profileFollowerIds].forEach((list) => {
        if (!Array.isArray(list)) return;
        list.forEach(pushId);
    });

    if (!idSet.size && currentUserId) {
        try {
            const token = getToken();
            const response = await fetch(`${BASE_URL}/follow/getFollowingIds/${currentUserId}`, {
                method: 'GET',
                headers: {
                    Authorization: token
                }
            });
            const result = await response.json();

            if (result.code === 200 && Array.isArray(result.data)) {
                result.data.forEach(pushId);
            }
        } catch (error) {
            console.error('获取发布页好友列表失败:', error);
        }
    }

    const userList = await Promise.all(
        Array.from(idSet).slice(0, 30).map(async (userId) => {
            const user = await fetchPostAuthor(userId);
            return {
                userId,
                userName: user?.userName || `用户 ${userId}`,
                avatar: user?.image || ''
            };
        })
    );

    return userList
        .filter((user) => {
            if (!keywordText) return true;
            return String(user.userName || '').toLowerCase().includes(keywordText) || String(user.userId).includes(keywordText);
        })
        .slice(0, 10);
}

async function renderPublishFriendSuggestPanel(keyword = '') {
    const panel = ensurePublishContentSuggestPanel();
    if (!panel) return;

    panel.dataset.mode = 'content-friend';
    panel.dataset.type = 'friend';
    panel.innerHTML = '<div class="publish-suggest-empty">加载好友中...</div>';
    panel.classList.remove('hidden');

    const friends = await fetchPublishFriendCandidates(keyword);

    if (panel.dataset.type !== 'friend') return;

    if (!friends.length) {
        panel.innerHTML = '<div class="publish-suggest-empty">暂无可 @ 的好友</div>';
        return;
    }

    panel.innerHTML = friends.map((friend) => {
        return `
            <button class="publish-topic-suggest-item publish-friend-suggest-item" type="button" data-user-name="${escapeHTML(friend.userName)}" data-user-id="${escapeHTML(friend.userId)}">
                @${escapeHTML(friend.userName)}
            </button>
        `;
    }).join('');

    panel.querySelectorAll('.publish-friend-suggest-item').forEach((btn) => {
        btn.addEventListener('click', () => {
            const userName = btn.dataset.userName || '';
            const contentInput = document.querySelector('#publish-content');
            if (!userName || !contentInput) return;

            replaceCurrentTriggerText(contentInput, '@', userName);
            contentInput.dispatchEvent(new Event('input', { bubbles: true }));
            contentInput.focus();
            savePublishAutoDraft();
            hidePublishContentSuggestPanel();
        });
    });
}

function bindPublishTopicSuggestEvents() {
    const topicInput = document.querySelector('#publish-topic');
    const contentInput = document.querySelector('#publish-content');
    const insertTopicBtn = document.querySelector('#insert-topic-btn');
    const insertAtBtn = document.querySelector('#insert-at-btn');

    if (topicInput && topicInput.dataset.topicSuggestBound !== '1') {
        topicInput.dataset.topicSuggestBound = '1';

        topicInput.addEventListener('focus', () => {
            renderPublishTopicSuggestPanel(topicInput.value, 'topic');
        });

        topicInput.addEventListener('input', () => {
            renderPublishTopicSuggestPanel(topicInput.value, 'topic');
        });
    }

    if (contentInput && contentInput.dataset.contentSuggestBound !== '1') {
        contentInput.dataset.contentSuggestBound = '1';

        const handleContentSuggest = () => {
            const trigger = getPublishContentTrigger(contentInput);

            if (!trigger) {
                hidePublishContentSuggestPanel();
                return;
            }

            if (trigger.type === 'topic') {
                renderPublishContentTopicSuggestPanel(trigger.keyword);
                return;
            }

            if (trigger.type === 'friend') {
                renderPublishFriendSuggestPanel(trigger.keyword);
            }
        };

        contentInput.addEventListener('input', handleContentSuggest);
        contentInput.addEventListener('keyup', handleContentSuggest);
        contentInput.addEventListener('click', handleContentSuggest);
    }

    if (insertTopicBtn && insertTopicBtn.dataset.topicSuggestBound !== '1') {
        insertTopicBtn.dataset.topicSuggestBound = '1';
        insertTopicBtn.addEventListener('click', () => {
            if (contentInput) {
                contentInput.focus();
            }
            renderPublishContentTopicSuggestPanel('');
        });
    }

    if (insertAtBtn && insertAtBtn.dataset.friendSuggestBound !== '1') {
        insertAtBtn.dataset.friendSuggestBound = '1';
        insertAtBtn.addEventListener('click', () => {
            if (contentInput) {
                contentInput.focus();
            }
            renderPublishFriendSuggestPanel('');
        });
    }

    if (document.body.dataset.publishTopicOutsideBound !== '1') {
        document.body.dataset.publishTopicOutsideBound = '1';
        document.addEventListener('click', (event) => {
            const topicPanel = document.querySelector('#publish-topic-suggest-panel');
            const contentPanel = document.querySelector('#publish-content-suggest-panel');

            const isInsideTopicPanel = topicPanel && topicPanel.contains(event.target);
            const isInsideContentPanel = contentPanel && contentPanel.contains(event.target);
            const isTopicInput = event.target === topicInput;
            const isContentInput = event.target === contentInput;
            const isInsertTopicBtn = event.target === insertTopicBtn;
            const isInsertAtBtn = event.target === insertAtBtn;

            if (!isInsideTopicPanel && !isTopicInput && !isInsertTopicBtn) {
                hidePublishTopicSuggestPanel();
            }

            if (!isInsideContentPanel && !isContentInput && !isInsertTopicBtn && !isInsertAtBtn) {
                hidePublishContentSuggestPanel();
            }
        });
    }
}

// 发布提交

async function handlePublishSubmit(event) {
    event.preventDefault();

    const titleInput = document.querySelector('#publish-title');
    const contentInput = document.querySelector('#publish-content');
    const topicInput = document.querySelector('#publish-topic');
    const locationInput = document.querySelector('#publish-location');
    const permissionSelect = document.querySelector('#publish-permission');

    const title = titleInput?.value.trim() || '';
    const content = contentInput?.value.trim() || '';
    const topic = topicInput?.value.trim() || '';
    const location = locationInput?.value.trim() || '';
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
        friends: 2,
        private: 3
    };

    const requestBody = {
        title,
        content,
        images: state.publishImageUrls.join(','),
        topic,
        location,
        permission: permissionMap[permissionValue] || 1
    };

    const isEditMode = Boolean(state.currentEditingPostId);
    const requestUrl = isEditMode
        ? `${BASE_URL}/post/update/${state.currentEditingPostId}`
        : `${BASE_URL}/post`;

    try {
        toggleGlobalLoading(true);

        const token = getToken();

        const response = await fetch(requestUrl, {
            method: 'POST',
            headers: {
                Authorization: token,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        const result = await response.json();

        if (result.code !== 200) {
            showToast(result.msg || (isEditMode ? '更新失败' : '发布失败'));
            return;
        }

        clearPublishAutoDraft();
        clearDraftPost();
        resetPublishForm();
        state.currentEditingPostId = '';

        state.homeHasLoaded = false;
        state.homeScrollTop = 0;

        showToast(isEditMode ? '更新成功' : '发布成功');
        goTo('/home');
    } catch (error) {
        console.error(isEditMode ? '更新失败:' : '发布失败:', error);
        showToast(isEditMode ? '更新失败，请稍后重试' : '发布失败，请稍后重试');
    } finally {
        toggleGlobalLoading(false);
    }
}

// 存草稿

function saveDraftPost() {
    const titleInput = document.querySelector('#publish-title');
    const contentInput = document.querySelector('#publish-content');
    const topicInput = document.querySelector('#publish-topic');
    const locationInput = document.querySelector('#publish-location');
    const permissionSelect = document.querySelector('#publish-permission');

    const title = titleInput?.value.trim() || '';
    const content = contentInput?.value.trim() || '';
    const topic = topicInput?.value.trim() || '';
    const location = locationInput?.value.trim() || '';
    const permission = permissionSelect?.value || 'public';

    const draftList = JSON.parse(localStorage.getItem('draftList') || '[]');
    const safeDraftList = Array.isArray(draftList) ? draftList : [];

    const draftId = state.currentDraftId || `draft_${Date.now()}`;

    const draftItem = {
        id: draftId,
        title,
        content,
        topic,
        location,
        permission,
        images: [...state.publishImageUrls],
        updateTime: new Date().toISOString()
    };

    const existIndex = safeDraftList.findIndex((item) => item.id === draftId);

    if (existIndex > -1) {
        safeDraftList[existIndex] = draftItem;
    } else {
        safeDraftList.unshift(draftItem);
    }

    localStorage.setItem('draftList', JSON.stringify(safeDraftList));
    state.draftList = safeDraftList;
    state.currentDraftId = draftId;
    clearPublishAutoDraft();

    showToast('草稿已保存');
}

// 读取草稿到发布页

function renderDraftToPublishForm() {
    const query = getRouteQuery();
    const draftId = query.get('draftId') || '';

    const draftList = JSON.parse(localStorage.getItem('draftList') || '[]');
    const safeDraftList = Array.isArray(draftList) ? draftList : [];

    state.draftList = safeDraftList;
    state.currentDraftId = draftId;

    const pageTitle = document.querySelector('#publish-page-title');
    const titleInput = document.querySelector('#publish-title');
    const contentInput = document.querySelector('#publish-content');
    const topicInput = document.querySelector('#publish-topic');
    const locationInput = document.querySelector('#publish-location');
    const permissionSelect = document.querySelector('#publish-permission');

    if (pageTitle) pageTitle.textContent = draftId ? '编辑草稿' : '发布帖子';

    if (!draftId) {
        if (titleInput) titleInput.value = '';
        if (contentInput) contentInput.value = '';
        if (topicInput) topicInput.value = '';
        if (locationInput) locationInput.value = '';
        if (permissionSelect) permissionSelect.value = 'public';

        state.publishImageUrls = [];
        state.currentDraftId = '';
        renderPublishImageList();
        restorePublishAutoDraftToForm();
        return;
    }

    const currentDraft = safeDraftList.find((item) => item.id === draftId);

    if (!currentDraft) {
        if (titleInput) titleInput.value = '';
        if (contentInput) contentInput.value = '';
        if (topicInput) topicInput.value = '';
        if (locationInput) locationInput.value = '';
        if (permissionSelect) permissionSelect.value = 'public';

        state.publishImageUrls = [];
        state.currentDraftId = '';
        renderPublishImageList();
        return;
    }

    if (titleInput) titleInput.value = currentDraft.title || '';
    if (contentInput) contentInput.value = currentDraft.content || '';
    if (topicInput) topicInput.value = currentDraft.topic || '';
    if (locationInput) locationInput.value = currentDraft.location || '';
    if (permissionSelect) permissionSelect.value = currentDraft.permission || 'public';

    state.publishImageUrls = Array.isArray(currentDraft.images) ? currentDraft.images : [];
    renderPublishImageList();
}

// 读取已发布帖子到发布页

function renderPostToPublishForm() {
    const post = state.currentPostDetail;
    if (!post) return;

    const pageTitle = document.querySelector('#publish-page-title');
    const titleInput = document.querySelector('#publish-title');
    const contentInput = document.querySelector('#publish-content');
    const topicInput = document.querySelector('#publish-topic');
    const locationInput = document.querySelector('#publish-location');
    const permissionSelect = document.querySelector('#publish-permission');

    if (pageTitle) pageTitle.textContent = '编辑帖子';
    if (titleInput) titleInput.value = post.title || '';
    if (contentInput) contentInput.value = post.content || '';
    if (topicInput) topicInput.value = post.topic || '';
    if (locationInput) locationInput.value = post.location || '';
    if (permissionSelect) {
        const permission = normalizePostPermission(post);
        permissionSelect.value = permission;
    }

    state.publishImageUrls = post.images
        ? String(post.images).split(',').map((item) => item.trim()).filter(Boolean)
        : [];

    renderPublishImageList();
}

// 清空草稿

function clearDraftPost() {
    if (!state.currentDraftId) return;

    const draftList = JSON.parse(localStorage.getItem('draftList') || '[]');
    const safeDraftList = Array.isArray(draftList) ? draftList : [];

    const nextDraftList = safeDraftList.filter((item) => item.id !== state.currentDraftId);

    localStorage.setItem('draftList', JSON.stringify(nextDraftList));
    state.draftList = nextDraftList;
    state.currentDraftId = '';
}

// 清空还原发布页

function resetPublishForm() {
    const titleInput = document.querySelector('#publish-title');
    const contentInput = document.querySelector('#publish-content');
    const topicInput = document.querySelector('#publish-topic');
    const locationInput = document.querySelector('#publish-location');
    const permissionSelect = document.querySelector('#publish-permission');
    const publishImageInput = document.querySelector('#publish-image-input');

    if (titleInput) titleInput.value = '';
    if (contentInput) contentInput.value = '';
    if (topicInput) topicInput.value = '';
    if (locationInput) locationInput.value = '';
    if (permissionSelect) permissionSelect.value = 'public';
    if (publishImageInput) publishImageInput.value = '';

    state.publishImageUrls = [];
    state.currentDraftId = '';
    renderPublishImageList();
}

// 加载草稿列表

function loadDraftList() {
    const draftList = JSON.parse(localStorage.getItem('draftList') || '[]');
    state.draftList = Array.isArray(draftList) ? draftList : [];
    renderDraftList();
}

// 渲染草稿列表

function renderDraftList() {
    const list = document.querySelector('#draft-list');
    if (!list) return;

    if (!state.draftList.length) {
        list.innerHTML = '<div class="empty-block">草稿箱还是空的</div>';
        return;
    }

    const html = state.draftList.map((item) => {
        const title = item.title || '未命名草稿';
        const content = item.content || '';
        const updateTime = item.updateTime || '';

        return `
            <article class="draft-card" data-draft-id="${item.id}">
                <div class="draft-card__body">
                    <h3 class="draft-card__title">${escapeHTML(title)}</h3>
                    <p class="draft-card__content">${escapeHTML(content)}</p>
                    <p class="draft-card__time">${escapeHTML(updateTime)}</p>
                </div>
                <div class="draft-card__actions">
                    <button class="draft-open-btn" type="button" data-draft-id="${item.id}">继续编辑</button>
                    <button class="draft-delete-btn" type="button" data-draft-id="${item.id}">删除</button>
                </div>
            </article>
        `;
    }).join('');

    list.innerHTML = html;
    bindDraftItemEvents();
}

// 绑定草稿操作事件

function bindDraftItemEvents() {
    const openButtons = document.querySelectorAll('.draft-open-btn');
    const deleteButtons = document.querySelectorAll('.draft-delete-btn');

    openButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const draftId = btn.dataset.draftId;
            if (!draftId) return;

            openDraftForEdit(draftId);
        });
    });

    deleteButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
            const draftId = btn.dataset.draftId;
            if (!draftId) return;

            deleteDraftItem(draftId);
        });
    });
}

// 继续编辑/删除草稿

function openDraftForEdit(draftId) {
    goTo(`/publish?draftId=${encodeURIComponent(draftId)}`);
}

function deleteDraftItem(draftId) {
    const nextDraftList = state.draftList.filter((item) => item.id !== draftId);

    localStorage.setItem('draftList', JSON.stringify(nextDraftList));
    state.draftList = nextDraftList;

    if (state.currentDraftId === draftId) {
        state.currentDraftId = '';
    }

    showToast('草稿已删除');
    renderDraftList();
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

    if (files.length > remainCount) {
        showToast(`最多还能上传 ${remainCount} 张图片，已自动保留前 ${remainCount} 张`);
    }

    const selectedFiles = files.slice(0, remainCount);
    let successCount = 0;

    for (const file of selectedFiles) {
        if (!file.type.startsWith('image/')) {
            showToast(`${file.name} 不是图片文件`);
            continue;
        }

        const maxSize = 3 * 1024 * 1024;

        if (file.size > maxSize) {
            showToast(`图片 ${file.name} 超过 3MB，无法上传`);
            continue;
        }

        const imageUrl = await uploadPublishImage(file);
        if (imageUrl) {
            state.publishImageUrls.push(imageUrl);
            successCount += 1;
            renderPublishImageList();
        }
    }

    if (successCount) {
        showToast(`已上传 ${successCount} 张图片`);
    }

    renderPublishImageList();
    savePublishAutoDraft();
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
        list.innerHTML = '<div class="empty-block">暂未选择图片，最多可上传 9 张</div>';
        return;
    }

    const html = state.publishImageUrls.map((url, index) => {
        return `
            <div class="publish-image-card">
                <img class="publish-image-card__img" src="${url}" alt="已上传图片 ${index + 1}">
                <span class="publish-image-card__index">${index + 1}</span>
                <button class="publish-image-card__delete" type="button" data-image-index="${index}">删除</button>
            </div>
        `;
    }).join('');

    list.innerHTML = `${html}<div class="publish-image-count">已上传 ${state.publishImageUrls.length}/9 张</div>`;
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
            savePublishAutoDraft();
        });
    });
}

// 获取评论列表
