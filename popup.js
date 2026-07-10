// Popup / options page logic.
(function () {
  "use strict";

  const { DEFAULTS, buildAlias, isValidEmail } = globalThis.PlusAlias;

  const emailInput = document.getElementById("email");
  const emailListEl = document.getElementById("email-list");
  const saveBtn = document.getElementById("save");
  const saveStatus = document.getElementById("save-status");
  const siteSection = document.getElementById("site");
  const aliasEl = document.getElementById("alias");
  const fillBtn = document.getElementById("fill");
  const fillStatus = document.getElementById("fill-status");
  const shortcutBtn = document.getElementById("shortcut-btn");
  const patternBox = document.getElementById("pattern-box");
  const patternInput = document.getElementById("customPattern");
  const formatPreview = document.getElementById("format-preview");
  const randomNote = document.getElementById("random-note");
  const tagExtraSelect = document.getElementById("tagExtra");
  const separatorSelect = document.getElementById("separator");
  const bubblePositionSelect = document.getElementById("bubblePosition");
  const styleRadios = Array.from(document.querySelectorAll('input[name="tagStyle"]'));
  const toggles = [
    "bubbleEnabled",
    "shortcutEnabled",
    "contextMenuEnabled",
    "copyOnFill"
  ].map((id) => document.getElementById(id));

  let settings = { ...DEFAULTS };
  let currentTab = null;
  let currentHostname = "";

  init();

  async function init() {
    settings = await chrome.storage.sync.get(DEFAULTS);

    // Migrate pre-1.5 storage: a single "email" string becomes the first
    // entry of the "emails" list (and stays the main one).
    if (!Array.isArray(settings.emails)) settings.emails = [];
    if (settings.email && !settings.emails.includes(settings.email)) {
      settings.emails = [settings.email, ...settings.emails];
      await chrome.storage.sync.set({ emails: settings.emails });
    }
    if (!settings.email && settings.emails.length) {
      settings.email = settings.emails[0];
      await chrome.storage.sync.set({ email: settings.email });
    }

    // Populate controls from stored settings.
    patternInput.value = settings.customPattern;
    tagExtraSelect.value = settings.tagExtra;
    separatorSelect.value = settings.separator;
    bubblePositionSelect.value = settings.bubblePosition;
    for (const radio of styleRadios) {
      radio.checked = radio.value === settings.tagStyle;
    }
    for (const box of toggles) {
      box.checked = Boolean(settings[box.id]);
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    currentTab = tab || null;
    try {
      const url = new URL(currentTab?.url || "");
      if (["http:", "https:"].includes(url.protocol)) currentHostname = url.hostname;
    } catch {
      /* no usable tab URL (chrome:// page, options tab...) */
    }

    render();
  }

  // --- Rendering -----------------------------------------------------------

  function render() {
    renderEmailList();

    // Per-site preview + fill button (based on the main address)
    if (settings.email && currentHostname) {
      aliasEl.textContent = buildAlias(settings.email, currentHostname, settings);
      siteSection.hidden = false;
    } else {
      siteSection.hidden = true;
    }

    // Format example: use the real site when available, a classic otherwise.
    const exampleHost = currentHostname || "music.amazon.com";
    const exampleEmail = settings.email || "you@gmail.com";
    formatPreview.textContent = buildAlias(exampleEmail, exampleHost, settings);

    patternBox.hidden = settings.tagStyle !== "custom";
    bubblePositionSelect.disabled = !settings.bubbleEnabled;
    if (!recording) shortcutBtn.textContent = settings.shortcut;
    shortcutBtn.disabled = !settings.shortcutEnabled;
    randomNote.hidden = !(
      settings.tagExtra === "random" ||
      (settings.tagStyle === "custom" && settings.customPattern.includes("{random}"))
    );
  }

  // --- Auto-saved options --------------------------------------------------

  async function saveSetting(patch) {
    Object.assign(settings, patch);
    await chrome.storage.sync.set(patch);
    render();
  }

  for (const radio of styleRadios) {
    radio.addEventListener("change", () => {
      if (radio.checked) saveSetting({ tagStyle: radio.value });
    });
  }
  patternInput.addEventListener("input", () => {
    saveSetting({ customPattern: patternInput.value.trim() || "{name}" });
  });
  tagExtraSelect.addEventListener("change", () => {
    saveSetting({ tagExtra: tagExtraSelect.value });
  });
  separatorSelect.addEventListener("change", () => {
    saveSetting({ separator: separatorSelect.value });
  });
  bubblePositionSelect.addEventListener("change", () => {
    saveSetting({ bubblePosition: bubblePositionSelect.value });
  });
  for (const box of toggles) {
    box.addEventListener("change", () => {
      saveSetting({ [box.id]: box.checked });
    });
  }

  // --- Email list ------------------------------------------------------------

  function renderEmailList() {
    emailListEl.innerHTML = "";
    for (const addr of settings.emails) {
      const isMain = addr === settings.email;
      const row = document.createElement("label");
      row.className = `email-item${isMain ? " main" : ""}`;

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "mainEmail";
      radio.checked = isMain;
      radio.title = "Use this address for filling";
      radio.addEventListener("change", () => {
        if (radio.checked) saveSetting({ email: addr });
      });

      const text = document.createElement("span");
      text.className = "addr";
      text.textContent = addr;

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove";
      remove.textContent = "×";
      remove.title = `Remove ${addr}`;
      remove.addEventListener("click", (e) => {
        e.preventDefault();
        removeEmail(addr);
      });

      row.append(radio, text, remove);
      if (isMain) {
        const badge = document.createElement("span");
        badge.className = "main-badge";
        badge.textContent = "main";
        row.insertBefore(badge, remove);
      }
      emailListEl.appendChild(row);
    }
  }

  saveBtn.addEventListener("click", addEmail);
  emailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") addEmail();
  });
  emailInput.addEventListener("input", () => {
    setStatus(saveStatus, "", "");
  });

  async function addEmail() {
    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      setStatus(saveStatus, "Please enter a valid email address.", "error");
      return;
    }
    if (settings.emails.includes(email)) {
      setStatus(saveStatus, "This address is already in the list.", "error");
      return;
    }
    const emails = [...settings.emails, email];
    // The first saved address automatically becomes the main one.
    const patch = settings.email ? { emails } : { emails, email };
    await saveSetting(patch);
    emailInput.value = "";
    setStatus(saveStatus, "Added! You're all set.", "ok");
  }

  async function removeEmail(addr) {
    const emails = settings.emails.filter((e) => e !== addr);
    const patch = { emails };
    if (settings.email === addr) {
      patch.email = emails[0] || "";
    }
    await saveSetting(patch);
  }

  // --- Fill button -----------------------------------------------------------

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

  // --- Shortcut recorder -----------------------------------------------------

  let recording = false;

  shortcutBtn.addEventListener("click", () => {
    recording = true;
    shortcutBtn.textContent = "Press keys…";
    shortcutBtn.classList.add("recording");
  });

  shortcutBtn.addEventListener("keydown", (e) => {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.key === "Escape") {
      stopRecording();
      return;
    }
    // Wait until a non-modifier key completes the combo.
    if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
    const mods = [];
    if (e.ctrlKey) mods.push("Ctrl");
    if (e.altKey) mods.push("Alt");
    if (e.shiftKey) mods.push("Shift");
    if (e.metaKey) mods.push("Cmd");
    if (!mods.length || (mods.length === 1 && mods[0] === "Shift")) {
      shortcutBtn.textContent = "Add Ctrl, Alt or Cmd…";
      return;
    }
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    saveSetting({ shortcut: [...mods, key].join("+") });
    stopRecording();
  });

  shortcutBtn.addEventListener("blur", stopRecording);

  function stopRecording() {
    recording = false;
    shortcutBtn.classList.remove("recording");
    shortcutBtn.textContent = settings.shortcut;
  }

  function setStatus(el, text, kind) {
    el.textContent = text;
    el.className = `status${kind ? " " + kind : ""}`;
  }
})();
