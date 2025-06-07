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
        <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 prompt-item" data-index="${index}">
            <div class="flex justify-between items-start mb-2">
                <div class="text-xs text-gray-500">${date}</div>
                <button class="delete-btn text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50 transition-colors" 
                        data-index="${index}" title="刪除此提示">
                    <span class="material-icons text-sm">delete</span>
                </button>
            </div>
            <div class="text-sm text-gray-800 leading-relaxed mb-2">${truncatedContent.replace(/\n/g, '<br>')}</div>
            ${prompt.content.length > 100 ? `
                <button class="expand-btn text-blue-600 hover:text-blue-800 text-xs font-medium" data-index="${index}">
                    顯示完整內容
                </button>
            ` : ''}
        </div>
    `;
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
                contentDiv.innerHTML = prompt.content.replace(/\n/g, '<br>');
                expandBtn.textContent = '收起內容';
            } else {
                const truncatedContent = prompt.content.length > 100 
                    ? prompt.content.substring(0, 100) + '...' 
                    : prompt.content;
                contentDiv.innerHTML = truncatedContent.replace(/\n/g, '<br>');
                expandBtn.textContent = '顯示完整內容';
            }
        }
    } catch (error) {
        console.error('Error expanding prompt:', error);
    }
}