// Fast Copy — content script.
// Modifier + left click on an image copies it (or its URL) to the clipboard.

(function () {
  if (window.__fastCopyInstalled) return;
  window.__fastCopyInstalled = true;

  const DEFAULTS = {
    copyImageModifier: "ctrl", // ctrl | alt | shift
    copyUrlModifier: "none", // none | ctrl | alt | shift
    alsoCopyHtml: false,
    showToast: true,
  };

  let cfg = { ...DEFAULTS };

  chrome.storage.sync.get(DEFAULTS, (loaded) => {
    cfg = loaded;
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync") return;
    for (const key of Object.keys(changes)) {
      if (key in cfg) cfg[key] = changes[key].newValue;
    }
  });

  // Capture phase so we win before the page's own click handlers / link nav.
  document.addEventListener("click", onClick, true);

  function onClick(e) {
    if (e.button !== 0) return; // left click only

    const mod = activeModifier(e);
    if (!mod) return;

    let action = null;
    if (mod === cfg.copyImageModifier) action = "image";
    else if (mod === cfg.copyUrlModifier) action = "url";
    if (!action) return;

    const url = findImageUrl(e.target);
    if (!url) return;

    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    if (action === "url") copyUrl(url);
    else copyImage(url);
  }

  // Returns the single pressed modifier ("ctrl"|"alt"|"shift"), or null if none
  // / more than one is held (so combos don't ambiguously trigger).
  function activeModifier(e) {
    const pressed = [];
    if (e.ctrlKey) pressed.push("ctrl");
    if (e.altKey) pressed.push("alt");
    if (e.shiftKey) pressed.push("shift");
    if (e.metaKey) pressed.push("meta");
    return pressed.length === 1 && pressed[0] !== "meta" ? pressed[0] : null;
  }

  // Walk up a few levels: catches <img>, <img> inside <a>, CSS background-image,
  // and <canvas>.
  function findImageUrl(el) {
    let node = el;
    for (let i = 0; node && i < 5; i++, node = node.parentElement) {
      if (node.tagName === "IMG") return node.currentSrc || node.src || null;
      if (node.tagName === "CANVAS") return canvasToDataUrl(node);
      const bg = backgroundUrl(node);
      if (bg) return bg;
    }
    return null;
  }

  function backgroundUrl(node) {
    if (!node || node.nodeType !== 1) return null;
    const bg = getComputedStyle(node).backgroundImage;
    if (!bg || bg === "none") return null;
    const m = /url\((['"]?)(.*?)\1\)/.exec(bg);
    return m ? m[2] : null;
  }

  function canvasToDataUrl(canvas) {
    try {
      return canvas.toDataURL("image/png");
    } catch (e) {
      return null; // tainted canvas
    }
  }

  function copyUrl(url) {
    navigator.clipboard
      .writeText(url)
      .then(() => toast("URL copied"))
      .catch((err) => fail(err));
  }

  function copyImage(url) {
    // Pass a Promise<Blob> to ClipboardItem so the user gesture survives the
    // async fetch/convert round trip.
    const blobPromise = getPngBlob(url);
    const items = { "image/png": blobPromise };

    if (cfg.alsoCopyHtml && !url.startsWith("data:")) {
      const html = '<img src="' + escapeAttr(url) + '">';
      items["text/html"] = new Blob([html], { type: "text/html" });
    }

    navigator.clipboard
      .write([new ClipboardItem(items)])
      .then(() => toast("Image copied"))
      .catch((err) => fail(err));
  }

  function fail(err) {
    console.error("[Fast Copy]", err);
    toast("Copy failed: " + ((err && err.message) || err), true);
  }

  async function getPngBlob(url) {
    if (url.startsWith("data:")) return dataUrlToBlob(url);

    const resp = await chrome.runtime.sendMessage({
      type: "FAST_COPY_FETCH_IMAGE",
      url,
    });
    if (!resp || !resp.ok) {
      throw new Error((resp && resp.error) || "could not fetch image");
    }
    return dataUrlToBlob(resp.dataUrl);
  }

  function dataUrlToBlob(dataUrl) {
    const comma = dataUrl.indexOf(",");
    const head = dataUrl.slice(0, comma);
    const body = dataUrl.slice(comma + 1);
    const mime = (/:(.*?);/.exec(head) || [, "image/png"])[1];
    const isBase64 = /;base64/i.test(head);
    const raw = isBase64 ? atob(body) : decodeURIComponent(body);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  function escapeAttr(s) {
    return s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  // --- tiny toast notification ---
  let toastEl = null;
  let toastTimer = null;

  function toast(text, isError) {
    if (!cfg.showToast) return;
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.style.cssText = [
        "position:fixed",
        "z-index:2147483647",
        "bottom:20px",
        "left:50%",
        "transform:translateX(-50%)",
        "padding:10px 16px",
        "border-radius:8px",
        "font:13px/1.4 system-ui,sans-serif",
        "color:#fff",
        "box-shadow:0 4px 14px rgba(0,0,0,.3)",
        "pointer-events:none",
        "opacity:0",
        "transition:opacity .15s ease",
      ].join(";");
      (document.body || document.documentElement).appendChild(toastEl);
    }
    toastEl.textContent = text;
    toastEl.style.background = isError ? "#c0392b" : "#2d8a3e";
    toastEl.style.opacity = "1";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      if (toastEl) toastEl.style.opacity = "0";
    }, 1500);
  }
})();
