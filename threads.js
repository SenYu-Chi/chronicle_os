/**
 * Threads, messages, tags management for Chronicle OS v1.5
 * Depends on: state.js, utils.js, storage.js, ui.js
 */

function renderTagFilterBar() {
    const bar = DOM.tagFilterBar || document.getElementById('tagFilterBar');
    if (!bar) return;

    const allTagsSet = new Set(['工作', '人際', '健康', '情緒']);
    threads.forEach(t => {
        if (t.tags && Array.isArray(t.tags)) {
            t.tags.forEach(tag => allTagsSet.add(tag));
        }
    });

    const fragment = document.createDocumentFragment();

    const labelSpan = document.createElement('span');
    labelSpan.className = 'text-term-muted font-bold shrink-0';
    labelSpan.textContent = 'TAG:';
    fragment.appendChild(labelSpan);

    const allBtn = document.createElement('button');
    allBtn.onclick = () => filterByTag('');
    allBtn.className = `tag-terminal px-1.5 py-0.5 active-tag-btn ${activeFilterTag === '' ? 'active' : ''}`;
    allBtn.setAttribute('data-tag', '');
    allBtn.textContent = 'ALL';
    fragment.appendChild(allBtn);

    allTagsSet.forEach(tag => {
        const tagBtn = document.createElement('button');
        tagBtn.onclick = () => filterByTag(tag);
        tagBtn.className = `tag-terminal px-1.5 py-0.5 active-tag-btn ${activeFilterTag === tag ? 'active' : ''}`;
        tagBtn.setAttribute('data-tag', tag);
        tagBtn.textContent = tag;
        fragment.appendChild(tagBtn);
    });

    bar.innerHTML = '';
    bar.appendChild(fragment);
}

function createSampleThreads() {
    const sample1 = {
        id: generateId(),
        title: 'work_project_launch',
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        tags: ['工作', '健康'],
        summary: '專案上線前夕連續加班導致睡眠不足與焦慮升溫。',
        messages: [
            {
                id: generateId(),
                text: '專案上線前夕，最近這幾天連續加班睡眠不足，感覺壓力和焦慮直線上升。',
                timestamp: '22:15:00',
                date: new Date(Date.now() - 86400000 * 2).toLocaleDateString('sv-SE')
            }
        ]
    };
    threads = [sample1];
    saveToStorage(true);
    selectThread(sample1.id);
}


function createNewThread() {
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    const dateCode = `${now.getFullYear().toString().slice(-2)}${pad(now.getMonth()+1)}${pad(now.getDate())}`;
    
    const todayThreads = threads.filter(t => t.title && t.title.startsWith(`log_${dateCode}`));
    const suffix = todayThreads.length > 0 ? `_${todayThreads.length + 1}` : '';
    const titleName = `log_${dateCode}${suffix}`;

    const newThread = {
        id: generateId(),
        title: titleName,
        createdAt: now.toISOString(),
        tags: [],
        summary: '',
        messages: []
    };

    threads.unshift(newThread);
    saveToStorage(true);
    renderThreadsList();
    selectThread(newThread.id);
    showToast(`CREATED: ${titleName}`);
}

/**
 * Render Threads List with DocumentFragment to prevent multiple reflows
 */
function renderThreadsList() {
    const listContainer = DOM.threadsList || document.getElementById('threadsList');
    if (!listContainer) return;

    let filtered = threads.filter(thread => {
        // Defensive: ensure messages is always an array
        const messages = Array.isArray(thread.messages) ? thread.messages : [];
        const tags = Array.isArray(thread.tags) ? thread.tags : [];

        const matchesSearch = searchQuery === '' ||
            (thread.title || '').toLowerCase().includes(searchQuery) ||
            messages.some(m => (m.text || '').toLowerCase().includes(searchQuery)) ||
            tags.some(t => (t || '').toLowerCase().includes(searchQuery));  // honor placeholder "search_logs_or_tags"

        const matchesTag = activeFilterTag === '' || tags.includes(activeFilterTag);

        return matchesSearch && matchesTag;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = `
            <div class="text-center py-6 px-2 text-term-muted text-xs font-mono">
                <p>// no_records_found</p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(thread => {
        const isSelected = thread.id === activeThreadId;
        const messages = Array.isArray(thread.messages) ? thread.messages : [];
        const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
        const div = document.createElement('div');
        div.className = `p-2 border border-term-frame cursor-pointer transition-colors text-xs ${isSelected ? 'btn-terminal-active' : 'bg-term-bg hover:bg-term-frame/10'}`;
        div.onclick = () => selectThread(thread.id);

        const tagsBadgeHtml = (thread.tags || []).map(t => `<span class="text-[9px] border ${isSelected ? 'border-term-bg text-term-bg' : 'border-term-frame text-term-frame'} px-1 font-mono">#${escapeHtml(t)}</span>`).join(' ');

        div.innerHTML = `
            <div class="flex items-center justify-between mb-1">
                <span class="font-bold truncate max-w-[130px]">${isSelected ? '> ' : ''}${escapeHtml(thread.title || 'untitled')}</span>
                <span class="text-[10px] opacity-75 font-mono">[${messages.length}]</span>
            </div>
            <p class="text-[10px] opacity-70 truncate font-mono mb-1">${lastMsg ? escapeHtml(lastMsg.text) : '// empty'}</p>
            ${tagsBadgeHtml ? `<div class="flex items-center gap-1 flex-wrap">${tagsBadgeHtml}</div>` : ''}
        `;
        fragment.appendChild(div);
    });

    listContainer.innerHTML = '';
    listContainer.appendChild(fragment);
}

function selectThread(id) {
    activeThreadId = id;
    const thread = threads.find(t => t.id === id);
    if (!thread) return;

    if (DOM.emptyState) DOM.emptyState.classList.add('hidden');
    if (DOM.activeChatStream) DOM.activeChatStream.classList.remove('hidden');
    if (DOM.chatInputArea) DOM.chatInputArea.classList.remove('hidden');
    if (DOM.deleteBtn) DOM.deleteBtn.classList.remove('hidden');
    if (DOM.aiSummaryBtn) DOM.aiSummaryBtn.classList.remove('hidden');
    if (DOM.aiChatDrawerBtn) DOM.aiChatDrawerBtn.classList.remove('hidden');

    if (DOM.threadTitleInput) DOM.threadTitleInput.value = thread.title || '';
    if (DOM.currentDirectoryPath) DOM.currentDirectoryPath.textContent = `/home/user/diary/${thread.title || 'untitled'}`;

    renderThreadHeaderTags(thread);
    renderMessages(thread.messages);
    renderThreadsList();

    const sidebar = DOM.sidebar || document.getElementById('sidebar');
    if (sidebar && !sidebar.classList.contains('-translate-x-full') && window.innerWidth < 768) {
        toggleSidebar();
    }
}

function renderThreadHeaderTags(thread) {
    const container = DOM.threadHeaderTags || document.getElementById('threadHeaderTags');
    if (!container) return;
    const fragment = document.createDocumentFragment();
    (thread.tags || []).forEach(tag => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'tag-terminal text-[10px] px-1.5 py-0 h-5';
        tagSpan.textContent = `#${tag}`;
        fragment.appendChild(tagSpan);
    });
    container.innerHTML = '';
    container.appendChild(fragment);
}

function updateThreadTitle(val) {
    if (!activeThreadId) return;
    const thread = threads.find(t => t.id === activeThreadId);
    if (!thread) return;
    thread.title = val.trim();
    saveToStorage();
    renderThreadsList();
}

function confirmDeleteThread() {
    if (!activeThreadId) return;
    document.getElementById('deleteModal')?.classList.remove('hidden');
}

function closeDeleteModal() {
    document.getElementById('deleteModal')?.classList.add('hidden');
}

function executeDeleteThread() {
    if (!activeThreadId) return;
    lastDeletedState = JSON.parse(JSON.stringify(threads));
    threads = threads.filter(t => t.id !== activeThreadId);
    activeThreadId = threads.length > 0 ? threads[0].id : null;
    saveToStorage(true);
    closeDeleteModal();
    renderThreadsList();
    renderTagFilterBar();
    
    if (activeThreadId) {
        selectThread(activeThreadId);
    } else {
        if (DOM.emptyState) DOM.emptyState.classList.remove('hidden');
        if (DOM.activeChatStream) DOM.activeChatStream.classList.add('hidden');
        if (DOM.chatInputArea) DOM.chatInputArea.classList.add('hidden');
        if (DOM.deleteBtn) DOM.deleteBtn.classList.add('hidden');
        if (DOM.aiSummaryBtn) DOM.aiSummaryBtn.classList.add('hidden');
        if (DOM.aiChatDrawerBtn) DOM.aiChatDrawerBtn.classList.add('hidden');
    }
    showToast('THREAD_DELETED', false, true);
}

function deleteMessage(msgId) {
    if (!activeThreadId) return;
    const thread = threads.find(t => t.id === activeThreadId);
    if (!thread) return;
    lastDeletedState = JSON.parse(JSON.stringify(threads));
    thread.messages = thread.messages.filter(m => m.id !== msgId);
    saveToStorage(true);
    renderMessages(thread.messages);
    renderThreadsList();
    showToast('ENTRY_REMOVED', false, true);
}

function editMessage(msgId) {
    if (!activeThreadId) return;
    const thread = threads.find(t => t.id === activeThreadId);
    if (!thread || !Array.isArray(thread.messages)) return;
    const msg = thread.messages.find(m => m.id === msgId);
    if (!msg) return;

    const rowElement = document.getElementById(`msg_row_${msgId}`);
    if (!rowElement) return;

    rowElement.innerHTML = `
        <div class="flex-1 flex items-center gap-2">
            <input type="text" id="edit_input_${msgId}" value="${escapeHtml(msg.text)}" class="input-terminal w-full text-xs py-1" />
            <button onclick="saveEditedMessage('${msgId}')" class="btn-terminal text-[10px]">儲存</button>
            <button onclick="renderMessages(threads.find(t=>t.id===activeThreadId)?.messages || [])" class="btn-terminal text-[10px]">取消</button>
        </div>
    `;
    // Focus the edit input for better UX
    setTimeout(() => {
        const input = document.getElementById(`edit_input_${msgId}`);
        if (input) {
            input.focus();
            input.select();
        }
    }, 0);
}

function saveEditedMessage(msgId) {
    if (!activeThreadId) return;
    const thread = threads.find(t => t.id === activeThreadId);
    if (!thread) return;
    const msg = thread.messages.find(m => m.id === msgId);
    if (!msg) return;

    const input = document.getElementById(`edit_input_${msgId}`);
    if (!input) return;
    const newText = input.value.trim();
    if (newText) {
        msg.text = newText;
        saveToStorage(true);
        renderMessages(thread.messages);
        showToast('ENTRY_UPDATED_OK');
    }
}

/**
 * Render All Messages using DocumentFragment
 */
function renderMessages(messages) {
    const stream = DOM.activeChatStream || document.getElementById('activeChatStream');
    if (!stream) return;

    // Defensive: ensure messages is always an array
    const msgs = Array.isArray(messages) ? messages : [];

    if (msgs.length === 0) {
        stream.innerHTML = `
            <div class="text-center py-12 text-term-muted text-xs border border-dashed border-term-border p-4">
                <p>// NO_ENTRIES_RECORDED</p>
                <p class="mt-1 text-[11px]">輸入文字並按下 EXECUTE 記錄你的第一條日誌。</p>
            </div>
        `;
        return;
    }

    const fragment = document.createDocumentFragment();
    msgs.forEach((msg) => {
        fragment.appendChild(createMessageRowElement(msg));
    });

    stream.innerHTML = '';
    stream.appendChild(fragment);
    scrollToBottom();
}

function createMessageRowElement(msg) {
    const row = document.createElement('div');
    row.id = `msg_row_${msg.id}`;
    row.className = 'group relative flex items-baseline gap-2 sm:gap-2.5 px-2 py-1.5 transition-colors duration-100 border-l-2 border-transparent hover:border-term-frame hover:bg-[#E2DFD6] select-text';

    const timeStr = msg.timestamp ? msg.timestamp.slice(0, 5) : '--:--';

    row.innerHTML = `
        <span class="text-xs font-mono text-term-muted w-11 shrink-0 select-none tracking-tight">${timeStr}</span>
        <span class="text-xs text-term-muted shrink-0 select-none">▸</span>
        <div class="flex-1 text-xs sm:text-sm text-term-text font-mono leading-relaxed break-words whitespace-pre-wrap flex items-center justify-between gap-1">
            <span>${escapeHtml(msg.text)}</span>
        </div>
        <div class="opacity-0 group-hover:opacity-100 transition-opacity flex items-center space-x-1 shrink-0">
            <button onclick="editMessage('${msg.id}')" class="text-term-muted hover:text-term-frame text-xs font-mono px-1" title="edit entry">[edit]</button>
            <button onclick="deleteMessage('${msg.id}')" class="text-term-muted hover:text-rose-700 text-xs font-mono px-1" title="delete entry">[x]</button>
        </div>
    `;
    return row;
}

/**
 * Fast Direct Append for New Log Entry (avoids full stream DOM destruction)
 */
function appendSingleMessageToStream(msg) {
    const stream = DOM.activeChatStream || document.getElementById('activeChatStream');
    if (!stream) return;

    if (stream.querySelector('.border-dashed')) {
        stream.innerHTML = '';
    }

    const row = createMessageRowElement(msg);
    stream.appendChild(row);
    scrollToBottom();
}


function handleSendMessage(e) {
    if (e) e.preventDefault();
    const input = DOM.messageInput || document.getElementById('messageInput');
    if (!input) return;
    const text = input.value.trim();
    if (!text || !activeThreadId) return;

    const thread = threads.find(t => t.id === activeThreadId);
    if (!thread) return;

    const now = new Date();
    const pad = (n) => n.toString().padStart(2, '0');

    const newMsg = {
        id: generateId(),
        text: text,
        timestamp: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
        date: now.toLocaleDateString('sv-SE')
    };

    if (!Array.isArray(thread.messages)) thread.messages = [];
    thread.messages.push(newMsg);
    input.value = '';

    saveToStorage(true);
    appendSingleMessageToStream(newMsg);
    renderThreadsList();
    showToast('LOG_COMMITTED');
}

function handleKeySubmit(e) {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage(e);
    }
}


function filterByTag(tag) {
    activeFilterTag = tag;
    document.querySelectorAll('.active-tag-btn').forEach(btn => {
        if (btn.getAttribute('data-tag') === tag) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    renderThreadsList();
}

