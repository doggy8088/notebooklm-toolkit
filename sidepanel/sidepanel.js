// sidepanel.js
document.addEventListener('DOMContentLoaded', function () {
    console.log('[DEBUG] Side panel DOM loaded');
    loadPrompts();

    // Add a refresh button for debugging
    addDebugControls();
});

function addDebugControls() {
    const container = document.body;
    const debugDiv = document.createElement('div');
    debugDiv.innerHTML = `
        <div class="fixed bottom-6 right-6 bg-white rounded-xl shadow-lg border border-gray-200 p-4 z-50 backdrop-blur-md bg-opacity-95">
            <div class="flex space-x-2 text-xs">
                <button id="refreshBtn" class="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium">刷新</button>
                <button id="clearBtn" class="px-3 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium">清空</button>
                <button id="testBtn" class="px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium">測試</button>
            </div>
        </div>
    `;
    container.appendChild(debugDiv);

    document.getElementById('refreshBtn').addEventListener('click', loadPrompts);
    document.getElementById('clearBtn').addEventListener('click', clearAllPrompts);
    document.getElementById('testBtn').addEventListener('click', addTestPrompt);
}

async function clearAllPrompts() {
    if (confirm('確定要清空所有提示嗎？')) {
        await chrome.storage.local.set({ customPrompts: [] });
        await loadPrompts();
    }
}

async function addTestPrompt() {
    const testPrompt = {
        content: `測試提示 - ${new Date().toLocaleString()}`,
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
                container.innerHTML = createPromptsTable(prompts);
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

function createPromptsTable(prompts) {
    const tableHeader = `
        <table class="w-full">
            <thead class="bg-gray-50 border-b border-gray-200">
                <tr>
                    <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-32">日期時間</th>
                    <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">自訂提示內容</th>
                    <th class="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider w-20">操作</th>
                </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
    `;

    const tableRows = prompts.map((prompt, index) => createPromptRow(prompt, index)).join('');

    const tableFooter = `
            </tbody>
        </table>
    `;

    return tableHeader + tableRows + tableFooter;
}

function createPromptRow(prompt, index) {
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
        <tr class="hover:bg-gray-50 transition-colors duration-200" data-index="${index}">
            <td class="px-6 py-4 text-xs text-gray-500 font-medium" data-label="日期時間">
                <div class="flex items-center space-x-1">
                    <span class="material-icons text-blue-500 text-sm">schedule</span>
                    <span class="whitespace-nowrap">${date}</span>
                </div>
            </td>
            <td class="px-6 py-4" data-label="自訂提示內容">
                <div class="text-sm font-bold text-gray-900 leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(truncatedContent)}</div>
                ${prompt.content.length > 150 ? `
                    <button class="expand-btn text-blue-600 hover:text-blue-700 text-xs font-medium flex items-center space-x-1 mt-2 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded transition-all duration-200"
                            data-index="${index}"
                            aria-label="顯示完整內容">
                        <span class="material-icons text-xs">expand_more</span>
                        <span>展開</span>
                    </button>
                ` : ''}
            </td>
            <td class="px-6 py-4" data-label="操作">
                <button class="delete-btn text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-red-50 transition-all duration-200 group"
                        data-index="${index}"
                        title="刪除此提示"
                        aria-label="刪除提示">
                    <span class="material-icons text-sm group-hover:scale-110 transition-transform">delete_outline</span>
                </button>
            </td>
        </tr>
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
        const prompt = prompts[index];        if (prompt) {
            const promptElement = document.querySelector(`tr[data-index="${index}"]`);
            const contentDiv = promptElement.querySelector('.text-sm.font-bold');
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