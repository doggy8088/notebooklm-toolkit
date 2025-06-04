(async function () {
    'use strict';

    const hotkeyHandlers = [
        { test: matchHotkey({ ctrl: true, alt: true }, 'a'), handler: handleCtrlAltA },
        { test: matchHotkey({ ctrl: true, alt: true }, 'b'), handler: handleCtrlAltB },
    ];

    let clonedButton = null;
    async function OpenAllButton() {
        const result = await InsertOpenAllButton();
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
                await OpenAllButton();
                await insertDownloadMarkdownButton(svg);
            }
        }
    }, 1000);

    async function InsertOpenAllButton() {
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
                    const blob = new Blob([markdownOutput], { type: 'text/markdown' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'mindmap.md';
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });

                const matIconElement = clonedButton.querySelector('mat-icon');
                if (matIconElement) {
                    matIconElement.textContent = 'sim_card_download';
                    matIconElement.title = 'Download Markdown';
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
        console.log(markdownOutput);
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

        console.log('simulateMouseClick', element);

        element.dispatchEvent(mouseEvent);
    }

    function simulateKeyPress(element, key) {
        if (!element) return;

        const keyEvent = new KeyboardEvent('keydown', {
            bubbles: true,
            cancelable: true,
            key: key
        });

        console.log('simulateKeyPress', element);

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

})();
