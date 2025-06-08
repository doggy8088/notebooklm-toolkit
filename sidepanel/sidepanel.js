// sidepanel.js
document.addEventListener('DOMContentLoaded', function () {
    console.log('[DEBUG] Side panel DOM loaded');
    loadPrompts();

    // 按鈕事件監聽器
    document.getElementById('refreshBtn').addEventListener('click', loadPrompts);
    document.getElementById('clearBtn').addEventListener('click', clearAllPrompts);
    document.getElementById('testBtn').addEventListener('click', addTestPrompt);
});

async function clearAllPrompts() {
    if (confirm('確定要清空所有提示嗎？')) {
        await chrome.storage.local.set({ customPrompts: [] });
        await loadPrompts();
    }
}

async function addTestPrompt() {
    const testPrompt = {
        content: `節目名稱不要叫「深入探索」，節目名稱改為「保哥帶你聽」。
節目內容應該詳細且具體，整場節目必須超過30分鐘。`,
        timestamp: Date.now()
    };

    const result = await chrome.storage.local.get(['customPrompts']);
    const prompts = result.customPrompts || [];
    prompts.unshift(testPrompt);

    await chrome.storage.local.set({ customPrompts: prompts });
    await loadPrompts();
}

async function loadPrompts() {
    try {
        console.log('[DEBUG] Loading prompts from storage...');
        const result = await chrome.storage.local.get(['customPrompts']);
        const prompts = result.customPrompts || [];
        console.log('[DEBUG] Retrieved prompts:', prompts);

        const container = document.getElementById('prompts-container');
        const emptyState = document.getElementById('empty-state'); console.log('[DEBUG] Container element:', container);
        console.log('[DEBUG] Empty state element:', emptyState);
        console.log('[DEBUG] Empty state classes before:', emptyState?.className);
        console.log('[DEBUG] Empty state display before:', emptyState?.style.display); if (prompts.length === 0) {
            console.log('[DEBUG] No prompts found, showing empty state');
            if (container) {
                container.style.display = 'none';
                container.innerHTML = '';
            }
            if (emptyState) {
                emptyState.classList.remove('hidden');
                emptyState.style.display = 'block';
            }        } else {
            console.log('[DEBUG] Found', prompts.length, 'prompts, displaying them');
            if (container) {
                container.style.display = 'block';
                container.innerHTML = createPromptsCards(prompts);
            } if (emptyState) {
                emptyState.classList.add('hidden');
                emptyState.style.display = 'none';
            }
        }

        console.log('[DEBUG] Empty state classes after:', emptyState?.className);
        console.log('[DEBUG] Empty state display after:', emptyState?.style.display);
    } catch (error) {
        console.error('[DEBUG] Error loading prompts:', error);
    }
}

function createPromptsCards(prompts) {
    return `
        <div class="space-y-6 p-2">
            ${prompts.map((prompt, index) => createPromptCard(prompt, index)).join('')}
        </div>
    `;
}

function createPromptCard(prompt, index) {
    const date = new Date(prompt.timestamp).toLocaleString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });

    const truncatedContent = prompt.content.length > 150
        ? prompt.content.substring(0, 150) + '...'
        : prompt.content;    return `
        <div class="bg-white p-6 rounded-lg border border-gray-200 relative hover:shadow-md transition-shadow duration-200 prompt-card" data-index="${index}">
            <!-- 刪除按鈕浮動在右上角 -->
            <button class="delete-btn absolute top-3 right-3 text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all duration-200"
                    data-index="${index}"
                    title="刪除此提示"
                    aria-label="刪除提示">
                <span class="material-icons text-lg">delete_outline</span>
            </button>

            <!-- 日期標籤 -->
            <div class="flex items-center space-x-2 mb-3">
                <span class="material-icons text-blue-500 text-sm">schedule</span>
                <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">${date}</span>
            </div>

            <!-- 內容標題 -->
            <h3 class="text-lg font-semibold mb-2 pr-10">自訂提示內容</h3>

            <!-- 提示內容 -->
            <div class="prompt-content text-gray-600 whitespace-pre-wrap break-words leading-relaxed">${escapeHtml(truncatedContent)}</div>

            <!-- 展開按鈕 -->
            ${prompt.content.length > 150 ? `
                <button class="expand-btn text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center space-x-1 mt-3 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-all duration-200"
                        data-index="${index}"
                        aria-label="顯示完整內容">
                    <span class="material-icons text-sm">expand_more</span>
                    <span>展開</span>
                </button>
            ` : ''}
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
                </div>
                <button class="delete-btn text-gray-400 hover:text-red-500 p-2 rounded-full hover:bg-red-50 transition-all duration-200 flex-shrink-0 group"
                        data-index="${index}"
                        title="刪除此提示"
                        aria-label="刪除提示">
                    <span class="material-icons text-lg group-hover:scale-110 transition-transform">delete_outline</span>
                </button>
            </div>
            <div class="text-sm text-gray-700 leading-relaxed mb-4 whitespace-pre-wrap break-words font-light">${escapeHtml(truncatedContent)}</div>
            ${prompt.content.length > 100 ? `
                <button class="expand-btn text-blue-600 hover:text-blue-700 text-xs font-medium flex items-center space-x-1 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-lg transition-all duration-200"
                        data-index="${index}"
                        aria-label="顯示完整內容">
                    <span class="material-icons text-sm">expand_more</span>
                    <span>顯示完整內容</span>
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
    }
});

async function deletePrompt(index) {
    try {
        const result = await chrome.storage.local.get(['customPrompts']);
        const prompts = result.customPrompts || [];

        if (confirm('確定要刪除這個自訂提示嗎？')) {
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
        const prompt = prompts[index]; if (prompt) {
            const promptElement = document.querySelector(`div[data-index="${index}"]`);
            const contentDiv = promptElement.querySelector('.prompt-content');
            const expandBtn = promptElement.querySelector('.expand-btn');
            const expandIcon = expandBtn.querySelector('.material-icons');
            const expandText = expandBtn.querySelector('span:last-child');

            if (expandText.textContent.includes('展開')) {
                contentDiv.innerHTML = escapeHtml(prompt.content);
                expandText.textContent = '收起';
                expandIcon.textContent = 'expand_less';
                expandBtn.setAttribute('aria-label', '收起內容');
            } else {
                const truncatedContent = prompt.content.length > 150
                    ? prompt.content.substring(0, 150) + '...'
                    : prompt.content;
                contentDiv.innerHTML = escapeHtml(truncatedContent);
                expandText.textContent = '展開';
                expandIcon.textContent = 'expand_more';
                expandBtn.setAttribute('aria-label', '顯示完整內容');
            }
        }
    } catch (error) {
        console.error('Error expanding prompt:', error);
    }
}