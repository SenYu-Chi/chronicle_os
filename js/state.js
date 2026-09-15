/**
 * Central application state for Chronicle OS v1.5
 * All modules share these variables (classic script global scope).
 * This file is the single source of truth for mutable state.
 */

let threads = [];
let activeThreadId = null;
let searchQuery = '';
let activeFilterTag = '';
let fileHandle = null;

let aiConfig = {
    apiKey: localStorage.getItem('chronicle_ai_key') || '',
    model: localStorage.getItem('chronicle_ai_model') || 'gemini-3-flash-preview',
    systemPrompt: localStorage.getItem('chronicle_ai_prompt') || 'You are a retro terminal personal reflective coach and daily journal assistant.'
};

let aiChatScope = 'current';

// Undo State Cache
let lastDeletedState = null;
let undoTimeout = null;

/**
 * Cached DOM Elements Registry for Fast Access
 */
const DOM = {};
