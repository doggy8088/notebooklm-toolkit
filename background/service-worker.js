const DEFAULT_URL = "https://notebooklm.google.com/";

chrome.action.onClicked.addListener((tab) => {
  chrome.tabs.create({ url: DEFAULT_URL });
});

chrome.runtime.onInstalled.addListener(() => {

  // Set default context menu
  // chrome.contextMenus.create({
  //   id: "summaryUrl",
  //   title: chrome.i18n.getMessage("summary_this_page"),
  //   contexts: ["page", "selection"]
  // });

  chrome.notifications.onClicked.addListener(function (notificationId) {
    chrome.tabs.create({ url: DEFAULT_URL });
  });

  // Initialize the default value of summaryPrompt
  // chrome.storage.sync.set({ summaryPrompt: chrome.i18n.getMessage("default_summary_prompt") });
});

// chrome.contextMenus.onClicked.addListener((info, tab) => {
//   var url = new URL(tab.url);
//   var domain = url.hostname;

//   if (false) {
//     showNotification(chrome.i18n.getMessage("domain_excluded_notification", [domain]));
//     return;
//   }

// });

// This will notify Windows "Notification Center". If the user closes it, it will not be visible!
// https://developer.chrome.com/docs/extensions/how-to/ui/notifications?hl=zh-tw
// https://developer.chrome.com/docs/extensions/reference/api/notifications
function showNotification(message, url) {
  chrome.notifications.create(url, {
    type: 'basic',
    iconUrl: chrome.runtime.getURL('/images/icon128.png'),
    title: chrome.i18n.getMessage("tool_name"),
    message: message
  });
}
