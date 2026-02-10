"use strict";

const statusEl = document.getElementById("status");
const dotEl = document.getElementById("dot");
const hintEl = document.getElementById("hint");
const exportBtn = document.getElementById("exportBtn");

function setStatus(text, kind) {
  statusEl.textContent = text;
  dotEl.classList.remove("ready", "bad");
  if (kind === "ready") dotEl.classList.add("ready");
  if (kind === "bad") dotEl.classList.add("bad");
}

function setHint(text, isError) {
  hintEl.textContent = text;
  hintEl.classList.toggle("error", Boolean(isError));
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs[0] ? tabs[0] : null;
}

function isLinkedInProfileUrl(url) {
  if (typeof url !== "string") return false;
  return /^https:\/\/www\.linkedin\.com\/in\/[^/]+/i.test(url);
}

async function refreshState() {
  const tab = await getActiveTab();
  const ok = tab && isLinkedInProfileUrl(tab.url || "");
  exportBtn.disabled = !ok;

  if (ok) {
    setStatus("Ready on current LinkedIn profile", "ready");
    setHint("Click export to download a Markdown file.", false);
  } else {
    setStatus("Not on a LinkedIn profile", "bad");
    setHint("Open a profile URL like linkedin.com/in/username, then try again.", false);
  }
}

async function runExport() {
  exportBtn.disabled = true;
  const oldLabel = exportBtn.textContent;
  exportBtn.textContent = "Exporting...";
  setStatus("Running export...", "ready");
  setHint("This can take a few seconds for long profiles.", false);

  try {
    const res = await chrome.runtime.sendMessage({ type: "LINKEDMD_RUN_EXPORT" });
    if (res && res.ok) {
      setStatus("Export complete", "ready");
      setHint("Markdown downloaded. You can run again on another profile.", false);
      exportBtn.textContent = "Export Again";
    } else {
      setStatus("Export failed", "bad");
      setHint((res && res.error) || "Unknown error", true);
      exportBtn.textContent = oldLabel;
    }
  } catch (err) {
    setStatus("Export failed", "bad");
    setHint(String((err && err.message) || err || "Unknown error"), true);
    exportBtn.textContent = oldLabel;
  } finally {
    const tab = await getActiveTab();
    exportBtn.disabled = !tab || !isLinkedInProfileUrl(tab.url || "");
  }
}

exportBtn.addEventListener("click", runExport);
refreshState().catch(() => {
  setStatus("Unable to read current tab", "bad");
  setHint("Check extension permissions and reload this page.", true);
  exportBtn.disabled = true;
});
