// Fast Copy — background service worker.
// Fetches an image (bypassing page CORS via host_permissions), converts it to
// PNG, returns it to the content script as a data URL, and — when enabled —
// also uploads it to Obsidian via the Local REST API plugin.

const DEFAULTS = {
  copyImageModifier: "ctrl",
  copyUrlModifier: "none",
  alsoCopyHtml: false,
  showToast: true,
  obsidianEnabled: false,
  obsidianUrl: "http://127.0.0.1:27123",
  obsidianToken: "",
  obsidianAttachmentFolder: "attachments",
  obsidianInsertLink: true,
};

// Clicking the toolbar icon opens the settings page.
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "FAST_COPY_FETCH_IMAGE") {
    handleCopy(msg.url)
      .then(sendResponse)
      .catch((err) => sendResponse({ ok: false, error: errMsg(err) }));
    return true; // keep the message channel open for the async response
  }
});

async function handleCopy(url) {
  const pngBlob = await fetchAsPng(url);
  const result = { ok: true, dataUrl: await blobToDataUrl(pngBlob) };

  const cfg = await getSettings();
  if (cfg.obsidianEnabled) {
    // An Obsidian failure must not break the clipboard copy — report it apart.
    result.obsidian = await sendToObsidian(pngBlob, url, cfg).then(
      (name) => ({ ok: true, name }),
      (err) => ({ ok: false, error: errMsg(err) })
    );
  }
  return result;
}

async function fetchAsPng(url) {
  const resp = await fetch(url, { credentials: "include" });
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  const blob = await resp.blob();
  // The clipboard reliably accepts only image/png, so convert everything else.
  return blob.type === "image/png" ? blob : await toPng(blob);
}

async function toPng(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return await canvas.convertToBlob({ type: "image/png" });
}

// --- Obsidian Local REST API ---

async function sendToObsidian(pngBlob, srcUrl, cfg) {
  if (!cfg.obsidianToken) throw new Error("no API token set in options");

  const base = cfg.obsidianUrl.replace(/\/+$/, "");
  const auth = { Authorization: "Bearer " + cfg.obsidianToken };
  const template = cfg.obsidianAttachmentFolder || "";

  // The folder template and/or the embed link may need the active note's path.
  const needNote = /\{note/.test(template) || cfg.obsidianInsertLink;
  const notePath = needNote ? await getActiveNotePath(base, auth) : null;

  const folder = resolveFolder(template, notePath);
  const name = makeFilename(srcUrl);
  const vaultPath = (folder ? folder + "/" : "") + name;

  // 1. Upload the image file into the vault.
  const put = await fetch(base + "/vault/" + encodePath(vaultPath), {
    method: "PUT",
    headers: { ...auth, "Content-Type": "image/png" },
    body: pngBlob,
  });
  if (!put.ok) {
    throw new Error("upload " + put.status + " " + (await safeText(put)));
  }

  // 2. Append an embed link (full path, so it resolves in any subfolder).
  if (cfg.obsidianInsertLink) {
    const post = await fetch(base + "/active/", {
      method: "POST",
      headers: { ...auth, "Content-Type": "text/markdown" },
      body: "\n![[" + vaultPath + "]]\n",
    });
    if (!post.ok) {
      throw new Error("saved file, but link failed: " + post.status + " " + (await safeText(post)));
    }
  }
  return name;
}

// Reads the path of the note currently open in Obsidian (e.g. "Projects/art.md").
async function getActiveNotePath(base, auth) {
  const r = await fetch(base + "/active/", {
    headers: { ...auth, Accept: "application/vnd.olrapi.note+json" },
  });
  if (r.status === 404) throw new Error("no active note — open one in Obsidian");
  if (!r.ok) throw new Error("active note " + r.status + " " + (await safeText(r)));
  const json = await r.json();
  if (!json || !json.path) throw new Error("could not read active note path");
  return json.path;
}

// Expands {notepath}/{notedir}/{notename} against the active note and
// normalizes the result into a clean vault-relative folder path.
function resolveFolder(template, notePath) {
  let full = "";
  let dir = "";
  let name = "";
  if (notePath) {
    full = notePath.replace(/\.[^/.]+$/, ""); // drop extension
    const slash = full.lastIndexOf("/");
    dir = slash >= 0 ? full.slice(0, slash) : "";
    name = slash >= 0 ? full.slice(slash + 1) : full;
  }
  const expanded = template
    .replace(/\{notepath\}/g, full)
    .replace(/\{notedir\}/g, dir)
    .replace(/\{notename\}/g, name);
  return expanded.split("/").filter(Boolean).join("/"); // collapse empty segments
}

function makeFilename(url) {
  let stem = "image";
  try {
    const last = new URL(url).pathname.split("/").pop() || "";
    const cleaned = last
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/[^a-z0-9_-]+/gi, "-")
      .replace(/^-+|-+$/g, "");
    if (cleaned) stem = cleaned.slice(0, 40);
  } catch (e) {
    /* keep default */
  }
  return stem + "-" + Date.now() + ".png";
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function safeText(resp) {
  try {
    return (await resp.text()).slice(0, 200);
  } catch (e) {
    return "";
  }
}

// --- helpers ---

function getSettings() {
  return new Promise((resolve) => chrome.storage.sync.get(DEFAULTS, resolve));
}

function errMsg(err) {
  return String((err && err.message) || err);
}

// FileReader is unavailable in MV3 service workers, so encode base64 manually.
async function blobToDataUrl(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return "data:image/png;base64," + btoa(binary);
}
