# PlusOne

*Never sign up alone.*

A Chrome extension that fills sign-up email fields with a **Gmail plus alias** built from the website's name:

> `jane.doe@gmail.com` on **amazon.com** → `jane.doe+amazon@gmail.com`

Gmail (and Google Workspace, including custom domains) ignores everything after the `+`, so all these aliases land in your normal inbox — but you can instantly see who leaked or sold your address, and filter each sender.

## Features

- **One-time setup** — enter your email once in the popup. Works with `@gmail.com` or any custom domain handled by Gmail.
- **Suggestion bubble** — click into an email field on any registration form and a small bubble appears with the ready-made alias. One click fills it. It renders in the browser's [top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer) (Popover API), so password-manager overlays can't cover it — and its position (below, above, or right of the field) is configurable in case the browser's own autofill dropdown gets in the way.
- **Keyboard shortcut** — press `Ctrl+Shift+E` (`Cmd+Shift+E` on Mac) on any page to fill the email field. Rebindable at `chrome://extensions/shortcuts`.
- **Right-click menu** — "Fill with Gmail plus alias" on any input field. Fills exactly the field you right-clicked, even if it doesn't look like an email field, and works inside iframes.
- **Popup fill button** — the toolbar popup shows a live preview of the alias for the current site and a "Fill" button.
- **Smart site names** — `www.` and TLDs are stripped, and common suffixes like `.co.uk` are handled: `signup.example.co.uk` → `you+example@...`.
- **Configurable** — every trigger can be toggled, and the alias format is fully customizable (see below).
- Works with React/Vue/Angular forms (events are dispatched so the framework registers the value).
- Your email is stored in Chrome sync storage only. No network requests, no tracking.

## How to install (5 minutes, no technical skills needed)

PlusOne is not on the Chrome Web Store, so you install it manually. It's easier than it sounds:

**Step 1 — Download the extension**

- On this page, click the green **<> Code** button (top right of the file list), then **Download ZIP**.
- The file `RegisterAsPowerGmailExtension-master.zip` lands in your Downloads folder.

**Step 2 — Unzip it somewhere permanent**

- Right-click the ZIP → **Extract All…** (Windows) or double-click it (Mac).
- Move the extracted folder somewhere it can stay forever, like your Documents folder.
  ⚠️ Chrome will load the extension **from this folder** — if you delete or move it later, the extension stops working.

**Step 3 — Load it in Chrome**

1. Open Chrome and type `chrome://extensions` in the address bar, press Enter.
2. Turn on the **Developer mode** switch (top-right corner of the page).
3. Click the **Load unpacked** button (top-left) and select the folder you extracted (the one that contains `manifest.json`).

**Step 4 — Set it up**

- The PlusOne settings page opens by itself. Type your email address, click **Save**. Done!
- Optional: click the puzzle-piece icon 🧩 next to Chrome's address bar and pin **PlusOne** so it's always visible.

**Try it:** go to any website's sign-up page and click the email box — a little bubble appears with your ready-made alias. Click it, and you're done.

> **Updating later:** download the new ZIP, replace the folder's contents, then click the ↻ refresh icon on the PlusOne card in `chrome://extensions`.

## Options

All options live in the popup (also available as the extension's options page) and save instantly, with a live example preview.

**Alias format** — what goes after the `+`:

| Style | Example on `music.amazon.com` |
|---|---|
| Site name (default) | `you+amazon@gmail.com` |
| Domain with extension | `you+amazon.com@gmail.com` |
| Full hostname | `you+music.amazon.com@gmail.com` |
| Custom pattern | your template, e.g. `{name}-{year}` → `you+amazon-2026@gmail.com` |

Custom patterns support the tokens `{name}`, `{domain}`, `{host}`, `{year}`, `{month}`, `{day}` and `{random}` (4 random digits, regenerated at each fill).

You can additionally append the year, year+month, or 4 random digits to any style, and pick the separator (`-`, `_` or `.`).

**Fill triggers** — enable or disable each one independently:

- Suggestion bubble on email-field focus, with a position choice (below, above, or right of the field)
- Keyboard shortcut
- Right-click context menu on input fields

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest: content script, popup, shortcut command |
| `alias.js` | Shared alias-building logic: formats, patterns, defaults, sanitizing |
| `content.js` | Detects email fields, shows the suggestion bubble, fills fields |
| `content.css` | Bubble styling |
| `popup.html/js/css` | Setup, per-site preview, fill button and all options (also the options page) |
| `background.js` | Keyboard shortcut, context menu, first-run setup, badge |
| `icons/` | Generated PNG icons |
