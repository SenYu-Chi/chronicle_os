/**
 * Threads, messages, tags management for Chronicle OS v1.5
 * Depends on: state.js, utils.js, storage.js, ui.js
 */

function renderTagFilterBar() {
    const bar = DOM.tagFilterBar || document.getElementById('tagFilterBar');
    if (!bar) return;

    const allTagsSet = new Set(['工作', '人際', '健康', '學習', '反思']);
    threads.forEach(t => {
        (t.tags || []).forEach(tag => allTagsSet.add(tag));
    });

    let html = `<button class="tag-terminal ${!activeFilterTag ? 'active' : ''}" data-tag="" onclick="setFilterTag('')">全部</button>`;
    [...allTagsSet].sort().forEach(tag => {
        html += `<button class="tag-terminal ${activeFilterTag === tag ? 'active' : ''}" data-tag="${escapeHtml(tag)}" onclick="setFilterTag('${escapeHtml(tag)}')">${escapeHtml(tag)}</button>`;
    });
    bar.innerHTML = html;
}

function setFilterTag(tag) {
    activeFilterTag = tag;
    document.querySelectorAll('#tagFilterBar .tag-terminal').forEach(btn => {
        if (btn.getAttribute('data-tag') === tag) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    renderThreadsList();
}

function renderThreadsList() {
    const list = DOM.threadsList || document.getElementById('threadsList');
    if (!list) return;

    let filtered = threads;
    if (searchQuery) {
        filtered = filtered.filter(t =>
            (t.title || '').toLowerCase().includes(searchQuery) ||
            (t.entries || []).some(e => (e.content || '').toLowerCase().includes(searchQuery))
        );
    }
    if (activeFilterTag) {
        filtered = filtered.filter(t => (t.tags || []).includes(activeFilterTag));
    }

    if (filtered.length === 0) {
        list.innerHTML = '<div class="p-3 text-xs text-term-muted">No threads found.</div>';
        return;
    }

    list.innerHTML = filtered.map(t => {
        const isActive = t.id === activeThreadId;
        const lastEntry = (t.entries || []).slice(-1)[0];
        const preview = lastEntry ? (lastEntry.content || '').slice(0, 40) : '';
        return `
            <div class="thread-item ${isActive ? 'active' : ''}" onclick="selectThread('${t.id}')">
                <div class="title">${escapeHtml(t.title || 'Untitled')}</div>
                <div class="meta">${escapeHtml(preview)}${preview.length >= 40 ? '...' : ''}</div>
            </div>`;
    }).join('');
}

function selectThread(id) {
    activeThreadId = id;
    const thread = threads.find(t => t.id === id);
    if (!thread) return;

    const titleEl = document.getElementById('currentThreadTitle');
    if (titleEl) titleEl.textContent = thread.title || 'Untitled';

    renderThreadsList();
    renderEntries(thread);
}

function renderEntries(thread) {
    const container = document.getElementById('entriesContainer');
    if (!container) return;

    const entries = thread.entries || [];
    if (entries.length === 0) {
        container.innerHTML = '<div class="text-xs text-term-muted p-4">No entries yet. Write something below.</div>';
        return;
    }

    container.innerHTML = entries.map(e => `
        <div class="entry-card">
            <div class="entry-time">${escapeHtml(e.time || '')}</div>
            <div class="entry-body">${escapeHtml(e.content || '')}</div>
        </div>`).join('');
    scrollToBottom();
}

function createNewThread() {
    const id = generateId();
    const now = new Date();
    const title = `Thread ${now.getMonth()+1}/${now.getDate()} ${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
    const thread = {
        id,
        title,
        tags: [],
        entries: [],
        createdAt: now.toISOString()
    };
    threads.unshift(thread);
    saveToStorage(true);
    renderThreadsList();
    renderTagFilterBar();
    selectThread(id);
    showToast('NEW_THREAD_CREATED');
}

function submitEntry() {
    const input = document.getElementById('entryInput');
    if (!input) return;
    const content = input.value.trim();
    if (!content || !activeThreadId) return;

    const thread = threads.find(t => t.id === activeThreadId);
    if (!thread) return;

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const timeStr = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    if (!thread.entries) thread.entries = [];
    thread.entries.push({
        id: generateId(),
        content,
        time: timeStr,
        timestamp: now.toISOString()
    });

    input.value = '';
    saveToStorage(true);
    renderEntries(thread);
    renderThreadsList();
    showToast('ENTRY_SAVED');
}

function handleEntryKey(e) {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        submitEntry();
    }
}

function deleteCurrentThread() {
    if (!activeThreadId) return;
    if (!confirm('Delete this thread?')) return;

    lastDeletedState = JSON.parse(JSON.stringify(threads));
    threads = threads.filter(t => t.id !== activeThreadId);
    activeThreadId = threads.length > 0 ? threads[0].id : null;
    saveToStorage(true);
    renderThreadsList();
    renderTagFilterBar();
    if (activeThreadId) selectThread(activeThreadId);
    else {
        const titleEl = document.getElementById('currentThreadTitle');
        if (titleEl) titleEl.textContent = 'Select a thread';
        const container = document.getElementById('entriesContainer');
        if (container) container.innerHTML = '';
    }
    showToast('THREAD_DELETED', false, true);
}

function createSampleThreads() {
    const samples = [
        {
            title: '今日反思',
            tags: ['反思'],
            entries: [{
                content: '今天開始使用 Chronicle OS，感覺像是在操作一台復古終端機。',
                time: new Date().toISOString().slice(0, 16).replace('T', ' ')
            }]
        }
    ];
    samples.forEach(s => {
        const id = generateId();
        threads.push({
            id,
            title: s.title,
            tags: s.tags,
            entries: s.entries.map(e => ({ ...e, id: generateId(), timestamp: new Date().toISOString() })),
            createdAt: new Date().toISOString()
        });
    });
    saveToStorage(true);
    renderThreadsList();
    renderTagFilterBar();
    if (threads.length > 0) selectThread(threads[0].id);
}
