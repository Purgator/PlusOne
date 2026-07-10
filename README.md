# PlusOne

*Never sign up alone.*

A Chrome extension that fills sign-up email fields with a **Gmail plus alias** built from the website's name:

> `jane.doe@gmail.com` on **amazon.com** → `jane.doe+amazon@gmail.com`

Gmail (and Google Workspace, including custom domains) ignores everything after the `+`, so all these aliases land in your normal inbox — but you can instantly see who leaked or sold your address, and filter each sender.

## Features

- **One-time setup** — enter your email once in the popup. Works with `@gmail.com` or any custom domain handled by Gmail.
- **Several addresses** — save as many email addresses as you like (personal, work…) and pick the **main** one with a click; that's the address used for filling.
- **Suggestion bubble** — click into an email field on any registration form and a small bubble appears with the ready-made alias. One click fills it. It renders in the browser's [top layer](https://developer.mozilla.org/en-US/docs/Glossary/Top_layer) (Popover API), so password-manager overlays can't cover it — and its position (below, above, or right of the field) is configurable in case the browser's own autofill dropdown gets in the way.
- **Keyboard shortcut** — press `Ctrl+Shift+E` on any page to fill the email field. Fully configurable from the popup: click the combination and press the keys you want. Works in Chrome, Vivaldi, Edge, Brave, Firefox… (it's handled in the page, not through Chrome's fragile command bindings).
- **Cross-browser** — one package for Chrome and any Chromium browser, plus Firefox 121+ (see the Firefox notes below).
- **Right-click menu** — "Fill with Gmail plus alias" on any input field. Fills exactly the field you right-clicked, even if it doesn't look like an email field, and works inside iframes. With several saved addresses, a submenu lets you pick which one to use.
- **Address cycling** — when a field already contains one of your saved addresses (plain or aliased), the bubble and the keyboard shortcut propose the *next* address in the list, so you can flip through your addresses right in the field.
- **Popup fill button** — the toolbar popup shows a live preview of the alias for the current site and a "Fill" button.
- **Smart site names** — `www.` and TLDs are stripped, and common suffixes like `.co.uk` are handled: `signup.example.co.uk` → `you+example@...`.
- **Clipboard copy** — after every fill the alias is also copied to the clipboard (toggleable), handy for confirmation fields or keeping track of which alias a site got.
- **Configurable** — every trigger can be toggled, and the alias format is fully customizable (see below).
- Works with React/Vue/Angular forms (events are dispatched so the framework registers the value).
- Your email is stored in Chrome sync storage only. No network requests, no tracking.

## How to install (5 minutes, no technical skills needed)

PlusOne is not on the Chrome Web Store, so you install it manually. It's easier than it sounds:

**Step 1 — Download the extension**

- Go to the [**latest release**](https://github.com/Purgator/PlusOne/releases/latest) page.
- Under **Assets**, click **PlusOne.zip** — it lands in your Downloads folder.

**Step 2 — Unzip it somewhere permanent**

- Right-click the ZIP → **Extract All…** (Windows) or double-click it (Mac).
- Move the extracted folder somewhere it can stay forever, like your Documents folder.
  ⚠️ Chrome will load the extension **from this folder** — if you delete or move it later, the extension stops working.

**Step 3 — Load it in Chrome**

1. Open Chrome and type `chrome://extensions` in the address bar, press Enter.
2. Turn on the **Developer mode** switch (top-right corner of the page).
3. Click the **Load unpacked** button (top-left) and select the folder you extracted (the one that contains `manifest.json`).

**Step 4 — Set it up**

- The PlusOne settings page opens by itself. Type your email address, click **Add**. Done!
- Optional: click the puzzle-piece icon 🧩 next to Chrome's address bar and pin **PlusOne** so it's always visible.

**Try it:** go to any website's sign-up page and click the email box — a little bubble appears with your ready-made alias. Click it, and you're done.

> **Updating later:** download the new ZIP from the [releases page](https://github.com/Purgator/PlusOne/releases), replace the folder's contents, then click the ↻ refresh icon on the PlusOne card in `chrome://extensions`.

## Firefox

PlusOne also works on Firefox (121 or newer). Two things are different there:

**Installing.** Regular Firefox only keeps extensions signed by Mozilla, so until a signed `.xpi` is attached to the releases you can load it temporarily:

1. Download **PlusOne.zip** from the [latest release](https://github.com/Purgator/PlusOne/releases/latest) (no need to unzip).
2. Type `about:debugging#/runtime/this-firefox` in the address bar.
3. Click **Load Temporary Add-on…** and select the ZIP.
4. ⚠️ Temporary add-ons are removed when Firefox closes — you'll need to redo this after a restart. A permanently installable signed version requires a (free) submission to addons.mozilla.org.

**Allowing site access.** Unlike Chrome, Firefox doesn't grant website access at install. Open the PlusOne popup (toolbar icon) and click **Allow access to websites** — one click, once. Without it the bubble and shortcut can't work.

## Options

All options live in the popup (also available as the extension's options page) and save instantly, with a live example preview.

**Email addresses** — save several addresses; the one marked **main** (radio button) is used everywhere. The first address you add becomes the main one automatically.

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
- Keyboard shortcut, with a recorder to pick any combination (must include Ctrl, Alt or Cmd)
- Right-click context menu on input fields

**After filling** — copy the alias to the clipboard (on by default).

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

## License

PlusOne is free software, released under the [GNU General Public License v3.0](LICENSE): you can use, study, share and improve it, and derivative works must stay under the same license.
