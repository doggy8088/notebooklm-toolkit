const DEFAULT_URL = "https://notebooklm.google.com";
const SIDEPANEL_PATH = "sidepanel/sidepanel.html";

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu
  chrome.contextMenus.create({
    id: "openCustomPrompts",
    title: chrome.i18n.getMessage("query_custom_prompts"),
    contexts: ["action"]
  });

  // 一定要將 openPanelOnActionClick 設定為 true，才能在點擊擴充功能圖示時打開側邊欄
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

  // 一定要將 sidePanel 的 enabled 設為 false，才能在點擊擴充功能圖示時預設隱藏側邊欄
  chrome.sidePanel
    .setOptions({ path: SIDEPANEL_PATH, enabled: false });

  // Notification
  chrome.notifications.onClicked.addListener(function (notificationId) {
    chrome.tabs.create({ url: DEFAULT_URL });
  });
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.url.startsWith(DEFAULT_URL)) {
    chrome.sidePanel.setOptions({ enabled: true });
  } else {
    chrome.tabs.create({ url: DEFAULT_URL });
  }
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "openCustomPrompts") {
    chrome.sidePanel.open({ tabId: tab.id });
  }
});

// Handle tab updates - close sidePanel when navigating to a different URL
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!tab.url) return;

  if (tab.url.startsWith(DEFAULT_URL)) {
    await chrome.sidePanel.setOptions({
      tabId,
      path: SIDEPANEL_PATH,
      enabled: true
    });
  } else {
    // Disables the side panel on all other sites
    await chrome.sidePanel.setOptions({
      tabId,
      path: SIDEPANEL_PATH,
      enabled: false
    });
  }
});

// Handle messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'showNotification') {
    showNotification(message.message, 'error');
  } else if (message.type === 'refreshSidePanel') {
    // Try to send refresh message to sidePanel
    // This will only work if the sidePanel is actually open
    chrome.runtime.sendMessage({
      type: 'refreshSidePanelData',
      source: 'service-worker'
    }).catch(() => {
      // Silently ignore if sidePanel is not open
      // This is expected behavior when sidePanel is closed
    });
  }
});

function showNotification(message, url) {
  chrome.notifications.create(url, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('/assets/icons/icon128.png'),
    title: chrome.i18n.getMessage("tool_name"),
    message: message
  });
}
