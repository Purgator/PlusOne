// Service worker: keyboard shortcut handling and first-run setup.

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // Open the settings page so the user configures their email right away.
    chrome.runtime.openOptionsPage();
  }
  updateBadge();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.email) updateBadge();
});

function updateBadge() {
  chrome.storage.sync.get({ email: "" }, ({ email }) => {
    if (email) {
      chrome.action.setBadgeText({ text: "" });
    } else {
      chrome.action.setBadgeText({ text: "!" });
      chrome.action.setBadgeBackgroundColor({ color: "#ea4335" });
    }
  });
}

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "fill-email") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;
  try {
    await chrome.tabs.sendMessage(tab.id, { type: "gpa-fill" });
  } catch {
    // Content script not there yet (tab opened before install): inject it.
    try {
      await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ["content.css"] });
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["alias.js", "content.js"]
      });
      await chrome.tabs.sendMessage(tab.id, { type: "gpa-fill" });
    } catch {
      // Restricted page (chrome://, web store...): nothing we can do.
    }
  }
});
