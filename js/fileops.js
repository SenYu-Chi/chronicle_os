/**
 * File operations, export/import, storage usage for Chronicle OS v1.5
 * Depends on: state.js, utils.js, storage.js, ui.js, ai.js
 */

function calculateStorageUsage() {
    try {
        const raw = localStorage.getItem('chronicle_threads_v1.3') || '';
        const bytes = new Blob([raw]).size;
        const kb = (bytes / 1024).toFixed(1);
        const el = document.getElementById('storageUsageText');
        if (el) el.textContent = `${kb} KB used`;
    } catch (e) {}
}

function exportData() {
    const data = {
        version: '1.5',
        exportedAt: new Date().toISOString(),
        threads: threads
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chronicle_os_backup_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('EXPORT_COMPLETE');
}

function openAiConfigModal() {
    const modal = document.getElementById('aiConfigModal');
    if (!modal) return;
    const keyInput = document.getElementById('aiApiKeyInput');
    const modelSelect = document.getElementById('aiModelSelect');
    const promptInput = document.getElementById('aiSystemPromptInput');
    if (keyInput) keyInput.value = aiConfig.apiKey || '';
    if (modelSelect) modelSelect.value = aiConfig.model || 'gemini-3-flash-preview';
    if (promptInput) promptInput.value = aiConfig.systemPrompt || '';
    modal.classList.remove('hidden');
}

function closeAiConfigModal() {
    document.getElementById('aiConfigModal')?.classList.add('hidden');
}

function saveAiConfig() {
    const keyInput = document.getElementById('aiApiKeyInput');
    const modelSelect = document.getElementById('aiModelSelect');
    const promptInput = document.getElementById('aiSystemPromptInput');
    if (keyInput) aiConfig.apiKey = keyInput.value.trim();
    if (modelSelect) aiConfig.model = modelSelect.value;
    if (promptInput) aiConfig.systemPrompt = promptInput.value.trim();

    localStorage.setItem('chronicle_ai_key', aiConfig.apiKey);
    localStorage.setItem('chronicle_ai_model', aiConfig.model);
    localStorage.setItem('chronicle_ai_prompt', aiConfig.systemPrompt);

    updateStatusBadges();
    closeAiConfigModal();
    showToast('AI_CONFIG_SAVED');
}

async function testAiKey() {
    const keyInput = document.getElementById('aiApiKeyInput');
    const key = keyInput ? keyInput.value.trim() : '';
    if (!key) {
        showToast('Please enter API Key', true);
        return;
    }
    try {
        showToast('Testing API Key...');
        const res = await callGeminiApi('Ping test. Respond with: OK', 'You are a test agent.', { overrideKey: key });
        showToast(res && res.toUpperCase().includes('OK') ? 'API Key is valid!' : 'API responded');
    } catch (e) {
        showToast('API Key test failed', true);
    }
}

function openStatsModal() {
    const modal = document.getElementById('statsModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const content = document.getElementById('statsContent');
    if (content) {
        content.innerHTML = '<div class="p-4 text-xs">Generating report...</div>';
        generatePeriodicReport('week').then(report => {
            content.innerHTML = `<div class="p-4 text-xs font-mono leading-relaxed">${parseMarkdownToHtml(report)}</div>`;
        }).catch(() => {
            content.innerHTML = '<div class="p-4 text-xs text-rose-700">Failed to generate report</div>';
        });
    }
}

function closeStatsModal() {
    document.getElementById('statsModal')?.classList.add('hidden');
}

function openTimeMachineModal() {
    document.getElementById('timeMachineModal')?.classList.remove('hidden');
}

function closeTimeMachineModal() {
    document.getElementById('timeMachineModal')?.classList.add('hidden');
}
