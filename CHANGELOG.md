# Changelog

- 0.10.0 (2025/8/1)

  - feat: 修改擴充功能圖示點擊行為，直接開啟自訂提示記錄側邊面板
  - feat: 簡化使用者存取已儲存的自訂語音摘要提示的流程

- 0.9.0 (2025/7/30)

  - feat: 移除心智圖右下角的「展開所有節點」按鈕，因為 NotebookLM 已內建此功能
  - feat: 移除 Ctrl+Alt+A 鍵盤快速鍵來展開所有節點的功能

- 0.8.2 (2025/6/19)

  - fix: 更新壓縮包內容，包含側邊面板相關檔案
  - fix: 移除不必要的 Tailwind CSS 樣式表連結
  - feat: 新增內容雜湊生成與重複檢查功能，優化儲存邏輯

- 0.8.0 (2025/6/10)

  - 新增側邊面板重新整理功能，支援從內容腳本發送重新整理請求
  - 新增 VSCode 擴充建議，包含 PostCSS 與 Tailwind CSS 擴充套件
  - 修正 Tailwind CSS 的設定檔並重新命名
  - 隱藏「測試」按鈕

- 0.7.0 (2025/1/8)

  - Add Custom Voice Summary Prompt Preservation feature
  - Automatically save custom prompts when using NotebookLM's custom voice summary
  - Add side panel for managing saved prompts with view, expand, and delete functions
  - Add context menu "Query Custom Prompts" option
  - Prevent duplicate prompt saves and auto-manage recent 50 prompts
  - Enhanced security with HTML escaping and comprehensive error handling

- 0.6.0 (2025/6/6)

  - Fine-tune "Copy Note" button position

- 0.5.0 (2025/6/5)

  - Add HTML to Markdown feature.

- 0.4.0 (2025/6/5)

  - Add new languages: de, es, fr
  - Change "Download Markdown" feature to "Copy Mindmap Content" for a mindmap.
  - Add multilingual support for all the buttons.

- 0.3.0 (2025/6/5)

  - Add a copy content button to the Markdown editor and enhance the HTML copy function.

- 0.2.0 (2025/6/5)

  - Add a new button to "Download Markdown" for a mindmap.

- 0.1.0 (2025/6/4)

  - Initial release
  - Add a new button to "Expand all nodes" for a mindmap.
