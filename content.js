// Content script: shows a small suggestion chip under email fields and
// fills them with the plus alias on click or via the keyboard shortcut.
(function () {
  "use strict";

  const { buildAlias, DEFAULTS } = globalThis.PlusAlias;

  let settings = { ...DEFAULTS };
  let chip = null;
  let chipAlias = ""; // exact value the visible chip will fill
  let activeField = null;

  chrome.storage.sync.get(DEFAULTS, (data) => {
    settings = data;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const [key, change] of Object.entries(changes)) {
      settings[key] = change.newValue;
    }
    hideChip();
  });

  function aliasForThisSite() {
    return settings.email
      ? buildAlias(settings.email, location.hostname, settings)
      : "";
  }

  // --- Email field detection -------------------------------------------

  function isEmailField(el) {
    if (!el || el.tagName !== "INPUT") return false;
    const type = (el.getAttribute("type") || "text").toLowerCase();
    if (!["email", "text", ""].includes(type)) return false;
    if (el.disabled || el.readOnly) return false;
    if (type === "email") return true;
    const haystack = [
      el.name,
      el.id,
      el.getAttribute("autocomplete"),
      el.getAttribute("placeholder"),
      el.getAttribute("aria-label")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return /e-?mail|courriel/.test(haystack);
  }

  function findEmailFields(root) {
    return Array.from(root.querySelectorAll("input")).filter(
      (el) => isEmailField(el) && el.offsetParent !== null
    );
  }

  // --- Fill logic --------------------------------------------------------

  function fillField(field, value) {
    // Use the native setter so frameworks (React, Vue...) see the change.
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      "value"
    ).set;
    setter.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
    flash(field);
  }

  function flash(field) {
    field.classList.add("gpa-flash");
    setTimeout(() => field.classList.remove("gpa-flash"), 700);
  }

  // Called by the popup button, the keyboard shortcut and the context menu.
  function fillBestField() {
    const alias = aliasForThisSite();
    if (!alias) return { ok: false, reason: "no-email" };
    let target = null;
    if (isEmailField(document.activeElement)) {
      target = document.activeElement;
    } else {
      target = findEmailFields(document)[0] || null;
    }
    if (!target) return { ok: false, reason: "no-field" };
    fillField(target, alias);
    hideChip();
    return { ok: true, alias };
  }

  // --- Suggestion chip ---------------------------------------------------

  function ensureChip() {
    if (chip) return chip;
    chip = document.createElement("button");
    chip.type = "button";
    chip.className = "gpa-chip";
    chip.setAttribute("aria-label", "Fill with Gmail plus alias");
    // mousedown fires before the field loses focus
    chip.addEventListener("mousedown", (e) => {
      e.preventDefault();
      if (activeField && chipAlias) {
        fillField(activeField, chipAlias);
      }
      hideChip();
    });
    document.documentElement.appendChild(chip);
    return chip;
  }

  function showChip(field) {
    if (!settings.bubbleEnabled) return;
    const alias = aliasForThisSite();
    if (!alias || field.value === alias) return;
    activeField = field;
    chipAlias = alias;
    const el = ensureChip();
    el.innerHTML = "";
    const icon = document.createElement("span");
    icon.className = "gpa-chip-icon";
    icon.textContent = "+";
    const text = document.createElement("span");
    text.textContent = alias;
    el.append(icon, text);
    positionChip(field, el);
    el.classList.add("gpa-visible");
  }

  function positionChip(field, el) {
    const rect = field.getBoundingClientRect();
    el.style.top = `${Math.round(rect.bottom + 6)}px`;
    el.style.left = `${Math.round(rect.left)}px`;
    el.style.maxWidth = `${Math.max(Math.round(rect.width), 260)}px`;
  }

  function hideChip() {
    activeField = null;
    chipAlias = "";
    if (chip) chip.classList.remove("gpa-visible");
  }

  document.addEventListener("focusin", (e) => {
    if (isEmailField(e.target)) {
      showChip(e.target);
    } else if (e.target !== chip) {
      hideChip();
    }
  });

  document.addEventListener("focusout", (e) => {
    if (e.target === activeField) {
      // Delay so a mousedown on the chip wins.
      setTimeout(() => {
        if (document.activeElement !== chip) hideChip();
      }, 150);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hideChip();
  });

  window.addEventListener(
    "scroll",
    () => {
      if (activeField && chip && chip.classList.contains("gpa-visible")) {
        positionChip(activeField, chip);
      }
    },
    { passive: true, capture: true }
  );
  window.addEventListener("resize", () => {
    if (activeField && chip) positionChip(activeField, chip);
  });

  // Hide the suggestion once the user starts typing something else.
  document.addEventListener("input", (e) => {
    if (e.target === activeField && e.isTrusted) hideChip();
  });

  // --- Messages from popup / background -----------------------------------

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "gpa-fill") {
      sendResponse(fillBestField());
    } else if (msg && msg.type === "gpa-status") {
      sendResponse({
        ok: true,
        alias: aliasForThisSite(),
        hasField: findEmailFields(document).length > 0
      });
    }
    return false;
  });
})();
