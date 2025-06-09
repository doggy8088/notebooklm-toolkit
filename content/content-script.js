(async function () {
    'use strict';

    const DEBUG = false;

    const hotkeyHandlers = [
        { test: matchHotkey({ ctrl: true, alt: true }, 'a'), handler: handleCtrlAltA },
        { test: matchHotkey({ ctrl: true, alt: true }, 'b'), handler: handleCtrlAltB },
    ];

    let clonedButton = null;
    async function ToggleAllNodesButton() {
        const result = await InsertToggleAllNodesButton();
        if (result.success) {
            const zoomActionsDiv = document.querySelector('div.zoom-actions');
            if (zoomActionsDiv) {
                clonedButton = zoomActionsDiv.querySelector('button[data-open-all-btn]')?.closest('button');
            }
        }
    }

    setInterval(async () => {
        const svg = findMindMapSvg();
        if (svg) {
            if (!clonedButton || !document.body.contains(clonedButton)) {
                await ToggleAllNodesButton();
                await insertDownloadMarkdownButton(svg);
            }
        }

        // Check for custom voice summary dialog and add event listener
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

    async function InsertToggleAllNodesButton() {
        const zoomActionsDiv = document.querySelector('div.zoom-actions');
        if (zoomActionsDiv) {
            const buttons = zoomActionsDiv.querySelectorAll('button');
            if (buttons.length >= 2) {
                const firstButton = buttons[0];
                const secondButton = buttons[1];
                const clonedButton = firstButton.cloneNode(true); // 複製含子元素

                // 設定 data- 屬性標記這個複製的按鈕
                clonedButton.setAttribute('data-open-all-btn', 'true');

                // 修改複製按鈕內的 icon
                const iconElement = clonedButton.querySelector('mat-icon, i');
                if (iconElement) {
                    iconElement.textContent = 'open_with';
                } else {
                    if (clonedButton.firstElementChild) {
                        clonedButton.firstElementChild.textContent = 'open_with';
                    }
                }

                // 綁定 click 事件
                clonedButton.addEventListener('click', handleCtrlAltA);

                // 插入複製按鈕到第一、二個按鈕之間
                secondButton.parentNode.insertBefore(clonedButton, secondButton);

                const data = {
                    success: true,
                    message: '按鈕複製並插入成功。',
                    clonedButtonHTML: clonedButton.outerHTML
                };
                return data;
            } else {
                const data = {
                    success: false,
                    message: `在 .zoom-actions 內找到 ${buttons.length} 個按鈕，預期至少 2 個。`
                };
                return data;
            }
        } else {
            const data = {
                success: false,
                message: '找不到 class 為 "zoom-actions" 的 div。'
            };
            return data;
        }
    }

    function findMindMapSvg(event) {
        const svgs = document.querySelectorAll('svg');
        const matchingSvgs = [];

        svgs.forEach(svg => {
            const width = svg.getAttribute('width');
            const height = svg.getAttribute('height');
            if (width === '100%' && height === '100%') {
                matchingSvgs.push(svg);
            }
        });

        if (matchingSvgs.length === 1) {
            return matchingSvgs[0];
        }
    }

    async function insertDownloadMarkdownButton(svgElement) {
        const mindmapActionsDiv = document.querySelector('.mindmap-actions');
        let data = {}; // Initialize data object

        if (mindmapActionsDiv) {
            const buttons = mindmapActionsDiv.querySelectorAll('button');
            if (buttons.length >= 2) {
                const secondButton = buttons[1];
                const clonedButton = secondButton.cloneNode(true);

                clonedButton.addEventListener('click', async (event) => {
                    event.preventDefault();
                    const markdownOutput = convertMindmapToMarkdown(svgElement.outerHTML);

                    if (navigator.clipboard && navigator.clipboard.writeText) {
                        try {
                            await navigator.clipboard.writeText(markdownOutput);
                        } catch (err) {
                            console.error('寫入剪貼簿失敗:', err);
                        }
                    } else {
                        const textarea = document.createElement('textarea');
                        textarea.value = markdownOutput;
                        document.body.appendChild(textarea);
                        textarea.select();
                        try {
                            document.execCommand('copy');
                        } catch (err) {
                            console.error('寫入剪貼簿失敗:', err);
                        }
                        document.body.removeChild(textarea);
                    }

                    // const blob = new Blob([markdownOutput], { type: 'text/markdown' });
                    // const url = URL.createObjectURL(blob);
                    // const a = document.createElement('a');
                    // a.href = url;
                    // a.download = 'mindmap.md';
                    // document.body.appendChild(a);
                    // a.click();
                    // document.body.removeChild(a);
                    // URL.revokeObjectURL(url);
                });

                const matIconElement = clonedButton.querySelector('mat-icon');
                if (matIconElement) {
                    // https://marella.github.io/material-icons/demo/
                    matIconElement.textContent = 'content_copy';
                    matIconElement.title = chrome.i18n.getMessage('copy_mindmap_content');
                    data = {
                        success: true,
                        message: 'Button cloned and inserted successfully, mat-icon text updated.'
                    };
                } else {
                    const iconTextSpan = clonedButton.querySelector('.mat-icon');
                    if (iconTextSpan) {
                        iconTextSpan.textContent = 'sim_card_download';
                        data = {
                            success: true,
                            message: 'Button cloned and inserted successfully, .mat-icon text updated.'
                        };
                    } else {
                        data = {
                            success: false,
                            message: 'Could not find the mat-icon element or its text span within the cloned button.'
                        };
                    }
                }

                if (data.success) {
                    mindmapActionsDiv.insertBefore(clonedButton, secondButton);
                }

            } else {
                data = {
                    success: false,
                    message: 'Less than two buttons found within .mindmap-actions.'
                };
            }
        } else {
            data = {
                success: false,
                message: '.mindmap-actions element not found.'
            };
        }
        data; // Return the data object
    }

    async function handleCtrlAltA() {
        const svgElement = findMindMapSvg();
        if (!svgElement) return;

        let found;
        do {
            found = false;
            const gNodes = svgElement.querySelectorAll('g.node');
            gNodes.forEach(gNode => {
                const textNode = gNode.querySelector('text');
                if (textNode && textNode.textContent === '>') {
                    const circleNode = gNode.querySelector('circle');
                    if (circleNode) {
                        circleNode.dispatchEvent(new MouseEvent('click', {
                            bubbles: true,
                            cancelable: true
                        }));
                        found = true;
                    }
                }
            });
            // 等待 DOM 更新
            if (found) await delay(100);
        } while (found);
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

    // Track if we've already added listener to avoid duplicates
    let generateButtonListenerAdded = false;
    let lastGenerateButton = null;

    function monitorCustomVoiceSummaryDialog() {
        try {
            // Debug: Log all available elements periodically for troubleshooting
            if (Math.random() < 0.05) { // Reduced frequency to avoid spam
                const allTextareas = document.querySelectorAll('textarea');
                const allButtons = document.querySelectorAll('button');
                if (DEBUG) console.log(`[DEBUG] Page scan: ${allTextareas.length} textareas, ${allButtons.length} buttons`);

                // Log textareas with their attributes to help understand the structure
                allTextareas.forEach((ta, index) => {
                    if (ta.value && ta.value.trim().length > 10) { // Only log textareas with meaningful content
                        if (DEBUG) console.log(`[DEBUG] Textarea ${index}:`, {
                            placeholder: ta.placeholder,
                            formControlName: ta.getAttribute('formcontrolname'),
                            className: ta.className,
                            value: ta.value.substring(0, 50) + '...'
                        });
                    }
                });

                // Log buttons that might be generate buttons
                allButtons.forEach((btn, index) => {
                    const text = btn.textContent?.trim();
                    if (text && (text === '生成' || text === 'Generate' || text.includes('生成') || text.includes('Generate'))) {
                        if (DEBUG) console.log(`[DEBUG] Potential generate button ${index}:`, {
                            text: text,
                            className: btn.className,
                            type: btn.type,
                            outerHTML: btn.outerHTML.substring(0, 100) + '...'
                        });
                    }
                });
            }

            // Look for the custom voice summary dialog with multiple detection strategies
            let generateButton = null;
            let episodeFocusTextarea = null;

            // Strategy 1: Target specific NotebookLM dialog elements
            // Look for mat-dialog-container or similar dialog containers first
            const dialogContainers = document.querySelectorAll('mat-dialog-container, [role="dialog"], .cdk-overlay-pane');

            for (const dialog of dialogContainers) {
                // Look for textarea with custom focus content
                const textareas = dialog.querySelectorAll('textarea');
                const buttons = dialog.querySelectorAll('button');

                for (const textarea of textareas) {
                    // Check if this textarea might be for custom prompts
                    const hasCustomContent = textarea.value && textarea.value.trim().length > 0;
                    const hasRelevantAttributes =
                        textarea.getAttribute('formcontrolname')?.includes('episodeFocus') ||
                        textarea.getAttribute('formcontrolname')?.includes('focus') ||
                        textarea.placeholder?.toLowerCase().includes('focus') ||
                        textarea.placeholder?.toLowerCase().includes('自訂') ||
                        textarea.className?.toLowerCase().includes('focus') ||
                        textarea.className?.toLowerCase().includes('episode');

                    if (hasCustomContent || hasRelevantAttributes) {
                        episodeFocusTextarea = textarea;
                        if (DEBUG) console.log('[DEBUG] Found textarea in dialog using Strategy 1:', {
                            formControlName: textarea.getAttribute('formcontrolname'),
                            placeholder: textarea.placeholder,
                            className: textarea.className,
                            hasContent: hasCustomContent,
                            contentPreview: textarea.value?.substring(0, 50) + '...'
                        });

                        // Look for corresponding generate button in the same dialog
                        for (const button of buttons) {
                            const buttonText = button.textContent?.trim();
                            const isGenerateButton =
                                buttonText === '生成' ||
                                buttonText === 'Generate' ||
                                buttonText?.includes('生成') ||
                                buttonText?.includes('Generate') ||
                                button.type === 'submit' ||
                                button.getAttribute('color') === 'primary' ||
                                button.className?.toLowerCase().includes('generate') ||
                                button.className?.toLowerCase().includes('primary');

                            if (isGenerateButton) {
                                generateButton = button;
                                if (DEBUG) console.log('[DEBUG] Found button in dialog using Strategy 1:', {
                                    text: buttonText,
                                    type: button.type,
                                    color: button.getAttribute('color'),
                                    className: button.className
                                });
                                break;
                            }
                        }

                        if (generateButton) break;
                    }
                }

                if (episodeFocusTextarea && generateButton) break;
            }

            // Strategy 2: Original specific selectors (as fallback)
            if (!generateButton || !episodeFocusTextarea) {
                generateButton = generateButton || document.querySelector('button.generate-button');
                episodeFocusTextarea = episodeFocusTextarea || document.querySelector('textarea[formcontrolname="episodeFocus"]');
            }

            // Strategy 3: More general document-wide search
            if (!generateButton || !episodeFocusTextarea) {
                // Look for textareas with focus-related attributes or content
                const allTextareas = document.querySelectorAll('textarea');
                for (const textarea of allTextareas) {
                    const placeholder = textarea.placeholder?.toLowerCase() || '';
                    const formControlName = textarea.getAttribute('formcontrolname')?.toLowerCase() || '';
                    const className = textarea.className?.toLowerCase() || '';
                    const hasContent = textarea.value && textarea.value.trim().length > 10;

                    // Check for indicators that this is a custom prompt textarea
                    if ((placeholder.includes('focus') ||
                        placeholder.includes('自訂') ||
                        placeholder.includes('custom') ||
                        formControlName.includes('focus') ||
                        formControlName.includes('episode') ||
                        className.includes('focus') ||
                        className.includes('episode')) && hasContent) {
                        episodeFocusTextarea = textarea;
                        if (DEBUG) console.log('[DEBUG] Found textarea using Strategy 3:', {
                            placeholder,
                            formControlName,
                            className,
                            contentLength: textarea.value?.length
                        });
                        break;
                    }
                }

                // Look for buttons that might be the generate button
                if (!generateButton) {
                    const allButtons = document.querySelectorAll('button');
                    for (const button of allButtons) {
                        const text = button.textContent?.trim() || '';
                        const className = button.className?.toLowerCase() || '';
                        const type = button.type?.toLowerCase() || '';

                        if (text === '生成' ||
                            text === 'Generate' ||
                            text.includes('生成') ||
                            text.includes('Generate') ||
                            (type === 'submit' && className.includes('primary')) ||
                            className.includes('generate')) {
                            generateButton = button;
                            if (DEBUG) console.log('[DEBUG] Found button using Strategy 3:', {
                                text,
                                className,
                                type
                            });
                            break;
                        }
                    }
                }
            }

            // Strategy 4: Legacy fallback selectors
            if (!generateButton) {
                generateButton = document.querySelector('mat-dialog-actions button[color="primary"]');
            }
            if (!episodeFocusTextarea) {
                episodeFocusTextarea = document.querySelector('textarea.episode-focus-input');
            }

            // Debug: Enhanced logging when elements are found
            if (generateButton && episodeFocusTextarea) {
                if (DEBUG) console.log('[DEBUG] ✅ Custom voice summary dialog elements found:', {
                    button: {
                        text: generateButton.textContent?.trim(),
                        className: generateButton.className,
                        type: generateButton.type,
                        outerHTML: generateButton.outerHTML.substring(0, 150) + '...'
                    },
                    textarea: {
                        formControlName: episodeFocusTextarea.getAttribute('formcontrolname'),
                        placeholder: episodeFocusTextarea.placeholder,
                        className: episodeFocusTextarea.className,
                        valueLength: episodeFocusTextarea.value?.length || 0,
                        valuePreview: episodeFocusTextarea.value?.substring(0, 100) + '...',
                        outerHTML: episodeFocusTextarea.outerHTML.substring(0, 150) + '...'
                    }
                });
            } else if (Math.random() < 0.02) { // Occasional logging when elements are not found
                if (DEBUG) console.log('[DEBUG] ❌ Custom voice summary dialog elements not found:', {
                    generateButton: !!generateButton,
                    episodeFocusTextarea: !!episodeFocusTextarea
                });
            }

            // Check if this is a new button (different from the last one we saw)
            const isNewButton = generateButton && generateButton !== lastGenerateButton;

            if (generateButton && episodeFocusTextarea && (!generateButtonListenerAdded || isNewButton)) {
                if (DEBUG) console.log('[DEBUG] 🎯 Adding click listener to generate button...', {
                    isNewButton,
                    generateButtonListenerAdded,
                    buttonIdentity: generateButton.outerHTML.substring(0, 100) + '...'
                });

                // Add click listener to the generate button using both click and mousedown for reliability
                const clickHandler = async function (event) {
                    event.preventDefault();
                    try {
                        if (DEBUG) console.log('[DEBUG] 🔥 Generate button clicked! Event type:', event.type);
                        if (DEBUG) console.log('[DEBUG] Button clicked:', this);
                        if (DEBUG) console.log('[DEBUG] Current textarea:', episodeFocusTextarea);

                        // Get the current value from the textarea at click time
                        const promptContent = episodeFocusTextarea.value?.trim();
                        if (DEBUG) console.log('[DEBUG] Textarea content at click time:', {
                            length: promptContent?.length || 0,
                            content: promptContent?.substring(0, 100) + '...'
                        });

                        if (promptContent && promptContent.length > 0) {
                            if (DEBUG) console.log('[DEBUG] 💾 Attempting to save prompt:', promptContent.substring(0, 50) + '...');
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
                                exists: !!episodeFocusTextarea,
                                inDocument: document.contains(episodeFocusTextarea),
                                value: episodeFocusTextarea?.value,
                                valueLength: episodeFocusTextarea?.value?.length
                            });
                        }
                    } catch (error) {
                        if (DEBUG) console.error('[DEBUG] ❌ Error handling generate button click:', error);
                    }
                };

                // Add listeners for multiple event types to ensure we catch the click
                generateButton.addEventListener('click', clickHandler, { capture: true });
                generateButton.addEventListener('mousedown', clickHandler, { capture: true });

                generateButtonListenerAdded = true;
                lastGenerateButton = generateButton;
                if (DEBUG) console.log('[DEBUG] ✅ Custom voice summary dialog listener added successfully');
            }

            // Reset flag if dialog is no longer present
            if (!generateButton || !episodeFocusTextarea) {
                if (generateButtonListenerAdded && Math.random() < 0.01) { // Occasional logging to avoid spam
                    if (DEBUG) console.log('[DEBUG] 🔄 Dialog elements no longer present, resetting listener flag');
                }
                generateButtonListenerAdded = false;
                lastGenerateButton = null;
            }
        } catch (error) {
            console.error('Error monitoring custom voice summary dialog:', error);
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
            if (DEBUG) console.log('[DEBUG] Notebook name:', notebookName);
            if (DEBUG) console.log('[DEBUG] Current URL:', currentUrl);

            // Create new prompt object with additional information
            const newPrompt = {
                content: content,
                timestamp: Date.now(),
                notebookName: notebookName,
                url: currentUrl
            };
            if (DEBUG) console.log('[DEBUG] Created new prompt object:', newPrompt);

            // Check if the same prompt already exists (avoid duplicates)
            const existingPrompt = prompts.find(p => p.content === content);
            if (!existingPrompt) {
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

                console.log('✅ Custom prompt saved successfully. Total prompts:', prompts.length);                // Send success notification
                try {
                    const message = `${chrome.i18n.getMessage('custom_prompt_saved')} (${chrome.i18n.getMessage('prompts_count').replace('{count}', prompts.length)})`;
                    chrome.runtime.sendMessage({
                        type: 'showNotification',
                        message: message
                    });
                } catch (msgError) {
                    if (DEBUG) console.log('[DEBUG] Could not send success notification:', msgError);
                }

            } else {
                if (DEBUG) console.log('[DEBUG] Prompt already exists, skipping duplicate save');
                console.log('ℹ️ Prompt already exists, skipping duplicate save');
            }
        } catch (error) {
            console.error('❌ Error saving custom prompt:', error);            // Optionally show a user-friendly notification
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
    }

})();
