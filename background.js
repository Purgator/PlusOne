// Service worker: context menu and first-run setup. (The keyboard shortcut
// lives in the content script, where any combination can be matched.)

const FLAGS = {
  email: "",
  emails: [],
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
  if (changes.contextMenuEnabled || changes.emails || changes.email) {
    syncContextMenu();
  }
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
  chrome.storage.sync.get(FLAGS, ({ contextMenuEnabled, emails, email }) => {
    chrome.contextMenus.removeAll(() => {
      if (!contextMenuEnabled) return;
      chrome.contextMenus.create({
        id: MENU_ID,
        title: "Fill with Gmail plus alias",
        contexts: ["editable"]
      });
      // With several saved addresses, a submenu lets the user pick which
      // one to build the alias from (main address marked).
      const list = Array.isArray(emails) && emails.length ? emails : [];
      if (list.length > 1) {
        list.forEach((addr, i) => {
          chrome.contextMenus.create({
            id: `${MENU_ID}:${i}`,
            parentId: MENU_ID,
            title: addr === email ? `${addr} — main` : addr,
            contexts: ["editable"]
          });
        });
      }
    });
  });
}

// Send a fill message, injecting the content script first if the tab
// predates the extension install. When frameId is given (context menu),
// only that frame is targeted; otherwise the message reaches all frames
// and the focused one acts.
async function fillTab(tabId, message, frameId) {
  const options = typeof frameId === "number" ? { frameId } : undefined;
  try {
    await chrome.tabs.sendMessage(tabId, message, options);
  } catch {
    const target =
      typeof frameId === "number"
        ? { tabId, frameIds: [frameId] }
        : { tabId, allFrames: true };
    try {
      await chrome.scripting.insertCSS({ target, files: ["content.css"] });
      await chrome.scripting.executeScript({
        target,
        files: ["alias.js", "content.js"]
      });
      await chrome.tabs.sendMessage(tabId, message, options);
    } catch {
      // Restricted page (chrome://, web store...): nothing we can do.
    }
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (!tab || !tab.id) return;
  const id = String(info.menuItemId);
  if (id === MENU_ID) {
    // Single-address setups: the parent item is directly clickable.
    fillTab(tab.id, { type: "gpa-fill-context" }, info.frameId || 0);
  } else if (id.startsWith(`${MENU_ID}:`)) {
    const index = Number(id.slice(MENU_ID.length + 1));
    chrome.storage.sync.get(FLAGS, ({ emails }) => {
      const email = Array.isArray(emails) ? emails[index] : undefined;
      fillTab(tab.id, { type: "gpa-fill-context", email }, info.frameId || 0);
    });
  }
});
