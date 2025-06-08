const DEFAULT_URL = "https://notebooklm.google.com/";

// Remove the old action click handler since we now have a popup
// chrome.action.onClicked.addListener((tab) => {
//   chrome.tabs.create({ url: DEFAULT_URL });
// });

chrome.runtime.onInstalled.addListener(() => {

  chrome.notifications.onClicked.addListener(function (notificationId) {
    chrome.tabs.create({ url: DEFAULT_URL });
  });

});

function showNotification(message, url) {
  chrome.notifications.create(url, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('/assets/icons/icon128.png'),
    title: chrome.i18n.getMessage("tool_name"),
    message: message
  });
}
