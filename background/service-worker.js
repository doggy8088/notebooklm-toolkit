const DEFAULT_URL = "https://notebooklm.google.com/";

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: DEFAULT_URL });
});

chrome.runtime.onInstalled.addListener(() => {
  // Create context menu
  chrome.contextMenus.create({
    id: "openCustomPrompts",
    title: chrome.i18n.getMessage("query_custom_prompts"),
    contexts: ["action"]
  });

  chrome.notifications.onClicked.addListener(function (notificationId) {
    chrome.tabs.create({ url: DEFAULT_URL });
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "openCustomPrompts") {
    chrome.sidePanel.open({ tabId: tab.id });
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
