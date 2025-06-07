// sidepanel.js
document.addEventListener('DOMContentLoaded', function() {
    console.log('[DEBUG] Side panel DOM loaded');
    loadPrompts();
    
    // Add a refresh button for debugging
    addDebugControls();
});

function addDebugControls() {
    const container = document.body;
    const debugDiv = document.createElement('div');
    debugDiv.innerHTML = `
        <div style="position: fixed; bottom: 10px; right: 10px; background: #f0f0f0; padding: 10px; border-radius: 5px; font-size: 12px; z-index: 1000;">
            <button id="refreshBtn" style="margin: 2px; padding: 5px 10px;">刷新</button>
            <button id="clearBtn" style="margin: 2px; padding: 5px 10px;">清空</button>
            <button id="testBtn" style="margin: 2px; padding: 5px 10px;">測試</button>
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
        const emptyState = document.getElementById('empty-state');
        
        console.log('[DEBUG] Container element:', container);
        console.log('[DEBUG] Empty state element:', emptyState);
        
        if (prompts.length === 0) {
            console.log('[DEBUG] No prompts found, showing empty state');
            if (container) container.style.display = 'none';
            if (emptyState) emptyState.classList.remove('hidden');
        } else {
            console.log('[DEBUG] Found', prompts.length, 'prompts, displaying them');
            if (container) {
                container.style.display = 'block';
                container.innerHTML = prompts.map((prompt, index) => 
                    createPromptHTML(prompt, index)
                ).join('');
            }
            if (emptyState) emptyState.classList.add('hidden');
        }
    } catch (error) {
        console.error('[DEBUG] Error loading prompts:', error);
    }
}

function createPromptHTML(prompt, index) {
    const date = new Date(prompt.timestamp).toLocaleString('zh-TW');
    const truncatedContent = prompt.content.length > 100 
        ? prompt.content.substring(0, 100) + '...' 
        : prompt.content;
    
    return `
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 prompt-item hover:shadow-md transition-shadow" data-index="${index}">
            <div class="flex justify-between items-start mb-3">
                <div class="text-xs text-gray-500 font-medium">${date}</div>
                <button class="delete-btn text-gray-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50 transition-colors flex-shrink-0" 
                        data-index="${index}" 
                        title="刪除此提示"
                        aria-label="刪除提示">
                    <span class="material-icons text-sm">delete</span>
                </button>
            </div>
            <div class="text-sm text-gray-800 leading-relaxed mb-3 whitespace-pre-wrap break-words">${escapeHtml(truncatedContent)}</div>
            ${prompt.content.length > 100 ? `
                <button class="expand-btn text-blue-600 hover:text-blue-800 text-xs font-medium underline" 
                        data-index="${index}"
                        aria-label="顯示完整內容">
                    顯示完整內容
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
document.addEventListener('click', async function(e) {
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
        const prompt = prompts[index];
        
        if (prompt) {
            const promptElement = document.querySelector(`[data-index="${index}"]`);
            const contentDiv = promptElement.querySelector('.text-sm.text-gray-800');
            const expandBtn = promptElement.querySelector('.expand-btn');
            
            if (expandBtn.textContent.includes('顯示完整內容')) {
                contentDiv.innerHTML = escapeHtml(prompt.content);
                expandBtn.textContent = '收起內容';
                expandBtn.setAttribute('aria-label', '收起內容');
            } else {
                const truncatedContent = prompt.content.length > 100 
                    ? prompt.content.substring(0, 100) + '...' 
                    : prompt.content;
                contentDiv.innerHTML = escapeHtml(truncatedContent);
                expandBtn.textContent = '顯示完整內容';
                expandBtn.setAttribute('aria-label', '顯示完整內容');
            }
        }
    } catch (error) {
        console.error('Error expanding prompt:', error);
    }
}