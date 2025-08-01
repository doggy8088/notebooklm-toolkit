const DEFAULT_URL = "https://notebooklm.google.com/";

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id });
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
