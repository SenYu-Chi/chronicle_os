/**
 * Utility helpers for Chronicle OS v1.5
 * Global scope (loaded before other modules)
 */

function generateId() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, "&")
              .replace(/</g, "<")
              .replace(/>/g, ">")
              .replace(/"/g, """)
              .replace(/'/g, "&#039;");
}

/**
 * Generic Debounce Helper Function
 */
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

/**
 * Markdown parser for AI responses
 */
function parseMarkdownToHtml(markdown) {
    if (!markdown) return '';
    let escaped = escapeHtml(markdown);
    escaped = escaped.replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-term-frame">$1</strong>');
    escaped = escaped.replace(/^[\*\-]\s+(.*)$/gm, '<li class="ml-4 list-disc">$1</li>');
    escaped = escaped.replace(/```([\s\S]*?)```/g, '<pre class="bg-term-frame/10 p-2 border border-term-border my-1 font-mono text-[11px] overflow-x-auto">$1</pre>');
    escaped = escaped.replace(/\n/g, '<br>');
    return escaped;
}

/**
 * Extract JSON safely from string wrappers
 */
function extractJsonFromText(rawText) {
    if (!rawText) return null;
    let text = rawText.trim();
    if (text.startsWith('```')) {
        text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    }
    try {
        return JSON.parse(text);
    } catch(e) {
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace > firstBrace) {
            try {
                return JSON.parse(text.substring(firstBrace, lastBrace + 1));
            } catch (ex) {
                console.warn("Sub-string JSON parsing failed", ex);
            }
        }
        return null;
    }
}
