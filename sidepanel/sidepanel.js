const DEBUG = false;
let currentPrompts = [];
let canApplyToTextarea = false;
let isRenderingPrompts = false;

// sidepanel.js
document.addEventListener('DOMContentLoaded', function () {
    if (DEBUG) console.log('[DEBUG] Side panel DOM loaded');

    // 初始化翻譯
    initializeTranslations();

    loadPrompts();

    // 按鈕事件監聽器
    document.getElementById('refreshBtn').addEventListener('click', loadPrompts);
    document.getElementById('clearBtn').addEventListener('click', clearAllPrompts);
    document.getElementById('testBtn')?.addEventListener('click', addTestPrompt);

    // 監聽來自背景腳本的訊息
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'refreshSidePanelData') {
            if (DEBUG) console.log('[DEBUG] 🔄 Received refresh message, reloading prompts...');
            loadPrompts();
        } else if (message.type === 'episodeTextareaAvailability') {
            if (DEBUG) console.log('[DEBUG] 🎯 Received textarea availability:', message.available);
            if (message.available !== canApplyToTextarea) {
                canApplyToTextarea = !!message.available;
                renderPrompts();
            }
        }
    });
});

// 初始化翻譯函式
function initializeTranslations() {
    // 更新頁面標題
    document.getElementById('page-title').textContent = chrome.i18n.getMessage('query_custom_prompts');

    // 更新所有帶有 data-i18n 屬性的元素
    const elementsToTranslate = document.querySelectorAll('[data-i18n]');
    elementsToTranslate.forEach(element => {
        const messageKey = element.getAttribute('data-i18n');
        const message = chrome.i18n.getMessage(messageKey);
        if (message) {
            element.textContent = message;
        }
    });
}

async function clearAllPrompts() {
    if (confirm(chrome.i18n.getMessage('confirm_clear_all_prompts'))) {
        await chrome.storage.local.set({ customPrompts: [] });
        await loadPrompts();
    }
}

async function addTestPrompt() {
    const testPrompt = {
        content: `節目名稱不要叫「深入探索」，節目名稱改為「保哥帶你聽」。
節目內容應該詳細且具體，整場節目必須超過30分鐘。`,
        timestamp: Date.now(),
        notebookName: '測試筆記本',
        url: 'https://notebooklm.google.com/notebook/test-notebook-id'
    };

    const result = await chrome.storage.local.get(['customPrompts']);
    const prompts = result.customPrompts || [];
    prompts.unshift(testPrompt);

    await chrome.storage.local.set({ customPrompts: prompts });
    await loadPrompts();
}

async function loadPrompts() {
    try {
        if (DEBUG) console.log('[DEBUG] Loading prompts from storage...');
        const result = await chrome.storage.local.get(['customPrompts']);
        const prompts = result.customPrompts || [];
        currentPrompts = prompts;
        canApplyToTextarea = await checkEpisodeTextareaAvailability();
        if (DEBUG) console.log('[DEBUG] Retrieved prompts:', prompts);
        if (DEBUG) console.log('[DEBUG] Can apply to textarea:', canApplyToTextarea);

        renderPrompts();
    } catch (error) {
        if (DEBUG) console.error('[DEBUG] Error loading prompts:', error);
    }
}

function renderPrompts() {
    if (isRenderingPrompts) return;
    isRenderingPrompts = true;

    try {
        const container = document.getElementById('prompts-container');
        const emptyState = document.getElementById('empty-state');
        if (DEBUG) console.log('[DEBUG] Container element:', container);
        if (DEBUG) console.log('[DEBUG] Empty state element:', emptyState);
        if (DEBUG) console.log('[DEBUG] Empty state classes before:', emptyState?.className);
        if (DEBUG) console.log('[DEBUG] Empty state display before:', emptyState?.style.display);

        const prompts = currentPrompts || [];

        if (prompts.length === 0) {
            if (DEBUG) console.log('[DEBUG] No prompts found, showing empty state');
            if (container) {
                container.style.display = 'none';
                container.innerHTML = '';
            }
            if (emptyState) {
                emptyState.classList.remove('hidden');
                emptyState.style.display = 'block';
            }
        } else {
            if (DEBUG) console.log('[DEBUG] Found', prompts.length, 'prompts, displaying them');
            if (container) {
                container.style.display = 'block';
                container.innerHTML = createPromptsCards(prompts, canApplyToTextarea);
            } if (emptyState) {
                emptyState.classList.add('hidden');
                emptyState.style.display = 'none';
            }
        }

        if (DEBUG) console.log('[DEBUG] Empty state classes after:', emptyState?.className);
        if (DEBUG) console.log('[DEBUG] Empty state display after:', emptyState?.style.display);
    } finally {
        isRenderingPrompts = false;
    }
}

function createPromptsCards(prompts, canApply) {
    return `
        <div class="space-y-6 p-2">
            ${prompts.map((prompt, index) => createPromptCard(prompt, index, canApply)).join('')}
        </div>
    `;
}

function createPromptCard(prompt, index, canApply) {
    const date = new Date(prompt.timestamp).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    const truncatedContent = prompt.content.length > 150
        ? prompt.content.substring(0, 150) + '...'
        : prompt.content;    // Get title and URL for display
    const title = prompt.notebookName || chrome.i18n.getMessage('custom_prompt_content');
    const hasUrl = prompt.url && prompt.url !== '';
    const applyDisabledClass = canApply ? '' : 'opacity-60 cursor-not-allowed';
    const applyDisabledAttr = canApply ? '' : 'disabled';

    return `
        <div class="bg-white p-6 rounded-lg border border-gray-200 relative hover:shadow-md transition-shadow duration-200 prompt-card" data-index="${index}">
            <!-- 刪除按鈕浮動在右上角 -->            <button class="delete-btn absolute top-3 right-3 text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all duration-200"
                    data-index="${index}"
                    title="${chrome.i18n.getMessage('delete_this_prompt')}"
                    aria-label="${chrome.i18n.getMessage('delete_prompt')}">
                <span class="material-icons text-lg">delete_outline</span>
            </button>

            <!-- 日期標籤 -->
            <div class="flex items-center space-x-2 mb-3">
                <span class="material-icons text-blue-500 text-sm">schedule</span>
                <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">${date}</span>
            </div>

            <!-- 筆記本標題和連結 -->
            <div class="mb-2 pr-10">
                ${hasUrl ? `
                    <a href="${prompt.url}" target="_blank" rel="noopener noreferrer"
                       class="text-lg font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors duration-200 flex items-center gap-1">
                        ${escapeHtml(title)}
                        <span class="material-icons text-sm">open_in_new</span>
                    </a>
                ` : `
                    <h3 class="text-lg font-semibold text-gray-800">${escapeHtml(title)}</h3>
                `}
            </div>

            <!-- 填入 NotebookLM 按鈕 -->
            <div class="mb-4">
                <button class="apply-prompt-btn inline-flex items-center px-3 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors duration-200 text-sm font-medium shadow-sm disabled:bg-emerald-400 ${applyDisabledClass}"
                        data-index="${index}"
                        aria-label="${chrome.i18n.getMessage('apply_prompt_to_input')}"
                        ${applyDisabledAttr}>
                    <span class="material-icons text-sm mr-1">input</span>
                    <span>${chrome.i18n.getMessage('apply_prompt_to_input')}</span>
                </button>
            </div>

            <!-- 提示內容 -->
            <div class="prompt-content text-gray-600 whitespace-pre-wrap break-words leading-relaxed">${escapeHtml(truncatedContent)}</div>

            <!-- 卡片動作 -->
            <div class="flex flex-wrap gap-2 mt-4">
                ${prompt.content.length > 150 ? `
                    <button class="expand-btn text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-all duration-200"
                            data-index="${index}"
                            aria-label="${chrome.i18n.getMessage('show_full_content')}">
                        <span class="material-icons text-sm">expand_more</span>
                        <span>${chrome.i18n.getMessage('expand')}</span>
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function createPromptHTML(prompt, index) {
    const date = new Date(prompt.timestamp).toLocaleString('zh-TW');
    const truncatedContent = prompt.content.length > 100
        ? prompt.content.substring(0, 100) + '...'
        : prompt.content;

    return `
        <div class="prompt-card rounded-xl p-6 prompt-item shadow-md border border-gray-100 transition-all duration-300 hover:shadow-xl" data-index="${index}">
            <div class="flex justify-between items-start mb-4">
                <div class="flex items-center space-x-2">
                    <span class="material-icons text-blue-500 text-lg">edit_note</span>
                    <div class="text-xs text-gray-500 font-medium bg-gray-100 px-3 py-1 rounded-full">${date}</div>
                </div>                <button class="delete-btn text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all duration-200 flex-shrink-0 group"
                        data-index="${index}"
                        title="${chrome.i18n.getMessage('delete_this_prompt')}"
                        aria-label="${chrome.i18n.getMessage('delete_prompt')}">
                    <span class="material-icons text-lg group-hover:scale-110 transition-transform">delete_outline</span>
                </button>
            </div>
            <div class="text-sm text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap break-words font-light">${escapeHtml(truncatedContent)}</div>            ${prompt.content.length > 100 ? `
                <button class="expand-btn text-blue-600 hover:text-blue-700 text-xs font-medium flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-all duration-200"
                        data-index="${index}"
                        aria-label="${chrome.i18n.getMessage('show_full_content')}">
                    <span class="material-icons text-sm">expand_more</span>
                    <span>${chrome.i18n.getMessage('show_full_content')}</span>
                </button>
            ` : ''}
        </div>
    `;
}

// Helper function to escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Event delegation for delete buttons and expand buttons
document.addEventListener('click', async function (e) {
    if (e.target.closest('.delete-btn')) {
        const index = parseInt(e.target.closest('.delete-btn').dataset.index);
        await deletePrompt(index);
    } else if (e.target.closest('.expand-btn')) {
        const index = parseInt(e.target.closest('.expand-btn').dataset.index);
        await expandPrompt(index);
    } else if (e.target.closest('.apply-prompt-btn')) {
        const index = parseInt(e.target.closest('.apply-prompt-btn').dataset.index);
        await applyPromptToTextarea(index);
    }
});

async function deletePrompt(index) {
    try {
        const result = await chrome.storage.local.get(['customPrompts']);
        const prompts = result.customPrompts || [];

        if (confirm(chrome.i18n.getMessage('confirm_delete_prompt'))) {
            prompts.splice(index, 1);
            await chrome.storage.local.set({ customPrompts: prompts });
            await loadPrompts(); // Reload the list
        }
    } catch (error) {
        console.error('Error deleting prompt:', error);
    }
}

async function expandPrompt(index) {
    try {
        const result = await chrome.storage.local.get(['customPrompts']);
        const prompts = result.customPrompts || [];
        const prompt = prompts[index];
        if (prompt) {
            const promptElement = document.querySelector(`div[data-index="${index}"]`);
            const contentDiv = promptElement.querySelector('.prompt-content');
            const expandBtn = promptElement.querySelector('.expand-btn');
            const expandIcon = expandBtn.querySelector('.material-icons');
            const expandText = expandBtn.querySelector('span:last-child');            if (expandText.textContent.includes(chrome.i18n.getMessage('expand'))) {
                contentDiv.innerHTML = escapeHtml(prompt.content);
                expandText.textContent = chrome.i18n.getMessage('collapse');
                expandIcon.textContent = 'expand_less';
                expandBtn.setAttribute('aria-label', chrome.i18n.getMessage('hide_content'));
            } else {
                const truncatedContent = prompt.content.length > 150
                    ? prompt.content.substring(0, 150) + '...'
                    : prompt.content;
                contentDiv.innerHTML = escapeHtml(truncatedContent);
                expandText.textContent = chrome.i18n.getMessage('expand');
                expandIcon.textContent = 'expand_more';
                expandBtn.setAttribute('aria-label', chrome.i18n.getMessage('show_full_content'));
            }
        }
    } catch (error) {
        console.error('Error expanding prompt:', error);
    }
}

async function applyPromptToTextarea(index) {
    try {
        if (!canApplyToTextarea) return;
        const prompt = currentPrompts[index];
        if (!prompt) return;

        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id) return;

        const response = await chrome.tabs.sendMessage(activeTab.id, {
            type: 'applyPromptToEpisodeTextarea',
            content: prompt.content
        });

    } catch (error) {
        console.error('Error applying prompt to textarea:', error);
    }
}

async function checkEpisodeTextareaAvailability() {
    try {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id) return false;

        const response = await chrome.tabs.sendMessage(activeTab.id, {
            type: 'checkEpisodeTextareaAvailable'
        });
        return !!response?.success && !!response.available;
    } catch (error) {
        if (DEBUG) console.warn('Unable to check textarea availability:', error);
        return false;
    }
}
