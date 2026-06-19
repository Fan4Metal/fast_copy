// Fast Copy — options page logic.

const DEFAULTS = {
  copyImageModifier: "ctrl", // ctrl | alt | shift
  copyUrlModifier: "none", // none | ctrl | alt | shift
  alsoCopyHtml: false,
  showToast: true,
};

const els = {
  copyImageModifier: document.getElementById("copyImageModifier"),
  copyUrlModifier: document.getElementById("copyUrlModifier"),
  alsoCopyHtml: document.getElementById("alsoCopyHtml"),
  showToast: document.getElementById("showToast"),
};
const statusEl = document.getElementById("status");

// Load saved settings into the form.
chrome.storage.sync.get(DEFAULTS, (cfg) => {
  els.copyImageModifier.value = cfg.copyImageModifier;
  els.copyUrlModifier.value = cfg.copyUrlModifier;
  els.alsoCopyHtml.checked = cfg.alsoCopyHtml;
  els.showToast.checked = cfg.showToast;
});

function save() {
  let urlMod = els.copyUrlModifier.value;
  // Prevent the URL modifier from clashing with the image modifier.
  if (urlMod !== "none" && urlMod === els.copyImageModifier.value) {
    urlMod = "none";
    els.copyUrlModifier.value = "none";
    flash("URL modifier cleared — it matched the image modifier", true);
  }

  chrome.storage.sync.set(
    {
      copyImageModifier: els.copyImageModifier.value,
      copyUrlModifier: urlMod,
      alsoCopyHtml: els.alsoCopyHtml.checked,
      showToast: els.showToast.checked,
    },
    () => flash("Saved")
  );
}

let timer = null;
function flash(text, isWarn) {
  statusEl.textContent = text;
  statusEl.style.color = isWarn ? "#c0392b" : "#2d8a3e";
  statusEl.classList.add("show");
  clearTimeout(timer);
  timer = setTimeout(() => statusEl.classList.remove("show"), 1500);
}

for (const el of Object.values(els)) {
  el.addEventListener("change", save);
}
