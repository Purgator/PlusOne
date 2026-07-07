// Shared helpers to build the plus alias. Loaded by both the content script
// and the popup (plain script, attaches to globalThis).
(function () {
  "use strict";

  // Common second-level suffixes so "example.co.uk" resolves to "example",
  // not "co". Heuristic list, good enough without bundling the public
  // suffix list.
  const SECOND_LEVEL = new Set([
    "co", "com", "net", "org", "gov", "gouv", "edu", "ac", "asso", "or", "ne", "go"
  ]);

  // "www.shop.example.co.uk" -> "example"
  function siteBaseName(hostname) {
    if (!hostname) return "";
    let host = String(hostname).toLowerCase().trim();
    host = host.replace(/^www\./, "");
    // IP addresses or localhost: use as-is (dots stripped later by sanitize)
    if (/^[\d.]+$/.test(host) || !host.includes(".")) {
      return sanitizeTag(host.replace(/\./g, "-"));
    }
    const parts = host.split(".").filter(Boolean);
    let idx = parts.length - 2;
    if (
      parts.length >= 3 &&
      SECOND_LEVEL.has(parts[parts.length - 2]) &&
      parts[parts.length - 1].length <= 3
    ) {
      idx = parts.length - 3;
    }
    return sanitizeTag(parts[Math.max(idx, 0)]);
  }

  // Gmail accepts letters, digits, dots, hyphens and underscores after "+".
  function sanitizeTag(tag) {
    return String(tag).replace(/[^a-z0-9._-]/gi, "").toLowerCase();
  }

  // "jane.doe@gmail.com" + "amazon" -> "jane.doe+amazon@gmail.com"
  function buildAlias(email, hostname) {
    if (!email) return "";
    const at = email.indexOf("@");
    if (at <= 0) return "";
    const tag = siteBaseName(hostname);
    if (!tag) return email;
    const local = email.slice(0, at);
    const domain = email.slice(at + 1);
    return `${local}+${tag}@${domain}`;
  }

  function isValidEmail(email) {
    return /^[^\s@+]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
  }

  globalThis.PlusAlias = { siteBaseName, buildAlias, isValidEmail };
})();
