(async function () {
    'use strict';

    if (window.__notebooklmToolkitContentScriptLoaded) {
        return;
    }
    window.__notebooklmToolkitContentScriptLoaded = true;

    const DEBUG = false;

    const hotkeyHandlers = [
        { test: matchHotkey({ ctrl: true, alt: true }, 'b'), handler: handleCtrlAltB },
    ];
    const MINDMAP_COPY_BUTTON_CLASS = 'copy-mindmap-btn';
    const MINDMAP_COPY_MESSAGE_SOURCE = 'notebooklm-toolkit';
    const NOTEBOOKLM_ORIGIN = 'https://notebooklm.google.com';
    const NOTEBOOKLM_APP_FRAME_SELECTOR = 'iframe[src*=".usercontent.goog"]';
    let lastPostedMindmapMarkdown = '';
    let lastPostedMindmapMarkdownAt = 0;
    const artifactViewerMindmapMarkdown = {
        iframeSrc: '',
        markdown: '',
        nodeCount: 0,
        loading: false,
        lastRequestedAt: 0,
        lastSuccessAt: 0,
        error: ''
    };

    registerMindmapClipboardBridge();

    function findEpisodeFocusTextarea(root) {
        const scope = root || document;
        const dialog = scope.matches?.('configurable-form-dialog, artifact-customization-dialog')
            ? scope
            : scope.querySelector?.('configurable-form-dialog') ||
            scope.querySelector?.('artifact-customization-dialog');
        if (!dialog) return null;

        const textareas = dialog.querySelectorAll('textarea');
        if (!textareas.length) return null;

        const filled = Array.from(textareas).filter(ta => ta.value && ta.value.trim().length > 0);
        if (filled.length > 0) {
            return filled[filled.length - 1];
        }

        return textareas[textareas.length - 1];
    }



    setInterval(async () => {
        const svg = findMindMapSvg();
        if (svg) {
            await insertDownloadMarkdownButton(svg);
            publishMindmapMarkdownToParent(svg);
        }
        await insertArtifactViewerMindmapCopyButton();
        refreshArtifactViewerMindmapMarkdown();

        // Check for custom dialog and add event listener
        monitorCustomVoiceSummaryDialog();

        const divPanelFooter = findPanelFooter();
        if (divPanelFooter) {
            const editor = divPanelFooter.previousElementSibling?.querySelector('markdown-editor-legacy') ||
                divPanelFooter.previousElementSibling?.querySelector('labs-tailwind-doc-viewer');
            if (editor && !editor.querySelector('.copy-note-html-btn')) {
                // console.log('Inserting copy button into editor:', editor);

                // 建立按鈕
                const copyBtn = document.createElement('button');
                copyBtn.className = 'copy-note-html-btn mdc-icon-button mat-mdc-icon-button mat-mdc-button-base mat-mdc-tooltip-trigger note-editor-delete-button note-editor-delete-button-3panel mat-primary cdk-focused cdk-mouse-focused';
                copyBtn.style.position = 'absolute';
                copyBtn.style.top = '0px';
                copyBtn.style.right = '0px';
                copyBtn.style.zIndex = '10';
                copyBtn.style.display = '';
                copyBtn.style.background = 'transparent';
                copyBtn.style.border = 'none';
                copyBtn.style.cursor = 'pointer';
                copyBtn.style.padding = '4px';

                // 建立 mat-icon
                const matIcon = document.createElement('mat-icon');
                matIcon.className = 'mat-icon notranslate material-symbols-outlined google-symbols mat-icon-no-color';
                matIcon.textContent = 'content_copy';
                matIcon.title = chrome.i18n.getMessage('copy_content');
                copyBtn.appendChild(matIcon);

                // 點擊複製
                copyBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    // clone editor element
                    const clonedEditor = editor.cloneNode(true); // 複製含子元素
                    // console.log('已複製 editor 元素:', clonedEditor);

                    // 把所有資料來源引用移除，移除所有 span.ng-star-inserted 元素
                    const starInsertedButtons = clonedEditor.querySelectorAll('span.ng-star-inserted > button.ng-star-inserted');
                    // console.log(`將移除 ${starInsertedButtons.length} 個 button.ng-star-inserted 元素`);
                    starInsertedButtons.forEach(btn => {
                        let span = btn.parentElement;
                        span.remove();
                    });

                    // 移除自訂按鈕
                    const buttonsToRemove = clonedEditor.querySelectorAll('button');
                    // console.log(`將移除 ${buttonsToRemove.length} 個自訂按鈕`);
                    buttonsToRemove.forEach(span => {
                        span.remove();
                    });

                    const cleanedClonedEditor = await cleanHtml(clonedEditor);

                    // console.log('已移除 span.ng-star-inserted 和自訂按鈕，準備複製 HTML 到剪貼簿。', cleanedClonedEditor);
                    await copyHtmlAsRichText(cleanedClonedEditor.outerHTML);
                });

                // 設定 markdownEditor 為 relative 以便定位
                editor.style.position = 'relative';

                // hover 顯示按鈕
                editor.addEventListener('mouseenter', () => {
                    copyBtn.style.display = '';
                });
                editor.addEventListener('mouseleave', () => {
                    copyBtn.style.display = 'none';
                });

                // 插入按鈕
                editor.style.paddingRight = '40px';
                editor.appendChild(copyBtn);
            }
        }
    }, 1000);



    function findMindMapSvg(event) {
        const svgs = Array.from(document.querySelectorAll('svg'));
        const mindmapSvgs = svgs.filter(svg =>
            svg.querySelector('g.node text.node-name') &&
            svg.querySelector('path.link')
        );

        if (mindmapSvgs.length > 0) {
            return findLargestVisibleElement(mindmapSvgs);
        }

        const matchingSvgs = svgs.filter(svg => {
            const width = svg.getAttribute('width');
            const height = svg.getAttribute('height');
            return width === '100%' && height === '100%';
        });

        if (matchingSvgs.length === 1) {
            return matchingSvgs[0];
        }

        return null;
    }

    async function insertArtifactViewerMindmapCopyButton() {
        if (window.top !== window) {
            return;
        }

        const iframe = document.querySelector(NOTEBOOKLM_APP_FRAME_SELECTOR);
        if (!iframe) {
            return;
        }

        const artifactViewer = iframe.closest('artifact-viewer') || document.querySelector('artifact-viewer');
        const header = artifactViewer?.querySelector('.artifact-header') || document.querySelector('.artifact-header');
        if (!header || header.querySelector(`.${MINDMAP_COPY_BUTTON_CLASS}`)) {
            return;
        }

        const referenceButton = findArtifactHeaderReferenceButton(header);
        const button = referenceButton ? referenceButton.cloneNode(true) : createMindmapCopyButton();

        prepareMindmapCopyButton(button);
        button.addEventListener('click', async event => {
            event.preventDefault();
            event.stopPropagation();

            const markdown = artifactViewerMindmapMarkdown.markdown;
            if (!markdown) {
                refreshArtifactViewerMindmapMarkdown(true);
                showMindmapCopyFeedback(button, false);
                return;
            }

            const copied = await writeTextToClipboard(markdown);
            showMindmapCopyFeedback(button, copied);
        });

        header.insertBefore(button, referenceButton || null);
        refreshArtifactViewerMindmapMarkdown(true);
    }

    async function refreshArtifactViewerMindmapMarkdown(force = false) {
        if (window.top !== window) {
            return null;
        }

        const iframe = document.querySelector(NOTEBOOKLM_APP_FRAME_SELECTOR);
        if (!iframe) {
            resetArtifactViewerMindmapCache();
            updateArtifactViewerMindmapButtons();
            return null;
        }

        const src = iframe.getAttribute('src') || '';
        if (artifactViewerMindmapMarkdown.iframeSrc !== src) {
            resetArtifactViewerMindmapCache(src);
        }

        const now = Date.now();
        if (artifactViewerMindmapMarkdown.loading) {
            return artifactViewerMindmapMarkdown.markdown || null;
        }
        if (!force && artifactViewerMindmapMarkdown.markdown) {
            return artifactViewerMindmapMarkdown.markdown;
        }
        if (!force && now - artifactViewerMindmapMarkdown.lastRequestedAt < 2000) {
            return artifactViewerMindmapMarkdown.markdown || null;
        }

        const requested = requestMindmapMarkdownFromFrame(iframe);
        if (requested) {
            artifactViewerMindmapMarkdown.loading = true;
            artifactViewerMindmapMarkdown.lastRequestedAt = now;
            artifactViewerMindmapMarkdown.error = '';
            updateArtifactViewerMindmapButtons();
            window.setTimeout(() => {
                if (artifactViewerMindmapMarkdown.loading &&
                    artifactViewerMindmapMarkdown.lastRequestedAt === now) {
                    artifactViewerMindmapMarkdown.loading = false;
                    if (!artifactViewerMindmapMarkdown.markdown) {
                        artifactViewerMindmapMarkdown.error = 'Mindmap markdown unavailable.';
                    }
                    updateArtifactViewerMindmapButtons();
                }
            }, 1500);
        } else if (!artifactViewerMindmapMarkdown.markdown) {
            artifactViewerMindmapMarkdown.error = 'Mindmap frame unavailable.';
            updateArtifactViewerMindmapButtons();
        }

        return artifactViewerMindmapMarkdown.markdown || null;
    }

    function requestMindmapMarkdownFromFrame(iframe) {
        if (!iframe?.contentWindow) {
            return false;
        }

        iframe.contentWindow.postMessage({
            source: MINDMAP_COPY_MESSAGE_SOURCE,
            type: 'requestMindmapMarkdown'
        }, getMindmapFrameTargetOrigin(iframe));
        return true;
    }

    function getMindmapFrameTargetOrigin(iframe) {
        const src = iframe.getAttribute('src') || '';
        try {
            const url = new URL(src);
            if (url.protocol === 'blob:') {
                return new URL(url.pathname).origin;
            }
            return url.origin;
        } catch (_error) {
            return '*';
        }
    }

    function resetArtifactViewerMindmapCache(iframeSrc = '') {
        artifactViewerMindmapMarkdown.iframeSrc = iframeSrc;
        artifactViewerMindmapMarkdown.markdown = '';
        artifactViewerMindmapMarkdown.nodeCount = 0;
        artifactViewerMindmapMarkdown.loading = false;
        artifactViewerMindmapMarkdown.lastRequestedAt = 0;
        artifactViewerMindmapMarkdown.lastSuccessAt = 0;
        artifactViewerMindmapMarkdown.error = '';
    }

    function updateArtifactViewerMindmapButtons() {
        document.querySelectorAll(`.${MINDMAP_COPY_BUTTON_CLASS}`).forEach(button => {
            button.dataset.mindmapReady = artifactViewerMindmapMarkdown.markdown ? 'true' : 'false';
            button.dataset.mindmapLoading = artifactViewerMindmapMarkdown.loading ? 'true' : 'false';
            button.dataset.mindmapNodeCount = String(artifactViewerMindmapMarkdown.nodeCount || 0);
            if (artifactViewerMindmapMarkdown.error) {
                button.dataset.mindmapError = artifactViewerMindmapMarkdown.error;
            } else {
                delete button.dataset.mindmapError;
            }
        });
    }

    function findArtifactHeaderReferenceButton(header) {
        return header.querySelector('button[aria-label="更多選項"], button[mattooltip="更多選項"]') ||
            header.querySelector('button[aria-label="展開"], button[mattooltip="展開檢視工具"]') ||
            header.querySelector('button');
    }

    async function insertDownloadMarkdownButton(svgElement) {
        if (!svgElement || document.querySelector(`.${MINDMAP_COPY_BUTTON_CLASS}`)) {
            return;
        }

        const insertionPoint = findMindmapButtonInsertionPoint();
        let data = {}; // Initialize data object

        if (insertionPoint) {
            const { container, referenceButton, sourceButton } = insertionPoint;
            const clonedButton = sourceButton ? sourceButton.cloneNode(true) : createMindmapCopyButton();

            prepareMindmapCopyButton(clonedButton);
            clonedButton.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();

                const currentSvgElement = findMindMapSvg() || svgElement;
                const markdownOutput = convertMindmapToMarkdown(currentSvgElement.outerHTML);
                const copied = await copyMindmapMarkdown(markdownOutput);
                showMindmapCopyFeedback(clonedButton, copied);
            });

            container.insertBefore(clonedButton, referenceButton || null);
            data = {
                success: true,
                message: 'Mindmap copy button inserted successfully.'
            };
        } else {
            data = {
                success: false,
                message: 'Mindmap action container not found.'
            };
        }
        data; // Return the data object
    }

    function findLargestVisibleElement(elements) {
        return elements
            .map(element => {
                const rect = element.getBoundingClientRect();
                return { element, area: rect.width * rect.height };
            })
            .filter(item => item.area > 0)
            .sort((a, b) => b.area - a.area)[0]?.element || elements[0] || null;
    }

    function findMindmapButtonInsertionPoint() {
        const mindmapActionsDiv = document.querySelector('.mindmap-actions');
        if (mindmapActionsDiv) {
            const buttons = mindmapActionsDiv.querySelectorAll('button');
            if (buttons.length >= 2) {
                return {
                    container: mindmapActionsDiv,
                    referenceButton: buttons[1],
                    sourceButton: buttons[1]
                };
            }
            if (buttons.length === 1) {
                return {
                    container: mindmapActionsDiv,
                    referenceButton: buttons[0],
                    sourceButton: buttons[0]
                };
            }
        }

        const downloadButton = findMindmapActionButton('download');
        if (downloadButton?.parentElement) {
            return {
                container: downloadButton.parentElement,
                referenceButton: downloadButton,
                sourceButton: downloadButton
            };
        }

        const buttons = Array.from(document.querySelectorAll('button'));
        const visibleButtons = buttons.filter(button => {
            const rect = button.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0;
        });

        if (visibleButtons.length > 0) {
            const sourceButton = visibleButtons[visibleButtons.length - 1];
            return {
                container: sourceButton.parentElement,
                referenceButton: sourceButton.nextSibling,
                sourceButton
            };
        }

        return null;
    }

    function findMindmapActionButton(action) {
        const actionText = action.toLowerCase();
        return Array.from(document.querySelectorAll('button')).find(button => {
            const label = [
                button.getAttribute('aria-label'),
                button.getAttribute('title'),
                button.getAttribute('mattooltip'),
                button.textContent
            ].filter(Boolean).join(' ').trim().toLowerCase();

            return label.includes(actionText) ||
                (actionText === 'download' && (label.includes('下載') || label.includes('download mindmap')));
        });
    }

    function createMindmapCopyButton() {
        const button = document.createElement('button');
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined google-symbols';
        icon.textContent = 'content_copy';
        button.appendChild(icon);
        return button;
    }

    function prepareMindmapCopyButton(button) {
        const label = chrome.i18n.getMessage('copy_mindmap_content') || 'Copy Mindmap Content';
        button.classList.add(MINDMAP_COPY_BUTTON_CLASS);
        button.type = 'button';
        button.removeAttribute('id');
        button.removeAttribute('aria-describedby');
        button.removeAttribute('cdk-describedby-host');
        button.removeAttribute('aria-haspopup');
        button.removeAttribute('aria-expanded');
        button.removeAttribute('jslog');
        button.setAttribute('aria-label', label);
        button.setAttribute('title', label);
        button.setAttribute('mattooltip', label);

        const iconElement = findIconElement(button);
        if (iconElement) {
            iconElement.textContent = 'content_copy';
            iconElement.setAttribute('title', label);
        } else {
            button.textContent = '';
            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined google-symbols';
            icon.textContent = 'content_copy';
            button.appendChild(icon);
        }
    }

    function findIconElement(button) {
        return button.querySelector('mat-icon, .mat-icon, .material-symbols-outlined, .google-symbols') ||
            Array.from(button.children).find(child => {
                const text = child.textContent?.trim();
                return text === 'download' || text === 'sim_card_download' || text === 'content_copy';
            });
    }

    function copyTextWithExecCommand(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-1000px';
        textarea.style.left = '-1000px';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);

        const selection = document.getSelection();
        const selectedRanges = [];
        if (selection) {
            for (let i = 0; i < selection.rangeCount; i++) {
                selectedRanges.push(selection.getRangeAt(i));
            }
        }

        try {
            textarea.focus();
            textarea.select();
            return document.execCommand('copy');
        } catch (err) {
            console.error('寫入剪貼簿失敗:', err);
            return false;
        } finally {
            textarea.remove();
            if (selection) {
                selection.removeAllRanges();
                selectedRanges.forEach(range => selection.addRange(range));
            }
        }
    }

    async function writeTextToClipboard(text) {
        if (!text) {
            return false;
        }

        if (copyTextWithExecCommand(text)) {
            return true;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            try {
                await navigator.clipboard.writeText(text);
                return true;
            } catch (err) {
                console.error('寫入剪貼簿失敗:', err);
            }
        }

        return false;
    }

    async function copyMindmapMarkdown(markdownOutput) {
        if (window.top !== window) {
            const parentCopied = await requestParentMindmapClipboardWrite(markdownOutput);
            if (parentCopied) {
                return true;
            }
        }

        return writeTextToClipboard(markdownOutput);
    }

    function requestParentMindmapClipboardWrite(text) {
        if (!window.parent || window.parent === window) {
            return Promise.resolve(false);
        }

        return new Promise(resolve => {
            const requestId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            let settled = false;

            const cleanup = () => {
                settled = true;
                window.removeEventListener('message', handleResponse);
            };

            const timeoutId = window.setTimeout(() => {
                if (!settled) {
                    cleanup();
                    resolve(false);
                }
            }, 1500);

            function handleResponse(event) {
                const data = event.data;
                if (!data ||
                    data.source !== MINDMAP_COPY_MESSAGE_SOURCE ||
                    data.type !== 'copyMindmapMarkdownResult' ||
                    data.requestId !== requestId) {
                    return;
                }

                window.clearTimeout(timeoutId);
                cleanup();
                resolve(Boolean(data.success));
            }

            window.addEventListener('message', handleResponse);
            window.parent.postMessage({
                source: MINDMAP_COPY_MESSAGE_SOURCE,
                type: 'copyMindmapMarkdown',
                requestId,
                text
            }, NOTEBOOKLM_ORIGIN);
        });
    }

    function registerMindmapClipboardBridge() {
        if (window.top !== window) {
            window.addEventListener('message', event => {
                const data = event.data;
                if (event.origin !== NOTEBOOKLM_ORIGIN ||
                    !data ||
                    data.source !== MINDMAP_COPY_MESSAGE_SOURCE ||
                    data.type !== 'requestMindmapMarkdown') {
                    return;
                }

                const svgElement = findMindMapSvg();
                if (svgElement) {
                    publishMindmapMarkdownToParent(svgElement, true);
                }
            });
            return;
        }

        window.addEventListener('message', async event => {
            if (!isMindmapFrameMessage(event)) {
                return;
            }

            const data = event.data;
            if (!data || data.source !== MINDMAP_COPY_MESSAGE_SOURCE) {
                return;
            }

            if (data.type === 'mindmapMarkdownAvailable' && typeof data.text === 'string') {
                artifactViewerMindmapMarkdown.markdown = data.text;
                artifactViewerMindmapMarkdown.nodeCount = data.nodeCount || 0;
                artifactViewerMindmapMarkdown.loading = false;
                artifactViewerMindmapMarkdown.lastSuccessAt = Date.now();
                artifactViewerMindmapMarkdown.error = '';
                updateArtifactViewerMindmapButtons();
                return;
            }

            if (data.type !== 'copyMindmapMarkdown' || typeof data.text !== 'string') {
                return;
            }

            const success = await writeTextToClipboard(data.text);
            const responseOrigin = event.origin && event.origin !== 'null' ? event.origin : '*';
            event.source?.postMessage({
                source: MINDMAP_COPY_MESSAGE_SOURCE,
                type: 'copyMindmapMarkdownResult',
                requestId: data.requestId,
                success
            }, responseOrigin);
        });
    }

    function isMindmapFrameMessage(event) {
        if (typeof event.origin === 'string' && event.origin.endsWith('.usercontent.goog')) {
            return true;
        }

        return Array.from(document.querySelectorAll(NOTEBOOKLM_APP_FRAME_SELECTOR))
            .some(iframe => iframe.contentWindow === event.source);
    }

    function publishMindmapMarkdownToParent(svgElement, force = false) {
        if (window.top === window || !window.parent || !svgElement) {
            return;
        }

        const now = Date.now();
        const markdownOutput = convertMindmapToMarkdown(svgElement.outerHTML);
        if (!markdownOutput) {
            return;
        }
        if (!force && markdownOutput === lastPostedMindmapMarkdown && now - lastPostedMindmapMarkdownAt < 5000) {
            return;
        }

        lastPostedMindmapMarkdown = markdownOutput;
        lastPostedMindmapMarkdownAt = now;
        window.parent.postMessage({
            source: MINDMAP_COPY_MESSAGE_SOURCE,
            type: 'mindmapMarkdownAvailable',
            text: markdownOutput,
            nodeCount: svgElement.querySelectorAll('g.node').length
        }, NOTEBOOKLM_ORIGIN);
    }

    function showMindmapCopyFeedback(button, copied = true) {
        const iconElement = findIconElement(button);
        if (!iconElement) return;

        iconElement.textContent = copied ? 'check' : 'error';
        window.setTimeout(() => {
            iconElement.textContent = 'content_copy';
        }, 1200);
    }

    async function handleCtrlAltB() {
        const svgElement = findMindMapSvg();
        if (!svgElement) return;

        const markdownOutput = convertMindmapToMarkdown(svgElement.outerHTML);
        // console.log(markdownOutput);
    }

    document.addEventListener("keydown", async (event) => {
        for (const { test, handler } of hotkeyHandlers) {
            if (test(event)) {
                await handler(event);
                break;
            }
        }
    });

    function isInInputMode(element) {
        if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
            return true;
        }
        if (element.isContentEditable) {
            return true;
        }
        if (element.shadowRoot instanceof ShadowRoot || (element.getRootNode && element.getRootNode() instanceof ShadowRoot)) {
            return true;
        }
        return false;
    }

    function isCtrlOrMetaKeyPressed(event) {
        return event.ctrlKey || event.metaKey;
    }

    async function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function simulateMouseClick(element) {
        if (!element) return;

        const mouseEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true
        });

        // console.log('simulateMouseClick', element);

        element.dispatchEvent(mouseEvent);
    }

    function simulateKeyPress(element, key) {
        if (!element) return;

        const keyEvent = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: key
        });

        // console.log('simulateKeyPress', element);

        element.dispatchEvent(keyEvent);
    }

    function matchHotkey({ ctrl = false, alt = false }, keyCheck) {
        return e => (
            (ctrl ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey)) &&
            e.altKey === alt &&
            (typeof keyCheck === 'string' ? e.key === keyCheck : keyCheck(e))
        );
    }
    /**
     * Represents a node in the mindmap.
     */
    class MindmapNode {
        /**
         * @param {string} name - The text content of the node.
         * @param {number} g_x - The x-coordinate from the node's <g> transform.
         * @param {number} g_y - The y-coordinate from the node's <g> transform.
         * @param {number} rect_width - The width of the node's rect element.
         * @param {number} rect_height - The height of the node's rect element.
         */
        constructor(name, g_x, g_y, rect_width, rect_height) {
            this.name = name;
            this.g_x = g_x;
            this.g_y = g_y;
            this.rect_width = rect_width;
            this.rect_height = rect_height;
            this.children = [];
        }
    }

    /**
     * Converts an SVG string representing a mindmap into a Markdown hierarchical list.
     * @param {string} svgString - The SVG content as a string.
     * @returns {string} The mindmap structure in Markdown format.
     */
    function convertMindmapToMarkdown(svgString) {
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(svgString, "image/svg+xml");
        const gNodes = svgDoc.querySelectorAll('g.node');
        const pathLinks = svgDoc.querySelectorAll('path.link');

        const nodeMap = new Map(); // Map: nodeName -> MindmapNode object (for quick lookup by name)
        // Map: roundedGx -> Map: roundedGy -> MindmapNode[] (for lookup by coordinates)
        const nodesByRoundedCoords = new Map();
        const allNodes = []; // Flat list of all node objects

        const epsilon = 10; // Tolerance for coordinate matching (e.g., to handle minor float differences)

        // 1. Parse all nodes and store them
        gNodes.forEach(g => {
            const transformAttr = g.getAttribute('transform');
            const translateMatch = transformAttr.match(/translate\(([^,]+),([^)]+)\)/);
            if (!translateMatch) return;

            const g_x = parseFloat(translateMatch[1]);
            const g_y = parseFloat(translateMatch[2]);

            const nodeNameText = g.querySelector('text.node-name');
            if (!nodeNameText) return;
            const name = nodeNameText.textContent.trim();

            const rect = g.querySelector('rect');
            const rect_width = rect ? parseFloat(rect.getAttribute('width')) : 0;
            const rect_height = rect ? parseFloat(rect.getAttribute('height')) : 0;

            const node = new MindmapNode(name, g_x, g_y, rect_width, rect_height);
            nodeMap.set(name, node);
            allNodes.push(node);

            const roundedGx = Math.round(g_x);
            const roundedGy = Math.round(g_y);

            if (!nodesByRoundedCoords.has(roundedGx)) {
                nodesByRoundedCoords.set(roundedGx, new Map());
            }
            if (!nodesByRoundedCoords.get(roundedGx).has(roundedGy)) {
                nodesByRoundedCoords.get(roundedGx).set(roundedGy, []);
            }
            nodesByRoundedCoords.get(roundedGx).get(roundedGy).push(node);
        });

        // Get sorted unique g_x coordinates, representing the levels/columns of the mindmap
        const levels = Array.from(nodesByRoundedCoords.keys()).sort((a, b) => a - b);

        // 2. Establish Parent-Child Relationships
        pathLinks.forEach(path => {
            const dAttr = path.getAttribute('d');
            // Regex to extract M x1 y1 and the last C x4 y4 (end point)
            const dCoords = dAttr.match(/M\s*([-.\d]+)\s*([-.\d]+)\s*C.*,\s*([-.\d]+)\s*([-.\d]+)/);
            if (!dCoords) return;

            const x1 = parseFloat(dCoords[1]); // Link start X
            const y1 = parseFloat(dCoords[2]); // Link start Y
            const x4 = parseFloat(dCoords[3]); // Link end X
            const y4 = parseFloat(dCoords[4]); // Link end Y

            let sourceNode = null;
            let targetNode = null;

            // Find Source Node: It's typically on a level to the left of the link's start X (x1),
            // and its g_y should match the link's y1.
            for (const levelX of levels) {
                // Check if this level is a plausible source level (left of or very near link start X)
                if (levelX <= x1 + epsilon) {
                    const nodesAtLevelY = nodesByRoundedCoords.get(levelX)?.get(Math.round(y1));
                    if (nodesAtLevelY && nodesAtLevelY.length > 0) {
                        // Pick the node that is closest to x1 (often the right edge of the source node)
                        // In most mindmaps, there's only one node at a given (g_x, g_y) rounded coordinate.
                        sourceNode = nodesAtLevelY.reduce((prev, curr) =>
                            Math.abs((curr.g_x + curr.rect_width) - x1) < Math.abs((prev.g_x + prev.rect_width) - x1) ? curr : prev
                        );
                        break; // Found the level for the source, break outer loop
                    }
                }
            }

            // Find Target Node: It's typically on a level to the right of the link's start X (x1),
            // and its g_y should match the link's y4.
            for (const levelX of levels) {
                // Check if this level is a plausible target level (right of or very near link end X)
                // And also ensure it's to the right of the identified source node (if any)
                if (levelX >= x1 - epsilon) {
                    const nodesAtLevelY = nodesByRoundedCoords.get(levelX)?.get(Math.round(y4));
                    if (nodesAtLevelY && nodesAtLevelY.length > 0) {
                        // Pick the node that is closest to x4 (often the left edge of the target node)
                        targetNode = nodesAtLevelY.reduce((prev, curr) =>
                            Math.abs(curr.g_x - x4) < Math.abs(prev.g_x - x4) ? curr : prev
                        );
                        break; // Found the level for the target, break outer loop
                    }
                }
            }

            if (sourceNode && targetNode && sourceNode.g_x < targetNode.g_x) { // Ensure parent is to the left of child
                // Add targetNode to sourceNode's children, avoiding duplicates
                if (!sourceNode.children.includes(targetNode)) {
                    sourceNode.children.push(targetNode);
                }
            } else {
                // console.warn(`Could not unambiguously determine source/target for link (${x1},${y1}) -> (${x4},${y4})`);
                // console.warn(`Source found: ${sourceNode?.name}, Target found: ${targetNode?.name}`);
            }
        });

        // 3. Find the root node(s) (nodes with no parents)
        const childNodes = new Set();
        allNodes.forEach(node => {
            node.children.forEach(child => childNodes.add(child));
        });
        const rootNodes = allNodes.filter(node => !childNodes.has(node));

        // For a typical mindmap, there should be one central root.
        // If multiple roots are found, pick the leftmost one.
        const mainRoot = rootNodes.length > 0
            ? rootNodes.reduce((prev, curr) => (prev.g_x < curr.g_x ? prev : curr))
            : (allNodes.length > 0 ? allNodes[0] : null); // Fallback if no roots or no nodes

        if (!mainRoot) {
            return "No mindmap nodes found.";
        }

        // 4. Generate Markdown
        let markdown = '';

        /**
         * Recursively generates Markdown for a node and its children.
         * @param {MindmapNode} node - The current node to process.
         * @param {number} level - The current indentation level.
         */
        function generateMarkdown(node, level) {
            const indent = '  '.repeat(level); // 2 spaces per level
            markdown += `${indent}* ${node.name}\n`;

            // Sort children by their Y-coordinate for consistent vertical ordering in markdown
            node.children.sort((a, b) => a.g_y - b.g_y);

            node.children.forEach(child => {
                generateMarkdown(child, level + 1);
            });
        }

        // Start generating from the main root
        generateMarkdown(mainRoot, 0);

        return markdown;
    }




    function handleCtrlAltB() {
        // const divPanelFooter = findPanelFooter();
        // if (!divPanelFooter) return;
        // copyNodeToClipboard(divPanelFooter.previousElementSibling)
        // console.log('Inserting Copy Note HTML Button');
        // await InsertCopyNoteHTMLButton(divPanelFooter);
    }

    function findPanelFooter() {
        const footer = document.querySelector('div.panel-footer');
        if (footer) {
            return footer;
        } else {
            return null;
        }
    }

    async function copyNodeToClipboard(element) {
        const editor = element.querySelector('markdown-editor-legacy') || element.querySelector('note-editor');
        const success = await copyHtmlAsRichText(editor.outerHTML);
        if (success) {
            // console.log('HTML copied to clipboard successfully.');
        } else {
            console.error('Failed to copy HTML to clipboard.');
        }
    }

    async function copyHtmlAsRichText(html) {
        // Use the Clipboard API for modern browsers
        if (navigator.clipboard && navigator.clipboard.write) {
            try {
                // 建立 HTML Blob
                const htmlBlob = new Blob([html], { type: 'text/html' });

                const turndownService = new TurndownService({
                    headingStyle: 'atx',
                    hr: '- - -',
                    bulletListMarker: '-',
                    codeBlockStyle: 'fenced',
                    fence: '```',
                    emDelimiter: '_',
                    strongDelimiter: '**',
                    linkStyle: 'inlined',
                    linkReferenceStyle: 'full',
                    br: '  ',
                    preformattedCode: false
                });

                // 建立純文字 Blob
                const textBlob = new Blob([turndownService.turndown(html)], { type: 'text/plain' });

                // 建立 ClipboardItem，包含 text/html 與 text/plain
                const clipboardItem = new ClipboardItem({
                    'text/html': htmlBlob,
                    'text/plain': textBlob
                });

                // 寫入剪貼簿
                await navigator.clipboard.write([clipboardItem]);
                return true;
            } catch (err) {
                console.error('Failed to copy HTML to clipboard:', err);
                return false;
            }
        } else {
            // Fallback for older browsers
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            document.body.appendChild(tempDiv);
            const range = document.createRange();
            range.selectNode(tempDiv);
            window.getSelection().addRange(range);
            try {
                document.execCommand('copy');
                return true;
            } catch (err) {
                console.error('Failed to copy HTML to clipboard:', err);
                return false;
            } finally {
                document.body.removeChild(tempDiv);
            }
        }
    }

    async function cleanHtml(targetElement = document.documentElement) {
        // Create a clone to avoid modifying the live DOM
        const clonedElement = targetElement.cloneNode(true);

        // Function to find and remove all comment nodes
        function removeCommentNodes(root) {
            (function removeComments(node) {
                for (let i = node.childNodes.length - 1; i >= 0; i--) {
                    const child = node.childNodes[i];
                    if (child.nodeType === Node.COMMENT_NODE) {
                        node.removeChild(child);
                    } else {
                        removeComments(child);
                    }
                }
            })(root); // 或 document.documentElement
        }

        // Function to remove unwanted elements and clean attributes on ALL elements
        function cleanElements(root) {
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_ELEMENT,
                null,
                false
            );

            const elementsToProcess = [root];
            let currentNode;

            while (currentNode = walker.nextNode()) {
                elementsToProcess.push(currentNode);
            }

            for (let i = elementsToProcess.length - 1; i >= 0; i--) {
                const element = elementsToProcess[i];
                const tagName = element.tagName.toLowerCase();

                if (['script', 'style', 'link', 'meta', 'aside'].includes(tagName) ||
                    element.id === 'immersive-translate-browser-popup') {
                    if (element.parentNode) {
                        element.parentNode.removeChild(element);
                    }
                    continue;
                }

                const attributesToRemove = [];
                for (const attr of element.attributes) {
                    if (attr.name.startsWith('data-') || attr.name === 'style') {
                        attributesToRemove.push(attr.name);
                    }
                }
                attributesToRemove.forEach(attrName => element.removeAttribute(attrName));

                // Remove Tailwind CSS utility classes using patterns instead of hard-coded names
                if (element.hasAttribute('class')) {
                    // Matches variant prefixes like sm:, md:, hover:, dark:, etc.
                    const variantRE = /^(?:sm|md|lg|xl|2xl|hover|focus|active|disabled|visited|first|last|odd|even|dark|group|peer):+/;

                    // Matches core Tailwind utility prefixes
                    const utilityRE = new RegExp(
                        '^(?:' +
                        [
                            '-?m[trblxy]?', '-?p[trblxy]?',
                            'w', 'h', 'min-w', 'max-w', 'min-h', 'max-h',
                            'inset', 'inset-[xy]', 'top', 'bottom', 'left', 'right', 'start', 'end',
                            'flex', 'grid', 'col', 'row', 'gap', 'space',
                            'items', 'content', 'justify', 'self', 'place',
                            'order', 'basis', 'grow', 'shrink',
                            'text', 'font', 'leading', 'tracking', 'list', 'placeholder',
                            'bg', 'border', 'rounded', 'shadow', 'ring',
                            'object', 'overflow', 'z', 'opacity',
                            'transition', 'duration', 'delay', 'ease', 'animate',
                            'scale', 'rotate', 'translate', 'skew', 'origin',
                            'cursor', 'select', 'align', 'divide', 'outline', 'decoration', 'stroke', 'fill', 'fixed'
                        ].join('|') +
                        ')-?'
                    );

                    const filtered = Array.from(element.classList).filter(cls => {
                        let base = cls;
                        // Strip any variant prefixes (e.g., sm:hover:)
                        while (variantRE.test(base)) base = base.replace(variantRE, '');
                        // Keep the class only if it is NOT a Tailwind utility and NOT starting with '-'
                        return !utilityRE.test(base) && !base.startsWith('-') && !base.startsWith('[') && !base.indexOf(':') === -1;
                    });

                    if (filtered.length) {
                        element.className = filtered.join(' ');
                    } else {
                        element.removeAttribute('class');
                    }
                }
            }
        }

        function removeEmptyElements(root) {
            const walker = document.createTreeWalker(
                root,
                NodeFilter.SHOW_ELEMENT,
                null,
                false
            );
            const elements = [root];
            let node;
            while (node = walker.nextNode()) {
                elements.push(node);
            }
            let removed = false;
            for (let i = elements.length - 1; i >= 0; i--) {
                const el = elements[i];
                if (['br', 'img', 'input', 'hr', 'meta', 'link'].includes(el.tagName.toLowerCase())) continue;
                if (el.childElementCount === 0 && el.textContent.trim() === '') {
                    if (el.parentNode) {
                        el.parentNode.removeChild(el);
                        removed = true;
                    }
                }
            }
            return removed;
        }

        function organizeNotebookLMSpecificLayout(root) {
            const elements = root.querySelectorAll('labs-tailwind-structural-element-view-v2');

            for (const element of elements) {
                // Change child divs to spans
                const childDivs = element.querySelectorAll(':scope > div');
                for (let i = 0; i < childDivs.length; i++) {
                    const div = childDivs[i];
                    const span = document.createElement('span');
                    // Copy attributes
                    for (const attr of div.attributes) {
                        span.setAttribute(attr.name, attr.value);
                    }

                    // console.debug('div:', div, 'textContent:', div.textContent, 'childNodes:', div.childNodes);

                    // 如果是第一個 div 且只包含 '◦' (這個不是中文的句點喔)，則加一個空白
                    if (i === 0 && div.textContent.trim() === '◦' && div.childNodes.length === 1 && div.firstChild.nodeType === Node.TEXT_NODE) {
                        span.textContent = '◦ ';
                    } else {
                        // Append child nodes
                        while (div.firstChild) {
                            span.appendChild(div.firstChild);
                        }
                    }
                    div.replaceWith(span);
                }

                // Change labs-tailwind-structural-element-view-v2 to div
                const div = document.createElement('div');
                // Copy attributes
                for (const attr of element.attributes) {
                    div.setAttribute(attr.name, attr.value);
                }
                // Append child nodes
                while (element.firstChild) {
                    div.appendChild(element.firstChild);
                }
                element.replaceWith(div);
            }

            const data = { success: true };
        }

        removeCommentNodes(clonedElement);
        organizeNotebookLMSpecificLayout(clonedElement);
        cleanElements(clonedElement);

        // Recursively remove empty elements until no more are found
        while (removeEmptyElements(clonedElement)) { }

        return clonedElement;
    }

    // Throttling variables to prevent duplicate saves
    let lastSaveTime = 0;
    let lastSavedContent = '';
    let lastEpisodeTextareaAvailable = null;

    // Function to generate content hash for duplicate detection
    function generateContentHash(content) {
        let hash = 0;
        if (content.length === 0) return hash;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString();
    }

    function monitorCustomVoiceSummaryDialog() {
        try {
            // add: artifact-customization-dialog
            var dialog = document.querySelector('configurable-form-dialog') || document.querySelector('artifact-customization-dialog');
            if (!dialog) {
                notifyTextareaAvailability(false);
                return;
            }

            if (DEBUG) console.log('[DEBUG] Scanning page for textareas and buttons within dialog:', dialog);

            const allButtons = dialog.querySelectorAll('button');

            // Look for the custom dialog with multiple detection strategies
            let generateButton = null;

            const episodeFocusTextarea = findEpisodeFocusTextarea(dialog);
            if (DEBUG && episodeFocusTextarea) console.log('[DEBUG] Selected textarea in dialog:', {
                id: episodeFocusTextarea.getAttribute('id'),
                placeholder: episodeFocusTextarea.placeholder,
                value: episodeFocusTextarea.value
            });
            notifyTextareaAvailability(!!episodeFocusTextarea);

            // Gather potential generate buttons and pick the last one if multiple found
            const potentialGenerateButtons = Array.from(allButtons).filter(btn => {
                const text = btn.textContent?.trim();
                return text === '生成' || text === 'Generate' || text?.includes('生成') || text?.includes('Generate');
            });
            if (potentialGenerateButtons.length > 0) {
                generateButton = potentialGenerateButtons[potentialGenerateButtons.length - 1];
                if (DEBUG) console.log('[DEBUG] Selected last matching generate button in dialog:', {
                    text: generateButton.textContent?.trim(),
                    type: generateButton.type
                });
            }

            if (generateButton) {
                // Avoid registering the same handlers multiple times on the same element
                if (generateButton.dataset.notebooklmVoiceGenerateListenerAttached === 'true') {
                    if (DEBUG) console.log('[DEBUG] Listener already attached to generate button - skipping.');
                    return;
                }

                if (DEBUG) console.log('[DEBUG] 🎯 Adding click listener to generate button...');

                // Add click listener to the generate button using both click and mousedown for reliability
                const clickHandler = async function (event) {
                    event.preventDefault();

                    try {
                        // Find the active dialog and the current textarea when the event fires (not when handler was attached)
                        const parentDialog = event.target.closest('configurable-form-dialog, artifact-customization-dialog') || dialog;
                        const episodeFocusTextareaNow = findEpisodeFocusTextarea(parentDialog);

                        const now = Date.now();
                        const promptContent = episodeFocusTextareaNow?.value?.trim();

                        // 防止在 2 秒內重複儲存相同內容
                        const timeSinceLastSave = now - lastSaveTime;
                        const isSameContent = promptContent === lastSavedContent;
                        const tooSoon = timeSinceLastSave < 2000; // 2 seconds

                        if (isSameContent && tooSoon) {
                            if (DEBUG) console.log('[DEBUG] ⏱️ Throttled: Same content saved too recently');
                            return;
                        }

                        if (DEBUG) console.log('[DEBUG] 🔥 Generate button clicked! Event type:', event.type);
                        if (DEBUG) console.log('[DEBUG] Button clicked:', this);
                        if (DEBUG) console.log('[DEBUG] Current textarea used at click time:', episodeFocusTextareaNow);

                        if (DEBUG) console.log('[DEBUG] Textarea content at click time:', {
                            length: promptContent?.length || 0,
                            content: promptContent?.substring(0, 100) + '...'
                        });

                        if (promptContent && promptContent.length > 0) {
                            if (DEBUG) console.log('[DEBUG] 💾 Attempting to save prompt:', promptContent.substring(0, 50) + '...');

                            // 更新節流變數
                            lastSaveTime = now;
                            lastSavedContent = promptContent;

                            await saveCustomPrompt(promptContent);

                            // Try to refresh sidePanel if it's already open
                            try {
                                await chrome.runtime.sendMessage({
                                    type: 'refreshSidePanel',
                                    source: 'content-script'
                                });
                                if (DEBUG) console.log('[DEBUG] 🔄 Sent refresh message to sidePanel');
                            } catch (error) {
                                if (DEBUG) console.log('[DEBUG] 📄 SidePanel refresh message failed (probably not open):', error.message);
                            }
                        } else {
                            if (DEBUG) console.log('[DEBUG] ⚠️  No content to save - textarea is empty or whitespace only');

                            // Additional debugging: check if the textarea element is still valid
                            if (DEBUG) console.log('[DEBUG] Textarea validation:', {
                                exists: !!episodeFocusTextareaNow,
                                inDocument: document.contains(episodeFocusTextareaNow),
                                value: episodeFocusTextareaNow?.value,
                                valueLength: episodeFocusTextareaNow?.value?.length
                            });
                        }
                    } catch (error) {
                        if (DEBUG) console.error('[DEBUG] ❌ Error handling generate button click:', error);
                    }
                };

                // Attach once per button and mark as attached to avoid duplicates
                generateButton.addEventListener('click', clickHandler, { capture: true });
                generateButton.addEventListener('mousedown', clickHandler, { capture: true });
                generateButton.dataset.notebooklmVoiceGenerateListenerAttached = 'true';

                if (DEBUG) console.log('[DEBUG] ✅ Custom dialog listener added successfully');
            }
        } catch (error) {
            notifyTextareaAvailability(false);
            console.error('Error monitoring custom dialog:', error);
        }
    }

    // Function to extract notebook name from NotebookLM page
    function getNotebookName() {
        return document.title.replace(' - NotebookLM', '');
    }

    async function saveCustomPrompt(content) {
        try {
            if (DEBUG) console.log('[DEBUG] saveCustomPrompt called with content:', content.substring(0, 50) + '...');

            // Get existing prompts from storage
            const result = await chrome.storage.local.get(['customPrompts']);
            if (DEBUG) console.log('[DEBUG] Retrieved existing prompts from storage:', result);
            const prompts = result.customPrompts || [];
            if (DEBUG) console.log('[DEBUG] Current prompts count:', prompts.length);

            // Get notebook name and current URL
            const notebookName = getNotebookName();
            const currentUrl = window.location.href;
            const contentHash = generateContentHash(content);
            const now = Date.now();

            if (DEBUG) console.log('[DEBUG] Notebook name:', notebookName);
            if (DEBUG) console.log('[DEBUG] Current URL:', currentUrl);
            if (DEBUG) console.log('[DEBUG] Content hash:', contentHash);

            // 檢查是否存在相同的內容雜湊值和筆記本名稱
            const existingPrompt = prompts.find(p =>
                p.contentHash === contentHash &&
                p.notebookName === notebookName
            );

            if (existingPrompt) {
                // 更新現有提示的時間戳記而不是新增新的
                existingPrompt.timestamp = now;
                existingPrompt.url = currentUrl; // 更新 URL

                // 將更新的提示移至陣列開頭
                const index = prompts.indexOf(existingPrompt);
                prompts.splice(index, 1);
                prompts.unshift(existingPrompt);

                await chrome.storage.local.set({ customPrompts: prompts });

                if (DEBUG) console.log('[DEBUG] Updated existing prompt timestamp');
                console.log('ℹ️ 提示已存在，更新時間戳記');

                // 發送通知
                try {
                    const message = `${chrome.i18n.getMessage('custom_prompt_updated')} (${chrome.i18n.getMessage('prompts_count').replace('{count}', prompts.length)})`;
                    chrome.runtime.sendMessage({
                        type: 'showNotification',
                        message: message
                    });
                } catch (msgError) {
                    if (DEBUG) console.log('[DEBUG] Could not send update notification:', msgError);
                }

                return;
            }

            // 建立新的提示物件
            const newPrompt = {
                content: content,
                contentHash: contentHash,
                timestamp: now,
                notebookName: notebookName,
                url: currentUrl
            };
            if (DEBUG) console.log('[DEBUG] Created new prompt object:', newPrompt);

            await save(prompts, newPrompt);

        } catch (error) {
            console.error('❌ Error saving custom prompt:', error);
            // Optionally show a user-friendly notification
            try {
                chrome.runtime.sendMessage({
                    type: 'showNotification',
                    message: chrome.i18n.getMessage('error_saving_prompt') + ' ' + error.message
                });
            } catch (msgError) {
                // If messaging fails, that's okay - just log it
                console.error('Failed to send error notification:', msgError);
            }
        }

        async function save(prompts, newPrompt) {
            prompts.unshift(newPrompt); // Add to beginning of array
            if (DEBUG) console.log('[DEBUG] Added new prompt, total count now:', prompts.length);

            // Keep only the most recent 50 prompts to avoid storage bloat
            if (prompts.length > 50) {
                const removed = prompts.splice(50);
                if (DEBUG) console.log('[DEBUG] Removed', removed.length, 'old prompts to stay under limit');
            }

            // Save back to storage
            await chrome.storage.local.set({ customPrompts: prompts });
            if (DEBUG) console.log('[DEBUG] Saved prompts to storage successfully');

            // Verify the save by reading it back
            const verification = await chrome.storage.local.get(['customPrompts']);
            if (DEBUG) console.log('[DEBUG] Verification - prompts now in storage:', verification.customPrompts?.length || 0);

            if (DEBUG) console.log('✅ Custom prompt saved successfully. Total prompts:', prompts.length);

            // Send success notification
            try {
                const message = `${chrome.i18n.getMessage('custom_prompt_saved')} (${chrome.i18n.getMessage('prompts_count').replace('{count}', prompts.length)})`;
                chrome.runtime.sendMessage({
                    type: 'showNotification',
                    message: message
                });
            } catch (msgError) {
                if (DEBUG) console.log('[DEBUG] Could not send success notification:', msgError);
            }
        }
    }

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'applyPromptToEpisodeTextarea') {
            const targetTextarea = findEpisodeFocusTextarea();

            if (targetTextarea) {
                targetTextarea.focus();
                targetTextarea.value = message.content || '';
                targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                targetTextarea.dispatchEvent(new Event('change', { bubbles: true }));
                sendResponse({ success: true });
            } else {
                sendResponse({ success: false, error: 'textarea_not_found' });
            }
        }
        if (message.type === 'checkEpisodeTextareaAvailable') {
            const textarea = findEpisodeFocusTextarea();
            sendResponse({ success: true, available: !!textarea });
        }
    });

    function notifyTextareaAvailability(isAvailable) {
        if (lastEpisodeTextareaAvailable === isAvailable) return;
        lastEpisodeTextareaAvailable = isAvailable;
        try {
            chrome.runtime.sendMessage({
                type: 'episodeTextareaAvailability',
                available: isAvailable
            });
        } catch (e) {
            // ignore; sidepanel may not be open
        }
    }

})();
