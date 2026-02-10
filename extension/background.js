"use strict";

const MENU_ID = "linkedmd-export";

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  return tabs && tabs[0] ? tabs[0] : null;
}

function isLinkedInUrl(url) {
  return typeof url === "string" && url.startsWith("https://www.linkedin.com/");
}

async function runExportOnTab(tab) {
  if (!tab || typeof tab.id !== "number") return { ok: false, error: "No active tab" };
  if (!isLinkedInUrl(tab.url)) return { ok: false, error: "Open a LinkedIn profile tab first" };

  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: "LINKEDMD_EXPORT" });
    if (res && res.ok) return { ok: true };
    return { ok: false, error: (res && res.error) || "Export failed" };
  } catch (_) {
    return { ok: false, error: "Reload this LinkedIn tab and try again" };
  }
}

async function runExportOnActiveTab() {
  const tab = await getActiveTab();
  return runExportOnTab(tab);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: MENU_ID,
      title: "Export LinkedIn profile to Markdown",
      contexts: ["page"],
      documentUrlPatterns: ["https://www.linkedin.com/*"],
    });
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!info || info.menuItemId !== MENU_ID) return;
  await runExportOnTab(tab);
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "export_profile") return;
  await runExportOnActiveTab();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg || msg.type !== "LINKEDMD_RUN_EXPORT") return;
  runExportOnActiveTab()
    .then((result) => sendResponse(result))
    .catch((err) => sendResponse({ ok: false, error: String(err && err.message ? err.message : err) }));
  return true;
});
