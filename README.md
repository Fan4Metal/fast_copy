# Fast Copy

Extension for chromium-based browsers (Chrome, Edge, Brave, Opera) to copy
images from a web page to the clipboard.

> 🇷🇺 Русская версия: [README.ru.md](README.ru.md)

## How to use

1. Hold **Ctrl** and **left-click** any image on a page.
2. A small "Image copied" toast appears — the image is now in your clipboard as PNG.
3. Paste it (`Ctrl+V`) into any editor, chat, document, etc.

Works with:
- `<img>` elements (including images wrapped in links — the link is suppressed),
- CSS `background-image`,
- `<canvas>` (if not tainted by cross-origin content).

## Installation (unpacked)

1. Open `chrome://extensions` (or `edge://extensions`, `brave://extensions`).
2. Enable **Developer mode** (top-right toggle).
3. Click **Load unpacked** and select this project folder (`fast_copy`).
4. Done — open any page and Ctrl+click an image.

## Settings

Click the extension's toolbar icon (or open it via `chrome://extensions` →
*Details* → *Extension options*) to configure:

- **Copy image modifier** — which key + left click copies the image (Ctrl / Alt / Shift).
- **Copy image URL modifier** — a different key + left click copies the image's
  URL as plain text (or *Disabled*). Must differ from the image modifier.
- **Also copy as HTML `<img>`** — additionally puts an `<img>` tag in the
  clipboard so you can paste the image into rich editors (Gmail, Google Docs…).
- **Show confirmation toast** — toggle the on-page "copied" notification.

Settings are stored in `chrome.storage.sync` and apply instantly without reload.

## How it works

- `content.js` listens for Ctrl+left-click on images and writes the result to
  the clipboard via the async Clipboard API.
- `background.js` (service worker) downloads the image — bypassing the page's
  CORS restrictions through `host_permissions` — and converts it to PNG, the
  format the clipboard reliably accepts.

## Permissions

- `clipboardWrite` — to put the image into the clipboard.
- `storage` — to save your settings.
- `host_permissions: <all_urls>` — so the service worker can fetch images from
  any domain.

## Files

| File            | Purpose                                            |
| --------------- | -------------------------------------------------- |
| `manifest.json` | Manifest V3 configuration                          |
| `content.js`    | Click handler, clipboard write, toast UI           |
| `background.js` | Image fetch + PNG conversion, opens settings       |
| `options.html`  | Settings page markup                               |
| `options.js`    | Settings page logic (`chrome.storage.sync`)        |
| `icons/`        | Toolbar icons (16/48/128 px)                       |
