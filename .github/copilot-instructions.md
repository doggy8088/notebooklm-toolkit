# GitHub Copilot 指南 - Chrome 擴充功能開發 (Manifest V3)

## 概述
本指南提供使用 GitHub Copilot 開發 Chrome 擴充功能的最佳實踐，專注於 Manifest V3 標準。

## 核心原則

### 1. Manifest V3 結構
- 使用 `manifest.json` 作為主要設定檔案
- 採用 Service Worker 取代背景頁面
- 實作 Host Permissions 和 Active Tab 權限模型
- 使用 Chrome Extensions API v3

### 2. 檔案結構最佳實踐
```
chrome-extension/
├── manifest.json          # 擴充功能設定檔案
├── background/
│   └── service-worker.js  # Service Worker 程式碼
├── content/
│   └── content-script.js  # 內容腳本
├── popup/
│   ├── popup.html         # 彈出視窗 HTML
│   ├── popup.js           # 彈出視窗邏輯
│   └── popup.css          # 彈出視窗樣式
├── options/
│   ├── options.html       # 選項頁面 HTML
│   ├── options.js         # 選項頁面邏輯
│   └── options.css        # 選項頁面樣式
├── _locales/              # 多語系資料夾
│   └── zh_TW/             # 繁體中文語系
│       └── messages.json  # 語系訊息檔案
└── assets/
  └── icons/             # 圖示檔案
```

### 3. 程式碼產生指導原則

#### Manifest.json 範例
```json
{
  "manifest_version": 3,
  "name": "擴充功能名稱",
  "version": "1.0.0",
  "description": "擴充功能描述",
  "permissions": ["storage", "activeTab"],
  "background": {
    "service_worker": "background/service-worker.js"
  },
  "content_scripts": [{
    "matches": ["<all_urls>"],
    "js": ["content/content-script.js"]
  }],
  "action": {
    "default_popup": "popup/popup.html",
    "default_icon": {
      "16": "assets/icons/icon16.png",
      "48": "assets/icons/icon48.png",
      "128": "assets/icons/icon128.png"
    }
  }
}
```

#### Service Worker 最佳實踐
- 使用事件監聽器模式
- 實作非同步處理
- 妥善處理擴充功能生命週期
- 使用 chrome.storage API 儲存資料

#### 內容腳本指導原則
- 避免污染頁面的全域命名空間
- 使用訊息通訊與背景腳本互動
- 實作 DOM 操作時確保效能
- 處理動態載入的內容

### 4. API 使用優先順序

#### 儲存 API
- 優先使用 `chrome.storage.local`
- 對於同步資料使用 `chrome.storage.sync`
- 實作錯誤處理和資料驗證

#### 權限管理
- 使用最小權限原則
- 實作動態權限請求
- 處理權限被拒絕的情況

#### 訊息通訊
- 使用 `chrome.runtime.sendMessage ()` 進行通訊
- 實作適當的訊息路由
- 處理連接中斷情況

### 5. 安全性考量
- 內容安全政策 (CSP) 合規
- 避免使用 `eval ()` 和內聯腳本
- 驗證所有外部輸入
- 使用 HTTPS 進行網路請求

### 6. 效能最佳化
- 延遲載入非關鍵資源
- 最小化記憶體使用
- 實作適當的快取策略
- 避免長時間執行的任務

### 7. 測試和除錯

#### 測試策略
- 單元測試覆蓋核心邏輯
- 整合測試驗證 API 互動
- 跨瀏覽器相容性測試
- 效能和記憶體洩漏測試

#### 除錯工具
- 使用 Chrome DevTools 擴充功能頁面
- 利用 Service Worker 除錯工具
- 實作詳細的錯誤記錄
- 使用 `console.log` 進行開發階段除錯

### 8. 發布和維護

#### 版本管理
- 遵循語意化版本控制
- 維護變更記錄
- 實作向後相容性
- 準備遷移計畫

#### Chrome Web Store 準備
- 最佳化商店列表
- 準備螢幕截圖和描述
- 遵循商店政策
- 實作使用者回饋機制

### 9. 常見模式和範例

#### 彈出視窗互動
```javascript
//popup.js
document.addEventListener ('DOMContentLoaded', async () => {
  const data = await chrome.storage.local.get ('key');
  // 更新 UI
});
```

#### 內容腳本注入
```javascript
//service-worker.js
chrome.action.onClicked.addListener (async (tab) => {
  await chrome.scripting.executeScript ({
    target: { tabId: tab.id },
    files: ['content/content-script.js']
  });
});
```

### 10. 故障排除指南

#### 常見問題
- Service Worker 非活動狀態處理
- 內容腳本注入失敗
- 權限不足錯誤
- 跨來源請求問題

#### 解決方案模式
- 實作重試機制
- 使用適當的錯誤處理
- 提供使用者友善的錯誤訊息
- 記錄詳細的除錯資訊

---

## 程式碼產生提示

當使用 GitHub Copilot 時，請提供具體的上下文和需求：
- 指定 Manifest V3 相容性
- 說明預期的使用者互動流程
- 描述需要的權限和 API
- 提及效能和安全性要求

範例提示：
"建立一個 Manifest V3 Chrome 擴充功能，用於在網頁上高亮顯示文字，需要內容腳本和彈出視窗介面"