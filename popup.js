// Popup / options page logic.
(function () {
  "use strict";

  const { DEFAULTS, buildAlias, isValidEmail } = globalThis.PlusAlias;

  const emailInput = document.getElementById("email");
  const saveBtn = document.getElementById("save");
  const saveStatus = document.getElementById("save-status");
  const siteSection = document.getElementById("site");
  const aliasEl = document.getElementById("alias");
  const fillBtn = document.getElementById("fill");
  const fillStatus = document.getElementById("fill-status");
  const shortcutEl = document.getElementById("shortcut");
  const shortcutsLink = document.getElementById("shortcuts-link");
  const patternBox = document.getElementById("pattern-box");
  const patternInput = document.getElementById("customPattern");
  const formatPreview = document.getElementById("format-preview");
  const randomNote = document.getElementById("random-note");
  const tagExtraSelect = document.getElementById("tagExtra");
  const separatorSelect = document.getElementById("separator");
  const styleRadios = Array.from(document.querySelectorAll('input[name="tagStyle"]'));
  const toggles = ["bubbleEnabled", "shortcutEnabled", "contextMenuEnabled"].map(
    (id) => document.getElementById(id)
  );

  let settings = { ...DEFAULTS };
  let currentTab = null;
  let currentHostname = "";

  init();

  async function init() {
    settings = await chrome.storage.sync.get(DEFAULTS);

    // Populate controls from stored settings.
    emailInput.value = settings.email;
    patternInput.value = settings.customPattern;
    tagExtraSelect.value = settings.tagExtra;
    separatorSelect.value = settings.separator;
    for (const radio of styleRadios) {
      radio.checked = radio.value === settings.tagStyle;
    }
    for (const box of toggles) {
      box.checked = Boolean(settings[box.id]);
    }

    // Show the actual shortcut currently bound to the command.
    const commands = await chrome.commands.getAll();
    const fill = commands.find((c) => c.name === "fill-email");
    if (fill && fill.shortcut) shortcutEl.textContent = fill.shortcut;

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
    const email = emailInput.value.trim();
    const validEmail = email && isValidEmail(email);

    // Per-site preview + fill button
    if (validEmail && currentHostname) {
      aliasEl.textContent = buildAlias(email, currentHostname, settings);
      siteSection.hidden = false;
    } else {
      siteSection.hidden = true;
    }

    // Format example: use the real site when available, a classic otherwise.
    const exampleHost = currentHostname || "music.amazon.com";
    const exampleEmail = validEmail ? email : "you@gmail.com";
    formatPreview.textContent = buildAlias(exampleEmail, exampleHost, settings);

    patternBox.hidden = settings.tagStyle !== "custom";
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
  for (const box of toggles) {
    box.addEventListener("change", () => {
      saveSetting({ [box.id]: box.checked });
    });
  }

  // --- Email (explicit save) -------------------------------------------------

  saveBtn.addEventListener("click", saveEmail);
  emailInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveEmail();
  });
  emailInput.addEventListener("input", () => {
    setStatus(saveStatus, "", "");
  });

  async function saveEmail() {
    const email = emailInput.value.trim();
    if (!isValidEmail(email)) {
      setStatus(saveStatus, "Please enter a valid email address.", "error");
      return;
    }
    await saveSetting({ email });
    setStatus(saveStatus, "Saved! You're all set.", "ok");
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

  shortcutsLink.addEventListener("click", (e) => {
    e.preventDefault();
    chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
  });

  function setStatus(el, text, kind) {
    el.textContent = text;
    el.className = `status${kind ? " " + kind : ""}`;
  }
})();
