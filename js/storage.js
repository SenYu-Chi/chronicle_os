/**
 * Storage layer for Chronicle OS v1.5
 * Depends on: utils.js (debounce), state.js (threads, DOM, etc.)
 */

/**
 * Debounced Storage Writer to prevent blocking main thread on high-frequency changes
 */
const debouncedSaveToStorage = debounce(() => {
    saveToStorageDirect();
}, 300);

function saveToStorage(immediate = false) {
    if (immediate) {
        saveToStorageDirect();
    } else {
        debouncedSaveToStorage();
    }
}

function saveToStorageDirect() {
    try {
        localStorage.setItem('chronicle_threads_v1.3', JSON.stringify(threads));
        updateThreadCount();
        renderTagFilterBar();
        calculateStorageUsage();
    } catch(e) {
        console.error('Save storage error:', e);
    }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('chronicle_threads_v1.3');
        if (saved) {
            threads = JSON.parse(saved);
        }
    } catch(e) {
        console.error('Load storage error:', e);
        threads = [];
    }
}
