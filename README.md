# Gmail Plus Alias Autofill

A Chrome extension that fills sign-up email fields with a **Gmail plus alias** built from the website's name:

> `jane.doe@gmail.com` on **amazon.com** → `jane.doe+amazon@gmail.com`

Gmail (and Google Workspace, including custom domains) ignores everything after the `+`, so all these aliases land in your normal inbox — but you can instantly see who leaked or sold your address, and filter each sender.

## Features

- **One-time setup** — enter your email once in the popup. Works with `@gmail.com` or any custom domain handled by Gmail.
- **Suggestion bubble** — click into an email field on any registration form and a small bubble appears with the ready-made alias. One click fills it.
- **Keyboard shortcut** — press `Ctrl+Shift+E` (`Cmd+Shift+E` on Mac) on any page to fill the email field. Rebindable at `chrome://extensions/shortcuts`.
- **Popup fill button** — the toolbar popup shows a live preview of the alias for the current site and a "Fill" button.
- **Smart site names** — `www.` and TLDs are stripped, and common suffixes like `.co.uk` are handled: `signup.example.co.uk` → `you+example@...`.
- Works with React/Vue/Angular forms (events are dispatched so the framework registers the value).
- Your email is stored in Chrome sync storage only. No network requests, no tracking.

## Install (unpacked)

1. Open `chrome://extensions`.
2. Enable **Developer mode** (top right).
3. Click **Load unpacked** and select this folder.
4. The settings page opens automatically — enter your email and click **Save**.

That's it. Visit any sign-up page and click into the email field.

## Files

| File | Role |
|---|---|
| `manifest.json` | MV3 manifest: content script, popup, shortcut command |
| `alias.js` | Shared alias-building logic (site base name extraction, sanitizing) |
| `content.js` | Detects email fields, shows the suggestion bubble, fills fields |
| `content.css` | Bubble styling |
| `popup.html/js/css` | Setup + per-site alias preview + fill button (also the options page) |
| `background.js` | Keyboard shortcut handling, first-run setup, badge |
| `icons/` | Generated PNG icons |
