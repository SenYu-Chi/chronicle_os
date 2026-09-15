/**
 * UI helpers for Chronicle OS v1.5
 * Toast, Clock, Sidebar toggle, DOM cache, scroll
 * Depends on: state.js, utils.js, storage.js
 */

function initDomCache() {
    const ids = [
        "app", "sidebar", "sidebarOverlay", "threadsList", "chatContainer", 
        "activeChatStream", "emptyState", "chatInputArea", "searchInput", 
        "tagFilterBar", "messageInput", "threadTitleInput", "currentDirectoryPath", 
        "threadHeaderTags", "systemClock", "threadCountBadge", "fileSyncStatus", 
        "fileSyncBadge", "aiStatusText", "aiStatusBadge", "toast", "toastMessage", 
        "toastIcon", "toastUndoBtn", "fileApiStatusText", "fileApiStatusModalText",
        "storageUsageText", "currentHandleLabel", "handleDescriptionText",
        "syncFileBtn", "aiSummaryBtn", "aiChatDrawerBtn", "deleteBtn"
    ];
    ids.forEach(id => {
        DOM[id] = document.getElementById(id);
    });
}

function showToast(msg, isError = false, showUndo = false) {
    const toast = DOM.toast || document.getElementById('toast');
    const toastMessage = DOM.toastMessage || document.getElementById('toastMessage');
    const toastIcon = DOM.toastIcon || document.getElementById('toastIcon');
    const undoBtn = DOM.toastUndoBtn || document.getElementById('toastUndoBtn');
    if (!toast) return;

    if (toastMessage) toastMessage.textContent = msg;
    if (toastIcon) {
        toastIcon.textContent = isError ? '!' : '>';
        toastIcon.className = isError ? 'text-rose-700 font-bold' : 'text-emerald-700 font-bold';
    }

    if (undoBtn) {
        if (showUndo) undoBtn.classList.remove('hidden');
        else undoBtn.classList.add('hidden');
    }

    toast.classList.remove('translate-y-20', 'opacity-0');
    
    if (undoTimeout) clearTimeout(undoTimeout);
    undoTimeout = setTimeout(() => {
        toast.classList.add('translate-y-20', 'opacity-0');
        if (!showUndo) lastDeletedState = null;
    }, showUndo ? 6000 : 2500);
}

function executeUndo() {
    if (lastDeletedState) {
        threads = lastDeletedState;
        saveToStorage(true);
        renderThreadsList();
        renderTagFilterBar();
        if (threads.length > 0) selectThread(threads[0].id);
        lastDeletedState = null;
        showToast('ACTION_REVERTED (RESTORED)');
        if (DOM.toastUndoBtn) DOM.toastUndoBtn.classList.add('hidden');
    }
}

function updateClock() {
    const clock = DOM.systemClock || document.getElementById('systemClock');
    if (!clock) return;
    const now = new Date();
    const pad = n => n.toString().padStart(2, '0');
    clock.textContent = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
}


/**
 * Sync Header status badges with current state (AI key presence, etc.)
 */
function updateStatusBadges() {
    const statusText = DOM.aiStatusText || document.getElementById('aiStatusText');
    if (statusText) {
        if (aiConfig && aiConfig.apiKey) {
            statusText.textContent = 'READY';
            statusText.className = 'font-bold ml-1 text-emerald-800';
        } else {
            statusText.textContent = 'LOCAL_ONLY';
            statusText.className = 'font-bold ml-1 text-amber-800';
        }
    }
    // fileSyncStatus is updated only when a File System handle is connected
}

function updateThreadCount() {
    const badge = DOM.threadCountBadge || document.getElementById('threadCountBadge');
    if (badge) badge.textContent = `${threads.length} threads`;
}

function toggleSidebar() {
    const sidebar = DOM.sidebar || document.getElementById('sidebar');
    const overlay = DOM.sidebarOverlay || document.getElementById('sidebarOverlay');
    if (sidebar) sidebar.classList.toggle('-translate-x-full');
    if (overlay) overlay.classList.toggle('hidden');
}

function scrollToBottom() {
    const container = DOM.chatContainer || document.getElementById('chatContainer');
    if (container) {
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    }
}
