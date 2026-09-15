/**
 * File operations, export/import, storage usage for Chronicle OS v1.5
 * Depends on: state.js, utils.js, storage.js, ui.js
 */

function openFileOpsModal() {
    document.getElementById('fileOpsModal')?.classList.remove('hidden');
    const isSupported = 'showOpenFilePicker' in window;
    const statusText = DOM.fileApiStatusModalText || document.getElementById('fileApiStatusModalText');
    if (statusText) {
        statusText.textContent = isSupported ? 'FS_ACCESS_API: DETECTED' : 'FS_ACCESS_API: UNSUPPORTED (FALLBACK)';
    }
    calculateStorageUsage();
}

function closeFileOpsModal() {
    document.getElementById('fileOpsModal')?.classList.add('hidden');
}

function calculateStorageUsage() {
    try {
        const raw = localStorage.getItem('chronicle_threads_v1.3') || '';
        const bytes = new Blob([raw]).size;
        const kb = (bytes / 1024).toFixed(2);
        const usageEl = DOM.storageUsageText || document.getElementById('storageUsageText');
        if (usageEl) {
            usageEl.textContent = `${kb} KB (${threads.length} 執行緒)`;
        }
    } catch(e) {
        console.warn("Storage calculation error:", e);
    }
}

function downloadBlobFile(content, fileName, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function exportAsMarkdown(scope = 'all') {
    let targetThreads = (scope === 'current' && activeThreadId) 
        ? threads.filter(t => t.id === activeThreadId) 
        : threads;

    if (targetThreads.length === 0) {
        showToast('NO_DATA_TO_EXPORT', true);
        return;
    }

    let mdStr = `# CHRONICLE OS - JOURNAL EXPORT\n`;
    mdStr += `*Export Date: ${new Date().toLocaleString()}*\n`;
    mdStr += `*Total Threads: ${targetThreads.length}*\n\n`;
    mdStr += `---\n\n`;

    targetThreads.forEach(t => {
        mdStr += `## 📝 ${t.title || 'Untitled Log'}\n`;
        mdStr += `- **Created**: ${t.createdAt || 'N/A'}\n`;
        mdStr += `- **Tags**: ${t.tags && t.tags.length > 0 ? t.tags.map(tag => `#${tag}`).join(', ') : 'None'}\n`;
        if (t.summary) {
            mdStr += `- **AI Summary**: ${t.summary}\n`;
        }
        const msgs = Array.isArray(t.messages) ? t.messages : [];
        mdStr += `\n### Entry Stream (${msgs.length})\n\n`;

        msgs.forEach(m => {
            const formattedText = (m.text || '').replace(/\n/g, '\n> ');
            mdStr += `> **[${m.date || ''} ${m.timestamp || ''}]**\n> ${formattedText}\n\n`;
        });
        mdStr += `---\n\n`;
    });

    const fileName = `chronicle_export_${scope}_${new Date().toISOString().split('T')[0]}.md`;
    downloadBlobFile(mdStr, fileName, 'text/markdown;charset=utf-8;');
    showToast(`MD_EXPORT_SUCCESS (${scope.toUpperCase()})`);
}

function exportAsCsv(scope = 'all') {
    let targetThreads = (scope === 'current' && activeThreadId) 
        ? threads.filter(t => t.id === activeThreadId) 
        : threads;

    if (targetThreads.length === 0) {
        showToast('NO_DATA_TO_EXPORT', true);
        return;
    }

    const csvRows = ['"Thread ID","Thread Title","Tags","Date","Timestamp","Entry Content"'];

    targetThreads.forEach(t => {
        const titleStr = (t.title || '').replace(/"/g, '""');
        const tagStr = (t.tags || []).join(';');
        const msgs = Array.isArray(t.messages) ? t.messages : [];
        msgs.forEach(m => {
            const textStr = (m.text || '').replace(/"/g, '""');
            csvRows.push(`"${t.id}","${titleStr}","${tagStr}","${m.date || ''}","${m.timestamp || ''}","${textStr}"`);
        });
    });

    const csvContent = "\uFEFF" + csvRows.join("\n");
    const fileName = `chronicle_export_${scope}_${new Date().toISOString().split('T')[0]}.csv`;
    downloadBlobFile(csvContent, fileName, 'text/csv;charset=utf-8;');
    showToast(`CSV_EXPORT_SUCCESS (${scope.toUpperCase()})`);
}

function validateAndSanitizeThreads(rawData) {
    if (!Array.isArray(rawData)) {
        throw new Error("格式錯誤：匯入的 JSON 根結構必須為陣列 Array。");
    }
    return rawData.map((t, idx) => {
        if (typeof t !== 'object' || t === null) {
            throw new Error(`無效條目，位於索引 ${idx}`);
        }
        return {
            id: t.id || generateId(),
            title: typeof t.title === 'string' && t.title.trim() ? t.title.trim() : `imported_log_${idx + 1}`,
            createdAt: t.createdAt || new Date().toISOString(),
            tags: Array.isArray(t.tags) ? t.tags.filter(x => typeof x === 'string') : [],
            summary: typeof t.summary === 'string' ? t.summary : '',
            messages: Array.isArray(t.messages) ? t.messages.map(m => ({
                id: m.id || generateId(),
                text: typeof m.text === 'string' ? m.text : '',
                timestamp: m.timestamp || '00:00:00',
                date: m.date || new Date().toLocaleDateString('sv-SE')
            })).filter(m => m.text.trim() !== '') : []
        };
    });
}

function triggerImportWithValidation() {
    const strategyEl = document.querySelector('input[name="importStrategy"]:checked');
    const strategy = strategyEl ? strategyEl.value : 'merge';

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';
    fileInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            try {
                const parsed = JSON.parse(evt.target.result);
                const sanitized = validateAndSanitizeThreads(parsed);

                if (strategy === 'overwrite') {
                    threads = sanitized;
                } else {
                    const existingIds = new Set(threads.map(t => t.id));
                    sanitized.forEach(item => {
                        if (existingIds.has(item.id)) {
                            item.id = generateId();
                        }
                        threads.push(item);
                    });
                }

                saveToStorage(true);
                renderThreadsList();
                renderTagFilterBar();
                calculateStorageUsage();

                if (threads.length > 0) {
                    selectThread(threads[0].id);
                } else {
                    if (DOM.emptyState) DOM.emptyState.classList.remove('hidden');
                    if (DOM.activeChatStream) DOM.activeChatStream.classList.add('hidden');
                }

                showToast(`IMPORT_SUCCESS (${strategy.toUpperCase()}: ${sanitized.length} THREADS)`);
                closeFileOpsModal();
            } catch(err) {
                console.error("Import failed:", err);
                showToast(`IMPORT_FAILED: ${err.message}`, true);
            }
        };
        reader.readAsText(file);
    };
    fileInput.click();
}

function clearAllDataWithBackup() {
    if (threads.length === 0) {
        showToast('STORAGE_ALREADY_EMPTY', true);
        return;
    }

    if (confirm("⚠️ 【安全防護】確定要清空全庫日記？系統將在清空前自動為您下載一份全庫 JSON 備份檔。")) {
        exportData('all');
        threads = [];
        saveToStorage(true);
        renderThreadsList();
        renderTagFilterBar();
        calculateStorageUsage();
        activeThreadId = null;

        if (DOM.emptyState) DOM.emptyState.classList.remove('hidden');
        if (DOM.activeChatStream) DOM.activeChatStream.classList.add('hidden');
        if (DOM.chatInputArea) DOM.chatInputArea.classList.add('hidden');
        if (DOM.deleteBtn) DOM.deleteBtn.classList.add('hidden');
        if (DOM.aiSummaryBtn) DOM.aiSummaryBtn.classList.add('hidden');
        if (DOM.aiChatDrawerBtn) DOM.aiChatDrawerBtn.classList.add('hidden');

        showToast('STORAGE_RESET_SAFEGUARD_EXPORTED');
        closeFileOpsModal();
    }
}

async function openLocalFileWithApi() {
    if ('showOpenFilePicker' in window) {
        try {
            const [handle] = await window.showOpenFilePicker({
                types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
            });
            fileHandle = handle;
            const file = await handle.getFile();
            const text = await file.text();
            let loaded;
            try {
                loaded = JSON.parse(text);
            } catch (parseErr) {
                throw new Error('Invalid JSON format in selected file');
            }
            const sanitized = validateAndSanitizeThreads(loaded);
            threads = sanitized;
            saveToStorage(true);
            renderThreadsList();
            renderTagFilterBar();
            calculateStorageUsage();
            if (threads.length > 0) selectThread(threads[0].id);
            updateHandleUI(handle.name);
            showToast('FILE_LOADED_OK');
        } catch(err) {
            if (err.name !== 'AbortError') showToast(`OPEN_FAILED: ${err.message}`, true);
        }
    } else {
        triggerImportWithValidation();
    }
}

async function saveToLocalFileWithApi() {
    if ('showSaveFilePicker' in window) {
        try {
            const handle = await window.showSaveFilePicker({
                suggestedName: `chronicle_journal_backup_${new Date().toISOString().split('T')[0]}.json`,
                types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
            });
            fileHandle = handle;
            const writable = await handle.createWritable();
            await writable.write(JSON.stringify(threads, null, 2));
            await writable.close();
            updateHandleUI(handle.name);
            calculateStorageUsage();
            showToast('SAVE_FILE_OK');
        } catch(err) {
            if (err.name !== 'AbortError') showToast('SAVE_FILE_FAILED', true);
        }
    } else {
        exportData('all');
    }
}

async function syncToCurrentHandle() {
    if (!fileHandle) {
        showToast('NO_FILE_HANDLE — please open or save a file first', true);
        return;
    }
    try {
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(threads, null, 2));
        await writable.close();
        calculateStorageUsage();
        showToast('FILE_SYNCED_OK');
    } catch(err) {
        console.error('Sync failed:', err);
        showToast(`SYNC_FAILED: ${err.message || 'unknown error'}`, true);
    }
}

function updateHandleUI(filename) {
    const label = document.getElementById('currentHandleLabel');
    const desc = document.getElementById('handleDescriptionText');
    const syncBtn = document.getElementById('syncFileBtn');
    const badgeStatus = document.getElementById('fileSyncStatus');
    const fileHandleState = document.getElementById('fileHandleState');

    if (label) label.textContent = filename;
    if (desc) desc.textContent = `Connected to local file: ${filename}`;
    if (syncBtn) {
        syncBtn.disabled = false;
        syncBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    if (badgeStatus) badgeStatus.textContent = 'SYNCED';
    if (fileHandleState) fileHandleState.textContent = `[file: ${filename}]`;
}

function openAiConfigModal() {
    document.getElementById('aiApiKeyInput').value = aiConfig.apiKey;
    document.getElementById('aiModelSelect').value = aiConfig.model;
    document.getElementById('aiSystemPromptInput').value = aiConfig.systemPrompt;
    document.getElementById('aiConfigModal')?.classList.remove('hidden');
}

function closeAiConfigModal() {
    document.getElementById('aiConfigModal')?.classList.add('hidden');
}

function saveAiConfig(e) {
    if (e) e.preventDefault();
    aiConfig.apiKey = document.getElementById('aiApiKeyInput').value.trim();
    aiConfig.model = document.getElementById('aiModelSelect').value;
    aiConfig.systemPrompt = document.getElementById('aiSystemPromptInput').value.trim();

    localStorage.setItem('chronicle_ai_key', aiConfig.apiKey);
    localStorage.setItem('chronicle_ai_model', aiConfig.model);
    localStorage.setItem('chronicle_ai_prompt', aiConfig.systemPrompt);

    const statusText = document.getElementById('aiStatusText');
    if (statusText) {
        statusText.textContent = aiConfig.apiKey ? 'READY' : 'LOCAL_ONLY';
        statusText.className = aiConfig.apiKey ? 'font-bold ml-1 text-emerald-800' : 'font-bold ml-1 text-amber-800';
    }

    closeAiConfigModal();
    showToast('AI_CONFIG_SAVED');
}

async function testAiConnection() {
    const key = document.getElementById('aiApiKeyInput').value.trim();
    if (!key) {
        showToast('PLEASE_ENTER_API_KEY', true);
        return;
    }
    try {
        showToast('TESTING_AI_CONNECTION...');
        const res = await callGeminiApi("Ping test. Respond with: OK", "You are a test agent.", { overrideKey: key });
        if (res) showToast('AI_CONNECTION_SUCCESSFUL!');
    } catch(err) {
        showToast('AI_CONNECTION_FAILED', true);
    }
}

function openStatsModal() {
    let totalMsgs = 0;
    const tagCounts = {};

    threads.forEach(t => {
        const msgs = Array.isArray(t.messages) ? t.messages : [];
        totalMsgs += msgs.length;
        (t.tags || []).forEach(tg => {
            tagCounts[tg] = (tagCounts[tg] || 0) + 1;
        });
    });

    document.getElementById('statTotalMessages').textContent = totalMsgs;
    document.getElementById('statTotalThreads').textContent = threads.length;

    const patternBox = document.getElementById('patternInsightBox');
    if (patternBox) {
        patternBox.innerHTML = `💡 <strong class="text-emerald-900">系統觀察：</strong> 目前總計記錄 ${totalMsgs} 則日誌，跨 ${threads.length} 篇執行緒。標籤過濾器已與 AI 提取之標籤完全同步。`;
    }

    const topicBox = document.getElementById('topicBreakdownList');
    if (topicBox) {
        const fragment = document.createDocumentFragment();
        const sortedTags = Object.keys(tagCounts).sort((a,b) => tagCounts[b] - tagCounts[a]);
        sortedTags.forEach(tg => {
            const tagSpan = document.createElement('span');
            tagSpan.className = 'tag-terminal text-[10px]';
            tagSpan.textContent = `#${tg} (${tagCounts[tg]})`;
            fragment.appendChild(tagSpan);
        });
        topicBox.innerHTML = '';
        topicBox.appendChild(fragment);
    }

    document.getElementById('statsModal')?.classList.remove('hidden');
}

function closeStatsModal() { document.getElementById('statsModal')?.classList.add('hidden'); }
function closeAiSummaryModal() { document.getElementById('aiSummaryModal')?.classList.add('hidden'); }

function copyAiSummaryText() {
    const box = document.getElementById('aiSummaryContent');
    if (!box) return;
    navigator.clipboard.writeText(box.innerText).then(() => {
        showToast('COPIED_TO_CLIPBOARD');
    }).catch(() => {
        showToast('COPY_FAILED', true);
    });
}

function exportData(scope = 'all') {
    let targetThreads = (scope === 'current' && activeThreadId) 
        ? threads.filter(t => t.id === activeThreadId) 
        : threads;

    if (targetThreads.length === 0) {
        showToast('NO_DATA_TO_EXPORT', true);
        return;
    }

    const dataStr = JSON.stringify(targetThreads, null, 2);
    const fileName = `chronicle_journal_${scope}_${new Date().toISOString().split('T')[0]}.json`;
    downloadBlobFile(dataStr, fileName, 'application/json;charset=utf-8;');
    showToast(`JSON_EXPORT_SUCCESS (${scope.toUpperCase()})`);
}

function openTimeMachineModal() {
    const modal = document.getElementById('timeMachineModal');
    const content = document.getElementById('timeMachineContent');
    if (!modal || !content) return;

    modal.classList.remove('hidden');
    
    const today = new Date();
    const curMonth = today.getMonth() + 1;
    const curDay = today.getDate();

    let matchedEntries = [];
    threads.forEach(t => {
        const msgs = Array.isArray(t.messages) ? t.messages : [];
        msgs.forEach(m => {
            if (m && m.date) {
                const parts = String(m.date).split('-');
                if (parts.length === 3) {
                    const mYear = parts[0];
                    const mMonth = parseInt(parts[1], 10);
                    const mDay = parseInt(parts[2], 10);
                    if (mMonth === curMonth && mDay === curDay) {
                        matchedEntries.push({ threadTitle: t.title || 'untitled', year: mYear, date: m.date, text: m.text || '', time: m.timestamp || '' });
                    }
                }
            }
        });
    });

    if (matchedEntries.length === 0) {
        content.innerHTML = `
            <div class="p-4 border border-term-frame bg-term-bg text-center space-y-2 font-mono">
                <p class="text-term-muted font-bold">// NO_TIME_CAPSULE_ENTRIES_FOUND</p>
                <p class="text-xs text-term-text">歷史上的今天 (${curMonth}月${curDay}日) 尚無跨年度日記紀錄。</p>
                <p class="text-[11px] text-term-muted">持續記錄，未來每年今日都能精準回顧！</p>
            </div>
        `;
    } else {
        const fragment = document.createDocumentFragment();
        matchedEntries.forEach(e => {
            const div = document.createElement('div');
            div.className = 'border border-term-frame p-3 bg-term-bg space-y-1 font-mono';
            div.innerHTML = `
                <div class="flex items-center justify-between text-term-muted border-b border-term-border pb-1">
                    <span class="font-bold text-amber-900">> [${e.year}年 ${e.date} ${e.time || ''}]</span>
                    <span>Thread: ${escapeHtml(e.threadTitle)}</span>
                </div>
                <p class="text-xs text-term-text pt-1 leading-relaxed">${escapeHtml(e.text)}</p>
            `;
            fragment.appendChild(div);
        });
        content.innerHTML = '';
        content.appendChild(fragment);
    }
}

function closeTimeMachineModal() {
    document.getElementById('timeMachineModal')?.classList.add('hidden');
}


