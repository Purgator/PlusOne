// Shared helpers to build the plus alias. Loaded by both the content script
// and the popup (plain script, attaches to globalThis).
(function () {
  "use strict";

  // Single source of truth for settings and their defaults.
  const DEFAULTS = {
    email: "", // the main address, used for filling
    emails: [], // all saved addresses
    // Fill triggers
    bubbleEnabled: true,
    bubblePosition: "below", // below | above | right
    shortcutEnabled: true,
    shortcut: "Ctrl+Shift+E", // "Mods+Key" combo matched by the content script
    contextMenuEnabled: true,
    copyOnFill: true,
    // Alias format
    tagStyle: "name", // name | domain | host | custom
    customPattern: "{name}",
    tagExtra: "none", // none | year | yearmonth | random
    separator: "-"
  };

  // Common second-level suffixes so "example.co.uk" resolves to "example",
  // not "co". Heuristic list, good enough without bundling the public
  // suffix list.
  const SECOND_LEVEL = new Set([
    "co", "com", "net", "org", "gov", "gouv", "edu", "ac", "asso", "or", "ne", "go"
  ]);

  function cleanHost(hostname) {
    return String(hostname || "").toLowerCase().trim().replace(/^www\./, "");
  }

  // Index of the first label of the registrable domain within host parts.
  function registrableIndex(parts) {
    let idx = parts.length - 2;
    if (
      parts.length >= 3 &&
      SECOND_LEVEL.has(parts[parts.length - 2]) &&
      parts[parts.length - 1].length <= 3
    ) {
      idx = parts.length - 3;
    }
    return Math.max(idx, 0);
  }

  // "www.shop.example.co.uk" -> "example"
  function siteBaseName(hostname) {
    const host = cleanHost(hostname);
    if (!host) return "";
    // IP addresses or localhost: use as-is
    if (/^[\d.]+$/.test(host) || !host.includes(".")) {
      return sanitizeTag(host.replace(/\./g, "-"));
    }
    const parts = host.split(".").filter(Boolean);
    return sanitizeTag(parts[registrableIndex(parts)]);
  }

  // "www.shop.example.co.uk" -> "example.co.uk"
  function registrableDomain(hostname) {
    const host = cleanHost(hostname);
    if (!host) return "";
    if (/^[\d.]+$/.test(host) || !host.includes(".")) {
      return sanitizeTag(host.replace(/\./g, "-"));
    }
    const parts = host.split(".").filter(Boolean);
    return sanitizeTag(parts.slice(registrableIndex(parts)).join("."));
  }

  // Gmail accepts letters, digits, dots, hyphens and underscores after "+".
  function sanitizeTag(tag) {
    return String(tag).replace(/[^a-z0-9._-]/gi, "").toLowerCase();
  }

  function randomDigits() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  function pad2(n) {
    return String(n).padStart(2, "0");
  }

  // Expand {tokens} in a custom pattern.
  function fillPattern(pattern, hostname) {
    const now = new Date();
    return String(pattern)
      .replaceAll("{name}", siteBaseName(hostname))
      .replaceAll("{domain}", registrableDomain(hostname))
      .replaceAll("{host}", cleanHost(hostname))
      .replaceAll("{year}", String(now.getFullYear()))
      .replaceAll("{month}", pad2(now.getMonth() + 1))
      .replaceAll("{day}", pad2(now.getDate()))
      .replaceAll("{random}", randomDigits());
  }

  // Build the part that goes after "+", honoring the format settings.
  function buildTag(hostname, settings) {
    const s = { ...DEFAULTS, ...settings };
    const sep = s.separator || "-";
    let tag;
    switch (s.tagStyle) {
      case "domain":
        tag = registrableDomain(hostname);
        break;
      case "host":
        tag = cleanHost(hostname);
        break;
      case "custom":
        tag = fillPattern(s.customPattern || "{name}", hostname);
        break;
      default:
        tag = siteBaseName(hostname);
    }
    const now = new Date();
    switch (s.tagExtra) {
      case "year":
        tag += sep + now.getFullYear();
        break;
      case "yearmonth":
        tag += sep + now.getFullYear() + pad2(now.getMonth() + 1);
        break;
      case "random":
        tag += sep + randomDigits();
        break;
    }
    return sanitizeTag(tag);
  }

  // "jane.doe@gmail.com" + "amazon.com" -> "jane.doe+amazon@gmail.com"
  function buildAlias(email, hostname, settings) {
    if (!email) return "";
    const at = email.indexOf("@");
    if (at <= 0) return "";
    const tag = buildTag(hostname, settings);
    if (!tag) return email;
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    return `${local}+${tag}@${domain}`;
  }

  function isValidEmail(email) {
    return /^[^\s@+]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
  }

  globalThis.PlusAlias = {
    DEFAULTS,
    siteBaseName,
    registrableDomain,
    buildTag,
    buildAlias,
    isValidEmail
  };
})();
