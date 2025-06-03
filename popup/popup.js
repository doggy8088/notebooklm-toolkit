document.addEventListener('DOMContentLoaded', async () => {
    // 載入儲存的設定
    const data = await chrome.storage.local.get(['extensionEnabled']);

    // 取得 UI 元素
    const actionButton = document.getElementById('actionButton');

    // 設定按鈕點擊事件
    actionButton.addEventListener('click', async () => {
        try {
            // 取得目前分頁
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // 發送訊息到內容腳本
            await chrome.tabs.sendMessage(tab.id, {
                action: 'performAction',
                data: { enabled: data.extensionEnabled !== false }
            });

            // 顯示成功訊息
            actionButton.textContent = '已執行！';
            setTimeout(() => {
                actionButton.textContent = '執行動作';
            }, 2000);

        } catch (error) {
            console.error('執行動作時發生錯誤:', error);
            actionButton.textContent = '錯誤';
            setTimeout(() => {
                actionButton.textContent = '執行動作';
            }, 2000);
        }
    });

    // 更新 UI 狀態
    if (data.extensionEnabled !== false) {
        actionButton.classList.add('enabled');
    }
});

// 監聽來自背景腳本的訊息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updatePopup') {
        // 更新彈出視窗 UI
        console.log('更新彈出視窗:', request.data);
    }
});
