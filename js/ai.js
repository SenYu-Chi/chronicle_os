/**
 * AI integration for Chronicle OS v1.5
 * Gemini API, chat drawer, summary, periodic reports
 * Depends on: state.js, utils.js, storage.js, ui.js, threads.js
 */

function toggleAiChatDrawer() {
    const drawer = document.getElementById('aiChatDrawer');
    if (drawer) drawer.classList.toggle('hidden');
}

function setAiChatScope(scope) {
    aiChatScope = scope;
    const btnCurrent = document.getElementById('aiModeCurrentBtn');
    const btnGlobal = document.getElementById('aiModeGlobalBtn');

    if (scope === 'current') {
        btnCurrent?.classList.add('btn-terminal-active');
        btnGlobal?.classList.remove('btn-terminal-active');
    } else {
        btnGlobal?.classList.add('btn-terminal-active');
        btnCurrent?.classList.remove('btn-terminal-active');
    }
}
function handleAiChatKey(e) {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.key === 'Enter') {
        e.preventDefault();
        handleAiChatSubmit(e);
    }
}


function quickAiQuery(promptText) {
    const input = document.getElementById('aiChatInput');
    if (input) {
        input.value = promptText;
        handleAiChatSubmit(new Event('submit'));
    }
}

/**
 * Robust Gemini REST API Call
 */
async function callGeminiApi(prompt, sysPrompt = '', options = {}) {
    const { overrideKey = null, jsonMode = false } = options;
    const key = overrideKey || aiConfig.apiKey;
    const model = aiConfig.model || 'gemini-3-flash-preview';

    if (!key) {
        return new Promise((resolve) => {
            setTimeout(() => {
                if (jsonMode) {
                    resolve(JSON.stringify({
                        tags: ["工作", "反思"],
                        summary: "【模擬模式】請設定 API Key 以獲得完整 AI 洞察分析。",
                        actionItems: ["請至 [ai_config] 設定 Gemini API Key"]
                    }));
                } else {
                    resolve(`**[SIMULATION MODE]**\n\n請在 **[ai_config]** 設定有效的 Gemini API Key 以啟用雲端 AI 功能。`);
                }
            }, 800);
        });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const systemInstructionText = sysPrompt || aiConfig.systemPrompt;

    const payload = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstructionText }] }
    };

    if (jsonMode) {
        payload.generationConfig = { responseMimeType: "application/json" };
    }

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Invalid Gemini API response format.');
    return text;
}

async function handleAiChatSubmit(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('aiChatInput');
    const messages = document.getElementById('aiChatMessages');
    if (!input || !messages) return;

    const userText = input.value.trim();
    if (!userText) return;
    input.value = '';

    // User message
    const userDiv = document.createElement('div');
    userDiv.className = 'ai-msg user';
    userDiv.textContent = userText;
    messages.appendChild(userDiv);

    // Loading
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'ai-msg assistant';
    loadingDiv.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-1"></i> Gemini AI 正在分析脈絡...`;
    messages.appendChild(loadingDiv);
    messages.scrollTop = messages.scrollHeight;

    try {
        let context = '';
        if (aiChatScope === 'current' && activeThreadId) {
            const thread = threads.find(t => t.id === activeThreadId);
            if (thread) {
                context = `Current thread title: ${thread.title}\nEntries:\n` +
                    (thread.entries || []).map(en => `[${en.time || ''}] ${en.content}`).join('\n');
            }
        } else {
            context = threads.map(t => `Thread: ${t.title}\n` + (t.entries || []).slice(-3).map(en => en.content).join('\n')).join('\n\n');
        }

        const fullPrompt = `Context from journal:\n${context}\n\nUser question: ${userText}`;
        const aiResponse = await callGeminiApi(fullPrompt);
        loadingDiv.innerHTML = parseMarkdownToHtml(aiResponse);
    } catch (err) {
        console.error(err);
        loadingDiv.innerHTML = `[ERROR] Unable to reach Gemini AI API. Please check API Key in [ai_config].`;
    }
    messages.scrollTop = messages.scrollHeight;
}

async function generateAiSummaryForThread(threadId) {
    const thread = threads.find(t => t.id === threadId);
    if (!thread) return;

    const entriesText = (thread.entries || []).map(e => e.content).join('\n---\n');
    const prompt = `Please analyze the following journal entries and provide:\n1. Suggested tags (array)\n2. A short summary\n3. Action items\n\nEntries:\n${entriesText}`;

    try {
        showToast('AI 正在分析中...');
        const rawResponse = await callGeminiApi(prompt, "You are a JSON analytical engine.", { jsonMode: true });
        const parsed = extractJsonFromText(rawResponse);
        if (parsed) {
            if (parsed.tags) thread.tags = parsed.tags;
            if (parsed.summary) thread.summary = parsed.summary;
            saveToStorage(true);
            renderThreadsList();
            selectThread(threadId);
            showToast('AI 分析完成');
        }
    } catch (e) {
        showToast('AI 分析失敗，請檢查 API Key', true);
    }
}

async function generatePeriodicReport(period = 'week') {
    const now = new Date();
    const entries = [];
    threads.forEach(t => {
        (t.entries || []).forEach(e => {
            const d = new Date(e.timestamp || e.time || now);
            entries.push({ title: t.title, content: e.content, date: d });
        });
    });

    const prompt = `Generate a ${period}ly reflective report based on these journal entries. Be insightful and use a retro terminal style.\n\nEntries:\n` +
        entries.slice(-50).map(e => `[${e.date.toISOString().slice(0,10)}] ${e.title}: ${e.content}`).join('\n');

    try {
        const report = await callGeminiApi(prompt);
        return report;
    } catch (e) {
        return `<span class="text-rose-800">[ERROR] Failed to generate report. Check API Key.</span>`;
    }
}
