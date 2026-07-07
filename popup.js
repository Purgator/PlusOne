// Popup / options page logic.
(function () {
  "use strict";

  const { buildAlias, isValidEmail } = globalThis.PlusAlias;

  const emailInput = document.getElementById("email");
  const saveBtn = document.getElementById("save");
  const saveStatus = document.getElementById("save-status");
  const siteSection = document.getElementById("site");
  const aliasEl = document.getElementById("alias");
  const fillBtn = document.getElementById("fill");
  const fillStatus = document.getElementById("fill-status");
  const shortcutEl = document.getElementById("shortcut");
  const shortcutsLink = document.getElementById("shortcuts-link");

  let currentTab = null;

  init();

  async function init() {
    const { email } = await chrome.storage.sync.get({ email: "" });
    emailInput.value = email;

    // Show the actual shortcut currently bound to the command.
    const commands = await chrome.commands.getAll();
    const fill = commands.find((c) => c.name === "fill-email");
    if (fill && fill.shortcut) shortcutEl.textContent = fill.shortcut;

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab || null;
    refreshSitePreview();
  }

  function refreshSitePreview() {
    const email = emailInput.value.trim();
    let hostname = "";
    try {
      const url = new URL(currentTab?.url || "");
      if (["http:", "https:"].includes(url.protocol)) hostname = url.hostname;
    } catch {
      /* no usable tab URL (chrome:// page, options tab...) */
    }

    if (email && isValidEmail(email) && hostname) {
      aliasEl.textContent = buildAlias(email, hostname);
      siteSection.hidden = false;
    } else {
      siteSection.hidden = true;
    }
  }

  saveBtn.addEventListener("click", save);
  emailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") save();
  });
  emailInput.addEventListener("input", () => {
    setStatus(saveStatus, "", "");
  });

  async function save() {
    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      setStatus(saveStatus, "Please enter a valid email address.", "error");
      return;
    }
    await chrome.storage.sync.set({ email });
    setStatus(saveStatus, "Saved! You're all set.", "ok");
    refreshSitePreview();
  }

  fillBtn.addEventListener("click", async () => {
    if (!currentTab?.id) return;
    let response = null;
    try {
      response = await chrome.tabs.sendMessage(currentTab.id, { type: "gpa-fill" });
    } catch {
      // Content script missing (tab predates install): inject and retry.
      try {
        await chrome.scripting.insertCSS({
          target: { tabId: currentTab.id },
          files: ["content.css"]
        });
        await chrome.scripting.executeScript({
          target: { tabId: currentTab.id },
          files: ["alias.js", "content.js"]
        });
        response = await chrome.tabs.sendMessage(currentTab.id, { type: "gpa-fill" });
      } catch {
        setStatus(fillStatus, "Can't run on this page.", "error");
        return;
      }
    }
    if (response?.ok) {
      setStatus(fillStatus, `Filled with ${response.alias}`, "ok");
    } else if (response?.reason === "no-field") {
      setStatus(fillStatus, "No email field found on this page.", "error");
    } else {
      setStatus(fillStatus, "Save your email address first.", "error");
    }
  });

  shortcutsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });

  function setStatus(el, text, kind) {
    el.textContent = text;
    el.className = `status${kind ? " " + kind : ""}`;
  }
})();
