// Service worker: keyboard shortcut, context menu and first-run setup.

const FLAGS = {
  email: "",
  shortcutEnabled: true,
  contextMenuEnabled: true
};

const MENU_ID = "gpa-fill-menu";

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open the settings page so the user configures their email right away.
    chrome.runtime.openOptionsPage();
  }
  updateBadge();
  syncContextMenu();
});

chrome.runtime.onStartup.addListener(() => {
  updateBadge();
  syncContextMenu();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "sync") return;
  if (changes.email) updateBadge();
  if (changes.contextMenuEnabled) syncContextMenu();
});

function updateBadge() {
  chrome.storage.sync.get(FLAGS, ({ email }) => {
    if (email) {
      chrome.action.setBadgeText({ text: "" });
    } else {
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#ea4335" });
    }
  });
}

function syncContextMenu() {
  chrome.storage.sync.get(FLAGS, ({ contextMenuEnabled }) => {
    chrome.contextMenus.removeAll(() => {
      if (contextMenuEnabled) {
        chrome.contextMenus.create({
          id: MENU_ID,
          title: "Fill with Gmail plus alias",
          contexts: ["editable"]
        });
      }
    });
  });
}

// Send the fill message, injecting the content script first if the tab
// predates the extension install.
async function fillTab(tabId) {
  try {
    await chrome.tabs.sendMessage(tabId, { type: "gpa-fill" });
  } catch {
    try {
      await chrome.scripting.insertCSS({ target: { tabId }, files: ["content.css"] });
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["alias.js", "content.js"]
      });
      await chrome.tabs.sendMessage(tabId, { type: "gpa-fill" });
    } catch {
      // Restricted page (chrome://, web store...): nothing we can do.
    }
  }
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill-email") return;
  const { shortcutEnabled } = await chrome.storage.sync.get(FLAGS);
  if (!shortcutEnabled) return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) fillTab(tab.id);
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === MENU_ID && tab && tab.id) fillTab(tab.id);
});
