# PlusOne

*Never sign up alone.*

A Chrome extension that fills sign-up email fields with a **Gmail plus alias** built from the website's name:

> `jane.doe@gmail.com` on **amazon.com** → `jane.doe+amazon@gmail.com`

Gmail (and Google Workspace, including custom domains) ignores everything after the `+`, so all these aliases land in your normal inbox — but you can instantly see who leaked or sold your address, and filter each sender.

## Features

- **One-time setup** — enter your email once in the popup. Works with `@gmail.com` or any custom domain handled by Gmail.
- **Suggestion bubble** — click into an email field on any registration form and a small bubble appears with the ready-made alias. One click fills it.
- **Keyboard shortcut** — press `Ctrl+Shift+E` (`Cmd+Shift+E` on Mac) on any page to fill the email field. Rebindable at `chrome://extensions/shortcuts`.
- **Right-click menu** — "Fill with Gmail plus alias" on any input field.
- **Popup fill button** — the toolbar popup shows a live preview of the alias for the current site and a "Fill" button.
- **Smart site names** — `www.` and TLDs are stripped, and common suffixes like `.co.uk` are handled: `signup.example.co.uk` → `you+example@...`.
- **Configurable** — every trigger can be toggled, and the alias format is fully customizable (see below).
- Works with React/Vue/Angular forms (events are dispatched so the framework registers the value).
- Your email is stored in Chrome sync storage only. No network requests, no tracking.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. The settings page opens automatically — enter your email and click **Save**.

That's it. Visit any sign-up page and click into the email field.

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

- Suggestion bubble on email-field focus
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
