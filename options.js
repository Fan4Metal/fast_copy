// Fast Copy — options page logic.

const DEFAULTS = {
  copyImageModifier: "ctrl", // ctrl | alt | shift
  copyUrlModifier: "none", // none | ctrl | alt | shift
  alsoCopyHtml: false,
  showToast: true,
  obsidianEnabled: false,
  obsidianUrl: "http://127.0.0.1:27123",
  obsidianToken: "",
  obsidianAttachmentFolder: "attachments",
  obsidianInsertLink: true,
};

const els = {
  copyImageModifier: document.getElementById("copyImageModifier"),
  copyUrlModifier: document.getElementById("copyUrlModifier"),
  alsoCopyHtml: document.getElementById("alsoCopyHtml"),
  showToast: document.getElementById("showToast"),
  obsidianEnabled: document.getElementById("obsidianEnabled"),
  obsidianUrl: document.getElementById("obsidianUrl"),
  obsidianToken: document.getElementById("obsidianToken"),
  obsidianAttachmentFolder: document.getElementById("obsidianAttachmentFolder"),
  obsidianInsertLink: document.getElementById("obsidianInsertLink"),
};
const urlPreset = document.getElementById("obsidianUrlPreset");
const obsidianFields = document.getElementById("obsidianFields");
const statusEl = document.getElementById("status");

const PRESETS = ["http://127.0.0.1:27123", "https://127.0.0.1:27124"];

// Load saved settings into the form.
chrome.storage.sync.get(DEFAULTS, (cfg) => {
  els.copyImageModifier.value = cfg.copyImageModifier;
  els.copyUrlModifier.value = cfg.copyUrlModifier;
  els.alsoCopyHtml.checked = cfg.alsoCopyHtml;
  els.showToast.checked = cfg.showToast;
  els.obsidianEnabled.checked = cfg.obsidianEnabled;
  els.obsidianUrl.value = cfg.obsidianUrl;
  els.obsidianToken.value = cfg.obsidianToken;
  els.obsidianAttachmentFolder.value = cfg.obsidianAttachmentFolder;
  els.obsidianInsertLink.checked = cfg.obsidianInsertLink;
  urlPreset.value = PRESETS.includes(cfg.obsidianUrl) ? cfg.obsidianUrl : "custom";
  syncUi();
});

function syncUi() {
  obsidianFields.classList.toggle("disabled", !els.obsidianEnabled.checked);
  const custom = urlPreset.value === "custom";
  els.obsidianUrl.style.display = custom ? "" : "none";
}

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
      obsidianEnabled: els.obsidianEnabled.checked,
      obsidianUrl: els.obsidianUrl.value.trim() || DEFAULTS.obsidianUrl,
      obsidianToken: els.obsidianToken.value.trim(),
      obsidianAttachmentFolder:
        els.obsidianAttachmentFolder.value.trim() || DEFAULTS.obsidianAttachmentFolder,
      obsidianInsertLink: els.obsidianInsertLink.checked,
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

// When a preset is picked, copy it into the URL field; "custom" reveals the field.
urlPreset.addEventListener("change", () => {
  if (urlPreset.value !== "custom") els.obsidianUrl.value = urlPreset.value;
  syncUi();
  save();
});

for (const el of Object.values(els)) {
  el.addEventListener("change", () => {
    syncUi();
    save();
  });
}
