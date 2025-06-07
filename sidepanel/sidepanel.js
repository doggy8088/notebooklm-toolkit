// sidepanel.js
document.addEventListener('DOMContentLoaded', function() {
    loadPrompts();
});

async function loadPrompts() {
    try {
        const result = await chrome.storage.local.get(['customPrompts']);
        const prompts = result.customPrompts || [];
        
        const container = document.getElementById('prompts-container');
        const emptyState = document.getElementById('empty-state');
        
        if (prompts.length === 0) {
            container.style.display = 'none';
            emptyState.classList.remove('hidden');
        } else {
            container.style.display = 'block';
            emptyState.classList.add('hidden');
            
            container.innerHTML = prompts.map((prompt, index) => 
                createPromptHTML(prompt, index)
            ).join('');
        }
    } catch (error) {
        console.error('Error loading prompts:', error);
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