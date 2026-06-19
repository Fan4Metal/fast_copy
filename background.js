// Fast Copy — background service worker.
// Fetches an image (bypassing page CORS via host_permissions), converts it to
// PNG and returns it to the content script as a data URL.

// Clicking the toolbar icon opens the settings page.
chrome.action.onClicked.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "FAST_COPY_FETCH_IMAGE") {
    fetchAsPngDataUrl(msg.url)
      .then((dataUrl) => sendResponse({ ok: true, dataUrl }))
      .catch((err) => sendResponse({ ok: false, error: String((err && err.message) || err) }));
    return true; // keep the message channel open for the async response
  }
});

async function fetchAsPngDataUrl(url) {
  const resp = await fetch(url, { credentials: "include" });
  if (!resp.ok) throw new Error("HTTP " + resp.status);
  const blob = await resp.blob();
  // The clipboard reliably accepts only image/png, so convert everything else.
  const pngBlob = blob.type === "image/png" ? blob : await toPng(blob);
  return await blobToDataUrl(pngBlob);
}

async function toPng(blob) {
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  return await canvas.convertToBlob({ type: "image/png" });
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
