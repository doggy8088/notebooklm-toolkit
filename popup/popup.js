// Utility functions for RPC requests
function extractParameter(paramName, htmlContent) {
    const regex = new RegExp(`"${paramName}":"([^"]+)"`);
    const match = regex.exec(htmlContent);
    return match ? match[1] : undefined;
}

async function prepareRPCRequest(options) {
    const { rpcs } = options;
    const url = new URL('https://notebooklm.google.com/_/n/rpc');
    
    const headers = new Headers();
    headers.append('Content-Type', 'application/x-www-form-urlencoded');
    headers.append('Origin', 'https://notebooklm.google.com');
    headers.append('Referer', 'https://notebooklm.google.com/');
    
    const body = new URLSearchParams();
    body.append('f.req', JSON.stringify(rpcs));
    
    return { url, headers, body };
}

async function parseRPCResponse(response) {
    const text = await response.text();
    
    // Handle empty or invalid responses
    if (!text || text.trim().length === 0) {
        throw new Error("Empty response from server");
    }
    
    try {
        // Parse the response format that starts with )]}' 
        let jsonStr = text;
        if (text.startsWith(")]}'\n")) {
            jsonStr = text.substring(5);
        } else if (text.indexOf('[') > 0) {
            jsonStr = text.substring(text.indexOf('['));
        }
        
        const parsed = JSON.parse(jsonStr);
        
        // Validate the response structure
        if (!Array.isArray(parsed)) {
            throw new Error("Invalid response format");
        }
        
        return parsed;
    } catch (error) {
        console.error("Failed to parse RPC response:", text);
        throw new Error("Invalid response from NotebookLM API");
    }
}

// NotebookLM API client
class NotebookLMClient {
    constructor(authParams) {
        this.authParams = authParams;
    }

    static async create() {
        try {
            const response = await fetch("https://notebooklm.google.com/", {
                method: "GET",
                credentials: "include"
            });
            
            if (!response.ok) {
                throw new Error("Failed to fetch NotebookLM page");
            }
            
            const htmlContent = await response.text();
            
            const authToken = extractParameter("SNlM0e", htmlContent);
            const buildLabel = extractParameter("cfb2h", htmlContent);
            
            if (!authToken || !buildLabel) {
                throw new Error("Please sign-in to your Google account to use NotebookLM");
            }
            
            return new NotebookLMClient({
                authToken: authToken,
                buildLabel: buildLabel
            });
        } catch (error) {
            console.error("Error creating NotebookLM client:", error);
            throw error;
        }
    }

    async execute(rpcRequests) {
        const { url, headers, body } = await prepareRPCRequest({
            rpcs: rpcRequests
        });

        url.searchParams.append("bl", this.authParams.buildLabel);
        body.append("at", this.authParams.authToken);

        const response = await fetch(url.toString(), {
            method: "POST",
            headers: headers,
            body: body,
            credentials: "include"
        });

        if (!response.ok) {
            throw new Error(`RPC request failed: ${response.status}`);
        }

        return parseRPCResponse(response);
    }

    async listNotebooks() {
        const response = await this.execute([{
            id: "wXbhsf",
            args: [null, 1]
        }]);

        const notebooks = response[0]?.data?.[0];
        if (!notebooks || !Array.isArray(notebooks)) {
            return [];
        }

        // Sort by time
        notebooks.sort((a, b) => (a[5]?.[1] || 0) - (b[5]?.[1] || 0));

        return notebooks.map(notebook => ({
            id: notebook[2],
            title: notebook[0] || "Untitled",
            emoji: notebook[3] || "📔"
        }));
    }

    async createNotebook(title, emoji = "📔") {
        const response = await this.execute([{
            id: "CCqFvf",
            args: [title, emoji]
        }]);

        return {
            id: response[0]?.data?.[2]
        };
    }

    async addTextSource(notebookId, title, content) {
        // Add text content as source - format according to the provided example
        const response = await this.execute([{
            id: "izAoDd",
            args: [[
                [null, null, null, null, null, null, null, null, [title, content]]
            ], notebookId]
        }]);

        return response[0]?.data;
    }

    async getAccount() {
        const response = await this.execute([{
            id: "ZwVcOc",
            args: []
        }]);

        return {
            language: response[0]?.data?.[0]?.[2]?.at?.(-1)?.[0] || "en"
        };
    }

    async createAudioOverview(notebookId) {
        const account = await this.getAccount();
        
        await this.execute([{
            id: "AHyHrd",
            args: [notebookId, 0, [null, null, null, [], account.language]]
        }]);
    }
}

// Page content extraction and conversion
async function getCurrentPageContent() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
        throw new Error("No active tab found");
    }

    // Check if the tab URL is accessible
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://') || tab.url.startsWith('moz-extension://')) {
        throw new Error("Cannot access browser internal pages");
    }

    try {
        // Execute content script to get page content
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: extractPageContent
        });

        if (!results || !results[0] || !results[0].result) {
            throw new Error("Failed to extract page content");
        }

        const content = results[0].result;
        
        // Ensure we have some content
        if (!content || content.trim().length === 0) {
            throw new Error("No content found on the page");
        }

        // Limit content size (NotebookLM has limits)
        const maxContentLength = 500000; // 500KB limit
        let finalContent = content;
        
        if (content.length > maxContentLength) {
            finalContent = content.substring(0, maxContentLength) + '\n\n*[Content truncated due to size limit]*';
        }

        return {
            title: tab.title || "Untitled",
            url: tab.url,
            content: finalContent
        };
    } catch (error) {
        console.error("Error executing content script:", error);
        
        // Fallback: use basic page information
        return {
            title: tab.title || "Untitled",
            url: tab.url,
            content: `# ${tab.title || "Untitled"}\n\nURL: ${tab.url}\n\n*Content could not be extracted from this page.*`
        };
    }
}

// Function to be injected into the page to extract content
function extractPageContent() {
    try {
        let markdownContent = '';
        
        // Try to use existing TurndownService if available (from NotebookLM pages)
        if (typeof TurndownService !== 'undefined') {
            const turndownService = new TurndownService({
                headingStyle: 'atx',
                hr: '---',
                bulletListMarker: '-',
                codeBlockStyle: 'fenced',
                emDelimiter: '*',
                strongDelimiter: '**'
            });
            
            // Clean the HTML content
            const clonedElement = document.documentElement.cloneNode(true);
            
            // Remove unwanted elements
            const unwantedSelectors = [
                'script', 'style', 'nav', 'header', 'footer', 'aside', 
                '.ads', '.advertisement', '.social-sharing', '#comments',
                '[class*="cookie"]', '[class*="popup"]', '[class*="modal"]',
                '[id*="cookie"]', '[id*="popup"]', '[id*="modal"]',
                '.sidebar', '.navigation', '.menu', '.share', '.related'
            ];
            
            unwantedSelectors.forEach(selector => {
                try {
                    const elements = clonedElement.querySelectorAll(selector);
                    elements.forEach(el => el.remove());
                } catch (e) {
                    // Ignore selector errors
                }
            });
            
            // Try to find main content
            let mainContent = clonedElement.querySelector('main, article, .content, .post, .entry-content, .post-content, [role="main"]') || clonedElement.querySelector('body');
            
            if (mainContent) {
                markdownContent = turndownService.turndown(mainContent.innerHTML);
            }
        }
        
        // Fallback: create basic markdown from text content
        if (!markdownContent || markdownContent.trim().length === 0) {
            const title = document.title;
            let content = '';
            
            // Try to find main content element
            const mainElement = document.querySelector('main, article, .content, .post, .entry-content, .post-content, [role="main"]') || document.body;
            
            if (mainElement) {
                // Extract headings and paragraphs
                const headings = mainElement.querySelectorAll('h1, h2, h3, h4, h5, h6');
                const paragraphs = mainElement.querySelectorAll('p');
                const lists = mainElement.querySelectorAll('ul, ol');
                
                // Build basic markdown
                if (headings.length > 0) {
                    headings.forEach(heading => {
                        const level = parseInt(heading.tagName[1]);
                        const prefix = '#'.repeat(level);
                        content += `${prefix} ${heading.textContent.trim()}\n\n`;
                    });
                }
                
                if (paragraphs.length > 0) {
                    paragraphs.forEach(p => {
                        const text = p.textContent.trim();
                        if (text) {
                            content += `${text}\n\n`;
                        }
                    });
                }
                
                if (lists.length > 0) {
                    lists.forEach(list => {
                        const items = list.querySelectorAll('li');
                        items.forEach(item => {
                            content += `- ${item.textContent.trim()}\n`;
                        });
                        content += '\n';
                    });
                }
                
                // If no structured content found, use all text
                if (!content.trim()) {
                    content = mainElement.textContent.trim();
                }
            }
            
            // Final fallback
            if (!content.trim()) {
                content = document.body.textContent.trim() || 'No content found';
            }
            
            markdownContent = `# ${title}\n\n${content}`;
        }
        
        // Clean up excessive whitespace
        markdownContent = markdownContent.replace(/\n{3,}/g, '\n\n').trim();
        
        // Add URL as metadata
        markdownContent += `\n\n---\n*Source: ${window.location.href}*`;
        
        return markdownContent;
        
    } catch (error) {
        console.error('Error extracting content:', error);
        // Ultimate fallback
        const title = document.title || 'Untitled';
        const url = window.location.href;
        const basicContent = document.body.textContent || document.body.innerText || 'Unable to extract content';
        
        return `# ${title}\n\n${basicContent}\n\n---\n*Source: ${url}*`;
    }
}

// UI Management
class PopupUI {
    constructor() {
        this.client = null;
        this.notebooks = [];
        this.selectedNotebook = '';
        this.settings = { autoAudioOverview: false };
        
        this.initializeElements();
        this.loadSettings();
        this.initialize();
    }

    initializeElements() {
        this.elements = {
            status: document.getElementById('status'),
            loading: document.getElementById('loading'),
            error: document.getElementById('error'),
            mainContent: document.getElementById('main-content'),
            success: document.getElementById('success'),
            pageTitle: document.getElementById('page-title'),
            pageUrl: document.getElementById('page-url'),
            notebookSelect: document.getElementById('notebook-select'),
            importBtn: document.getElementById('import-btn'),
            createNotebookBtn: document.getElementById('create-notebook-btn'),
            openNotebookLM: document.getElementById('open-notebooklm'),
            openNotebook: document.getElementById('open-notebook'),
            autoAudio: document.getElementById('auto-audio'),
            successText: document.getElementById('success-text')
        };

        // Localize UI
        this.localizeUI();
        
        // Bind event listeners
        this.bindEvents();
    }

    localizeUI() {
        const messages = {
            'title': chrome.i18n.getMessage('popup_importToNotebookLM_title') || 'Import to NotebookLM',
            'loading-text': chrome.i18n.getMessage('popup_connecting') || 'Connecting to NotebookLM...',
            'error-text': chrome.i18n.getMessage('popup_pleaseSignIn') || 'Please sign in to NotebookLM',
            'notebook-label': chrome.i18n.getMessage('popup_selectNotebook') || 'Select Notebook:',
            'import-text': chrome.i18n.getMessage('popup_importToNotebook') || 'Import to Notebook',
            'create-text': chrome.i18n.getMessage('popup_createNewNotebook') || 'Create New Notebook',
            'auto-audio-text': chrome.i18n.getMessage('popup_autoAudioOverview') || 'Auto create audio overview',
            'success-text': chrome.i18n.getMessage('popup_successfullyImported') || 'Successfully imported!'
        };

        Object.entries(messages).forEach(([id, text]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = text;
            }
        });
    }

    bindEvents() {
        this.elements.importBtn.addEventListener('click', () => this.handleImport());
        this.elements.createNotebookBtn.addEventListener('click', () => this.handleCreateNotebook());
        this.elements.openNotebookLM.addEventListener('click', () => this.openNotebookLM());
        this.elements.openNotebook.addEventListener('click', () => this.openNotebook());
        this.elements.notebookSelect.addEventListener('change', (e) => {
            this.selectedNotebook = e.target.value;
            this.elements.importBtn.disabled = !this.selectedNotebook;
        });
        this.elements.autoAudio.addEventListener('change', (e) => {
            this.settings.autoAudioOverview = e.target.checked;
            this.saveSettings();
        });
    }

    async initialize() {
        try {
            this.showState('loading');
            
            // Get current page info
            const pageInfo = await getCurrentPageContent();
            this.pageInfo = pageInfo;
            
            this.elements.pageTitle.textContent = pageInfo.title;
            this.elements.pageUrl.textContent = pageInfo.url;
            
            // Initialize NotebookLM client
            this.client = await NotebookLMClient.create();
            
            // Load notebooks
            await this.loadNotebooks();
            
            this.showState('main');
            
        } catch (error) {
            console.error('Initialization error:', error);
            this.showError(error.message);
        }
    }

    async loadNotebooks() {
        try {
            this.notebooks = await this.client.listNotebooks();
            
            const select = this.elements.notebookSelect;
            select.innerHTML = '';
            
            if (this.notebooks.length === 0) {
                const option = document.createElement('option');
                option.value = '';
                option.textContent = chrome.i18n.getMessage('popup_noNotebooks') || 'No notebooks found';
                select.appendChild(option);
            } else {
                // Add default option
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = chrome.i18n.getMessage('popup_selectNotebook') || 'Select a notebook...';
                select.appendChild(defaultOption);
                
                // Add notebooks
                this.notebooks.forEach(notebook => {
                    const option = document.createElement('option');
                    option.value = notebook.id;
                    option.textContent = `${notebook.emoji} ${notebook.title}`;
                    select.appendChild(option);
                });
                
                // Auto-select first notebook
                if (this.notebooks.length > 0) {
                    select.value = this.notebooks[0].id;
                    this.selectedNotebook = this.notebooks[0].id;
                    this.elements.importBtn.disabled = false;
                }
            }
        } catch (error) {
            console.error('Error loading notebooks:', error);
            throw error;
        }
    }

    async handleImport() {
        if (!this.selectedNotebook || !this.pageInfo) return;
        
        try {
            this.setButtonLoading(this.elements.importBtn, true);
            
            await this.client.addTextSource(
                this.selectedNotebook,
                this.pageInfo.title,
                this.pageInfo.content
            );
            
            if (this.settings.autoAudioOverview) {
                try {
                    await this.client.createAudioOverview(this.selectedNotebook);
                } catch (error) {
                    console.warn('Failed to create audio overview:', error);
                }
            }
            
            this.notebookLink = `https://notebooklm.google.com/notebook/${this.selectedNotebook}`;
            this.showState('success');
            
        } catch (error) {
            console.error('Import error:', error);
            this.showError('Failed to import content: ' + error.message);
        } finally {
            this.setButtonLoading(this.elements.importBtn, false);
        }
    }

    async handleCreateNotebook() {
        if (!this.pageInfo) return;
        
        try {
            this.setButtonLoading(this.elements.createNotebookBtn, true);
            
            const title = this.pageInfo.title || chrome.i18n.getMessage('popup_defaultNotebookTitle') || 'Imported Content';
            const result = await this.client.createNotebook(title, '📔');
            
            await this.client.addTextSource(
                result.id,
                this.pageInfo.title,
                this.pageInfo.content
            );
            
            if (this.settings.autoAudioOverview) {
                try {
                    await this.client.createAudioOverview(result.id);
                } catch (error) {
                    console.warn('Failed to create audio overview:', error);
                }
            }
            
            this.notebookLink = `https://notebooklm.google.com/notebook/${result.id}`;
            this.showState('success');
            
        } catch (error) {
            console.error('Create notebook error:', error);
            this.showError('Failed to create notebook: ' + error.message);
        } finally {
            this.setButtonLoading(this.elements.createNotebookBtn, false);
        }
    }

    showState(state) {
        // Hide all states
        this.elements.status.classList.add('hidden');
        this.elements.mainContent.classList.add('hidden');
        this.elements.success.classList.add('hidden');
        
        // Show specific state
        switch (state) {
            case 'loading':
                this.elements.status.classList.remove('hidden');
                this.elements.loading.classList.remove('hidden');
                this.elements.error.classList.add('hidden');
                break;
            case 'error':
                this.elements.status.classList.remove('hidden');
                this.elements.loading.classList.add('hidden');
                this.elements.error.classList.remove('hidden');
                break;
            case 'main':
                this.elements.mainContent.classList.remove('hidden');
                break;
            case 'success':
                this.elements.success.classList.remove('hidden');
                break;
        }
    }

    showError(message) {
        this.elements.error.querySelector('#error-text').textContent = message;
        this.showState('error');
    }

    setButtonLoading(button, loading) {
        if (loading) {
            button.classList.add('loading');
            button.disabled = true;
        } else {
            button.classList.remove('loading');
            button.disabled = false;
        }
    }

    openNotebookLM() {
        chrome.tabs.create({ url: 'https://notebooklm.google.com/' });
        window.close();
    }

    openNotebook() {
        if (this.notebookLink) {
            chrome.tabs.create({ url: this.notebookLink });
            window.close();
        }
    }

    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['autoAudioOverview']);
            this.settings.autoAudioOverview = result.autoAudioOverview || false;
            this.elements.autoAudio.checked = this.settings.autoAudioOverview;
        } catch (error) {
            console.error('Error loading settings:', error);
        }
    }

    async saveSettings() {
        try {
            await chrome.storage.local.set({
                autoAudioOverview: this.settings.autoAudioOverview
            });
        } catch (error) {
            console.error('Error saving settings:', error);
        }
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupUI();
});