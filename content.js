// Content script: shows a small suggestion chip under email fields and
// fills them with the plus alias on click or via the keyboard shortcut.
(function () {
  "use strict";

  const { buildAlias, DEFAULTS } = globalThis.PlusAlias;

  let settings = { ...DEFAULTS };
  let chip = null;
  let chipAlias = ""; // exact value the visible chip will fill
  let activeField = null;
  let lastContextTarget = null; // element under the last right-click

  document.addEventListener(
    "contextmenu",
    (e) => {
      lastContextTarget = e.target;
    },
    true
  );

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

  function emailList() {
    if (Array.isArray(settings.emails) && settings.emails.length) {
      return settings.emails;
    }
    return settings.email ? [settings.email] : [];
  }

  // Does the field value correspond to this address — either the plain
  // address or an alias built from it? Matching on "local+" and "@domain"
  // keeps it independent of the tag content ({random}, year...).
  function matchesEmail(value, email) {
    const v = String(value).trim().toLowerCase();
    const em = String(email).toLowerCase();
    if (v === em) return true;
    const at = em.indexOf("@");
    if (at <= 0) return false;
    return v.startsWith(em.slice(0, at) + "+") && v.endsWith("@" + em.slice(at + 1));
  }

  // Address to fill a field with: the main one — or, when the field already
  // holds one of the saved addresses, the NEXT one in the list, so repeated
  // fills cycle through all saved addresses.
  function sourceEmailFor(value) {
    const list = emailList();
    if (!list.length) return "";
    if (value) {
      const i = list.findIndex((em) => matchesEmail(value, em));
      if (i !== -1) return list[(i + 1) % list.length];
    }
    return settings.email || list[0];
  }

  function aliasFor(field) {
    const source = sourceEmailFor(field.value);
    return source ? buildAlias(source, location.hostname, settings) : "";
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

  // Looser check for explicit right-click fills: the user pointed at the
  // field, so accept any text-like input even if it doesn't look email-ish.
  function isFillableInput(el) {
    if (!el || el.tagName !== "INPUT") return false;
    const type = (el.getAttribute("type") || "text").toLowerCase();
    return (
      ["email", "text", "search", "url", ""].includes(type) &&
      !el.disabled &&
      !el.readOnly
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
    if (settings.copyOnFill) copyToClipboard(value);
  }

  function copyToClipboard(text) {
    if (navigator.clipboard?.writeText) {
      // Rejects when the document isn't focused (e.g. fill from the popup):
      // fall back to the execCommand path, which the clipboardWrite
      // permission allows without a fresh user gesture.
      navigator.clipboard.writeText(text).catch(() => execCopy(text));
    } else {
      execCopy(text);
    }
  }

  function execCopy(text) {
    try {
      const prevFocus = document.activeElement;
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
      if (prevFocus && prevFocus.focus) prevFocus.focus();
    } catch {
      /* clipboard unavailable: filling still worked */
    }
  }

  function flash(field) {
    field.classList.add("gpa-flash");
    setTimeout(() => field.classList.remove("gpa-flash"), 700);
  }

  // Called by the popup button and the keyboard shortcut. If the field
  // already holds a saved address, the next one in the list is used.
  function fillBestField() {
    if (!emailList().length) return { ok: false, reason: "no-email" };
    let target = null;
    if (isEmailField(document.activeElement)) {
      target = document.activeElement;
    } else {
      target = findEmailFields(document)[0] || null;
    }
    if (!target) return { ok: false, reason: "no-field" };
    const alias = aliasFor(target);
    if (!alias) return { ok: false, reason: "no-email" };
    fillField(target, alias);
    hideChip();
    return { ok: true, alias };
  }

  // Called by the context menu: fill the exact field that was right-clicked,
  // with the address picked in the submenu when one was chosen.
  function fillContextTarget(overrideEmail) {
    if (!overrideEmail && !emailList().length) {
      return { ok: false, reason: "no-email" };
    }
    let target = isFillableInput(lastContextTarget) ? lastContextTarget : null;
    if (!target && isEmailField(document.activeElement)) {
      target = document.activeElement;
    }
    if (!target) target = findEmailFields(document)[0] || null;
    if (!target) return { ok: false, reason: "no-field" };
    const source = overrideEmail || sourceEmailFor(target.value);
    const alias = source ? buildAlias(source, location.hostname, settings) : "";
    if (!alias) return { ok: false, reason: "no-email" };
    fillField(target, alias);
    hideChip();
    return { ok: true, alias };
  }

  // --- Failure toast -------------------------------------------------------

  let toastEl = null;
  let toastTimer = 0;

  function toast(text) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.className = "gpa-toast";
      toastEl.setAttribute("popover", "manual");
      document.documentElement.appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.classList.add("gpa-visible");
    try {
      if (toastEl.showPopover && !toastEl.matches(":popover-open")) {
        toastEl.showPopover();
      }
    } catch {
      /* popover unsupported: z-index fallback */
    }
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.classList.remove("gpa-visible");
      try {
        if (toastEl.hidePopover && toastEl.matches(":popover-open")) {
          toastEl.hidePopover();
        }
      } catch {
        /* already closed */
      }
    }, 2600);
  }

  function toastForFailure(reason) {
    toast(
      reason === "no-email"
        ? "PlusOne: save your email address in the extension popup first."
        : "PlusOne: no email field found here."
    );
  }

  // --- Suggestion chip ---------------------------------------------------

  function ensureChip() {
    if (chip) return chip;
    chip = document.createElement("button");
    chip.type = "button";
    chip.className = "gpa-chip";
    chip.setAttribute("aria-label", "Fill with Gmail plus alias");
    // Render in the browser's top layer so password-manager overlays
    // (which max out z-index) can't cover the chip.
    chip.setAttribute("popover", "manual");
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
    // For a field already holding a saved address, this proposes the next
    // address in the list (see sourceEmailFor).
    const alias = aliasFor(field);
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
    // Show first (top layer + display), then position: the chip must be
    // rendered to be measurable for above/right placement.
    el.classList.add("gpa-visible");
    try {
      if (el.showPopover && !el.matches(":popover-open")) el.showPopover();
    } catch {
      /* popover unsupported or blocked: z-index fallback still applies */
    }
    positionChip(field, el);
    startTracking();
  }

  // While the chip is visible, follow the field every frame: pages keep
  // reflowing after load (fonts, images, banners), which would otherwise
  // leave the chip at stale coordinates. Also covers scrolling inside
  // nested containers and animated layouts.
  let rafId = 0;

  function startTracking() {
    cancelAnimationFrame(rafId);
    const loop = () => {
      if (!chip || !chip.classList.contains("gpa-visible")) return;
      if (!activeField || !activeField.isConnected) {
        hideChip();
        return;
      }
      positionChip(activeField, chip);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
  }

  function positionChip(field, el) {
    const rect = field.getBoundingClientRect();
    setStyle(el, "maxWidth", `${Math.max(Math.round(rect.width), 260)}px`);
    const gap = 6;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let top;
    let left;
    switch (settings.bubblePosition) {
      case "above":
        top = rect.top - h - gap;
        left = rect.left;
        break;
      case "right":
        top = rect.top + (rect.height - h) / 2;
        left = rect.right + gap + 2;
        break;
      default: // below
        top = rect.bottom + gap;
        left = rect.left;
    }
    // Keep the chip inside the viewport.
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - h - 8));
    setStyle(el, "top", `${Math.round(top)}px`);
    setStyle(el, "left", `${Math.round(left)}px`);
  }

  // Skip identical writes so the per-frame loop doesn't dirty style state.
  function setStyle(el, prop, value) {
    if (el.style[prop] !== value) el.style[prop] = value;
  }

  function hideChip() {
    activeField = null;
    chipAlias = "";
    cancelAnimationFrame(rafId);
    if (chip) {
      chip.classList.remove("gpa-visible");
      try {
        if (chip.hidePopover && chip.matches(":popover-open")) chip.hidePopover();
      } catch {
        /* already closed */
      }
    }
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

  // --- Keyboard shortcut ---------------------------------------------------
  // Handled in the page rather than via chrome.commands: command bindings
  // are only granted at install time and silently stay unbound when another
  // extension or the browser (e.g. Vivaldi) already uses the combo. A page
  // listener always works and lets the user pick any combination. Each frame
  // has this listener but keydown only fires in the focused frame.

  function matchesShortcut(e, combo) {
    const parts = String(combo).split("+");
    if (parts.length < 2) return false;
    const key = parts[parts.length - 1].toLowerCase();
    const mods = new Set(parts.slice(0, -1));
    return (
      e.ctrlKey === mods.has("Ctrl") &&
      e.altKey === mods.has("Alt") &&
      e.shiftKey === mods.has("Shift") &&
      e.metaKey === (mods.has("Cmd") || mods.has("Meta")) &&
      e.key.toLowerCase() === key
    );
  }

  document.addEventListener(
    "keydown",
    (e) => {
      if (!settings.shortcutEnabled || !settings.shortcut) return;
      if (!matchesShortcut(e, settings.shortcut)) return;
      e.preventDefault();
      e.stopPropagation();
      const result = fillBestField();
      if (!result.ok) toastForFailure(result.reason);
    },
    true
  );

  // Hide the suggestion once the user starts typing something else.
  document.addEventListener("input", (e) => {
    if (e.target === activeField && e.isTrusted) hideChip();
  });

  // --- Messages from popup / background -----------------------------------

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === "gpa-fill") {
      // This message is broadcast to every frame: only the frame that owns
      // the focus should act, otherwise several frames would fill at once.
      const ae = document.activeElement;
      if (ae && ae.tagName === "IFRAME") return false; // inner frame handles it
      if (window !== window.top && !document.hasFocus()) return false;
      const result = fillBestField();
      if (msg.feedback && !result.ok) toastForFailure(result.reason);
      sendResponse(result);
    } else if (msg && msg.type === "gpa-fill-context") {
      // Frame-targeted (background passes the clicked frameId), no guards.
      const result = fillContextTarget(msg.email);
      if (!result.ok) toastForFailure(result.reason);
      sendResponse(result);
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
