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
        const errorErr = await res.text();
        throw new Error(`API Request failed with status ${res.status}: ${errorErr}`);
    }

    const data = await res.json();
    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
        return data.candidates[0].content.parts[0].text;
    }
    throw new Error('Invalid Gemini API response format.');
}

function buildRollingGlobalContext() {
    let contextParts = [];
    threads.forEach((t, idx) => {
        const tagStr = t.tags && t.tags.length > 0 ? t.tags.join(',') : '無標籤';
        let threadDesc = `--- Thread #${idx + 1}: ${t.title} [標籤: ${tagStr}] ---\n`;
        if (t.summary && t.summary.trim() !== '') {
            threadDesc += `摘要: ${t.summary}\n(條目數: ${t.messages.length})\n`;
        } else {
            const recentMsgs = t.messages.slice(-5);
            threadDesc += `內容紀錄:\n` + recentMsgs.map(m => ` - [${m.date} ${m.timestamp}] ${m.text}`).join('\n') + '\n';
        }
        contextParts.push(threadDesc);
    });
    return contextParts.join('\n');
}

async function handleAiChatSubmit(e) {
    if (e) e.preventDefault();
    const input = document.getElementById('aiChatInput');
    const text = input.value.trim();
    if (!text) return;

    input.value = '';
    const messagesBox = document.getElementById('aiChatMessages');

    const userDiv = document.createElement('div');
    userDiv.className = 'p-2 border border-term-frame bg-term-frame text-term-bg font-mono min-w-0 break-words';
    userDiv.innerHTML = `<span class="text-[10px] opacity-75 block font-bold">> USER_QUERY [${aiChatScope === 'current' ? '單篇' : '全庫滾動'}]</span><p class="mt-0.5">${escapeHtml(text)}</p>`;
    messagesBox.appendChild(userDiv);

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'p-2 border border-term-frame bg-term-bg/50 font-mono min-w-0 break-words text-term-muted';
    loadingDiv.innerHTML = `<i class="fa-solid fa-spinner animate-spin mr-1"></i> Gemini AI 正在分析脈絡...`;
    messagesBox.appendChild(loadingDiv);
    messagesBox.scrollTop = messagesBox.scrollHeight;

    let contextText = '';
    if (aiChatScope === 'current') {
        const currentThread = threads.find(t => t.id === activeThreadId);
        if (currentThread) {
            contextText = `【當前單篇 Threads 日誌: ${currentThread.title}】\n` + currentThread.messages.map(m => `[${m.date} ${m.timestamp}] ${m.text}`).join('\n');
        } else {
            contextText = '【當前無選擇任何 Threads 日誌】';
        }
    } else {
        contextText = '【全庫歷史 Threads 滾動脈絡摘要】\n' + buildRollingGlobalContext();
    }

    const fullPrompt = `${aiConfig.systemPrompt}\n\n${contextText}\n\n使用者問題: ${text}`;

    try {
        const aiResponse = await callGeminiApi(fullPrompt);
        loadingDiv.className = 'p-2 border border-term-frame bg-term-bg/80 font-mono min-w-0 break-words text-term-text';
        loadingDiv.innerHTML = `<span class="text-[10px] text-term-muted block font-bold">// AI_RESPONSE</span><div class="mt-1 leading-relaxed">${parseMarkdownToHtml(aiResponse)}</div>`;
    } catch(err) {
        loadingDiv.className = 'p-2 border border-rose-800 bg-rose-50 text-rose-800 font-mono min-w-0 break-words text-xs';
        loadingDiv.innerHTML = `[ERROR] Unable to reach Gemini AI API. Please check API Key in [ai_config].`;
    }
    messagesBox.scrollTop = messagesBox.scrollHeight;
}

async function generateAiSummary() {
    if (!activeThreadId) return;
    const thread = threads.find(t => t.id === activeThreadId);
    if (!thread || thread.messages.length === 0) {
        showToast('NO_LOGS_TO_SUMMARIZE', true);
        return;
    }

    document.getElementById('aiSummaryModal')?.classList.remove('hidden');
    const summaryBox = document.getElementById('aiSummaryContent');
    if (summaryBox) {
        summaryBox.innerHTML = `
            <div class="text-center py-8 text-term-muted">
                <i class="fa-solid fa-spinner animate-spin text-lg mb-2 block"></i>
                <span>使用 Gemini JSON Mode 分析條目並建立滾動快取...</span>
            </div>
        `;
    }

    const logContext = thread.messages.map((m, idx) => `[${idx + 1}] [${m.date} ${m.timestamp}] -> ${m.text}`).join('\n');
    const prompt = `請分析以下日記條目，並務必回傳嚴格符合格式的 JSON 物件：
{
  "tags": ["1-3個主題標籤，如 工作, 人際, 健康, 心情"],
  "summary": "100字以內的核心事件總結",
  "topicAnalysis": "主題脈絡詳細分析",
  "reflections": "關鍵思考與啟示",
  "actionItems": ["建議行動項目1", "建議行動項目2"]
}

【Threads 日誌內容】
標題: ${thread.title}
內容條目:
${logContext}`;

    try {
        const rawResponse = await callGeminiApi(prompt, "You are a JSON analytical engine.", { jsonMode: true });
        const jsonResult = extractJsonFromText(rawResponse);

        if (jsonResult) {
            if (Array.isArray(jsonResult.tags) && jsonResult.tags.length > 0) {
                if (!thread.tags) thread.tags = [];
                jsonResult.tags.forEach(t => {
                    if (!thread.tags.includes(t)) thread.tags.push(t);
                });
            }

            if (jsonResult.summary) {
                thread.summary = jsonResult.summary;
            }

            saveToStorage(true);
            renderThreadHeaderTags(thread);
            renderThreadsList();
            renderTagFilterBar();

            let reportHtml = `
                <div class="space-y-3 font-mono text-xs">
                    <div class="border-b border-term-frame pb-2">
                        <span class="text-[10px] text-term-muted uppercase block font-bold">// EXTRACTED_TAGS</span>
                        <div class="flex items-center gap-1 mt-1">
                            ${(thread.tags || []).map(tg => `<span class="tag-terminal text-[10px] px-1.5 py-0 h-5">#${escapeHtml(tg)}</span>`).join('')}
                        </div>
                    </div>
                    <div>
                        <h4 class="font-bold text-term-frame text-sm mb-1">📌 本篇核心總結</h4>
                        <p class="leading-relaxed bg-term-frame/5 p-2 border border-term-border">${escapeHtml(jsonResult.summary || '')}</p>
                    </div>
                    ${jsonResult.topicAnalysis ? `
                        <div>
                            <h4 class="font-bold text-term-frame text-sm mb-1">🏷️ 主題脈絡分析</h4>
                            <p class="leading-relaxed">${escapeHtml(jsonResult.topicAnalysis)}</p>
                        </div>
                    ` : ''}
                    ${jsonResult.reflections ? `
                        <div>
                            <h4 class="font-bold text-term-frame text-sm mb-1">💡 關鍵思考與啟示</h4>
                            <p class="leading-relaxed">${escapeHtml(jsonResult.reflections)}</p>
                        </div>
                    ` : ''}
                    ${Array.isArray(jsonResult.actionItems) && jsonResult.actionItems.length > 0 ? `
                        <div>
                            <h4 class="font-bold text-term-frame text-sm mb-1">🚀 建議行動清單</h4>
                            <ul class="list-disc pl-4 space-y-1">
                                ${jsonResult.actionItems.map(item => `<li>${escapeHtml(item)}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                </div>
            `;
            if (summaryBox) summaryBox.innerHTML = reportHtml;
        } else {
            if (summaryBox) summaryBox.innerHTML = parseMarkdownToHtml(rawResponse);
        }
    } catch (err) {
        console.error("AI Summary generation failed", err);
        if (summaryBox) summaryBox.innerHTML = `<span class="text-rose-800">[ERROR] Failed to generate AI summary. Check API Key or Connection.</span>`;
    }
}

async function generatePeriodicAiReport(type = 'weekly') {
    closeStatsModal();
    document.getElementById('aiSummaryModal')?.classList.remove('hidden');
    const summaryBox = document.getElementById('aiSummaryContent');
    if (summaryBox) {
        summaryBox.innerHTML = `
            <div class="text-center py-8 text-term-muted">
                <i class="fa-solid fa-spinner animate-spin text-lg mb-2 block"></i>
                <span>使用全庫滾動脈絡 (Rolling Context) 生成個人報告...</span>
            </div>
        `;
    }

    const rollingContext = buildRollingGlobalContext();
    const prompt = `針對以下全庫滾動日誌脈絡，生成「${type === 'weekly' ? '週報/月報' : '定期'}個人成長洞察報告」：

1. 📊 期間整體生活總覽與心態趨勢
2. 🏷️ 主題分佈與高頻關注焦點
3. ⚠️ 潛在模式與反思警訊
4. 🌟 下階段具體可行的自我改進建議

【全庫滾動脈絡數據】
${rollingContext}`;

    try {
        const report = await callGeminiApi(prompt);
        if (summaryBox) summaryBox.innerHTML = parseMarkdownToHtml(report);
    } catch(err) {
        if (summaryBox) summaryBox.innerHTML = `<span class="text-rose-800">[ERROR] Failed to generate report. Check API Key.</span>`;
    }
}

