/**
 * Application entry point for Chronicle OS v1.5 (Modular)
 * Depends on (load order):
 *   utils.js → state.js → storage.js → ui.js → threads.js → ai.js → fileops.js → app.js
 */

/**
 * Debounced Search Input Handler
 */
const debouncedHandleSearch = debounce((val) => {
    searchQuery = val.trim().toLowerCase();
    renderThreadsList();
}, 150);

/**
 * Application bootstrap
 */
window.onload = function() {
    initDomCache();
    loadFromStorage();
    updateStatusBadges();
    if (threads.length === 0) {
        createSampleThreads();
    } else {
        renderThreadsList();
        renderTagFilterBar();
        selectThread(threads[0].id);
    }
    setInterval(updateClock, 1000);
    updateClock();
};
