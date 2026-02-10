#!/usr/bin/env python3
"""Build extension/content.js from src/li_export_md.js."""

import argparse
from pathlib import Path


def extract_exporter_body(src_js: str) -> str:
    lines = src_js.splitlines()
    if not lines:
        raise ValueError("source is empty")
    if "(async function" not in lines[0]:
        raise ValueError("expected src to start with an async IIFE")

    end_idx = None
    marker = "window.__li_export_md__ = exportProfileMarkdown;"
    for i, line in enumerate(lines):
        if marker in line:
            end_idx = i
            break
    if end_idx is None:
        raise ValueError(f"missing marker line: {marker}")

    body_lines = lines[1:end_idx]
    while body_lines and not body_lines[0].strip():
        body_lines.pop(0)
    while body_lines and not body_lines[-1].strip():
        body_lines.pop()

    return "\n".join("  " + line for line in body_lines)


def build_extension_content(src_js: str) -> str:
    body = extract_exporter_body(src_js)

    return (
        """(function () {
  "use strict";

  function buildExporter() {
"""
        + body
        + """

    return exportProfileMarkdown;
  }

  if (typeof window.__li_export_md__ !== "function") {
    window.__li_export_md__ = buildExporter();
  }

  let running = false;

  function showToast(text, variant) {
    try {
      const id = "__linkedmd_toast__";
      const old = document.getElementById(id);
      if (old) old.remove();

      const el = document.createElement("div");
      el.id = id;
      el.textContent = text;
      const bg = variant === "error" ? "rgba(160, 22, 22, 0.94)" : "rgba(12, 84, 58, 0.95)";
      el.style.cssText = [
        "position:fixed",
        "top:18px",
        "right:18px",
        "z-index:2147483647",
        "padding:10px 14px",
        "border-radius:12px",
        "background:" + bg,
        "color:#fff",
        "font:600 12px/1.25 -apple-system, BlinkMacSystemFont, Segoe UI, Helvetica, Arial, sans-serif",
        "box-shadow:0 10px 26px rgba(0,0,0,0.22)",
        "backdrop-filter: blur(3px)",
      ].join(";");
      document.documentElement.appendChild(el);
      setTimeout(() => {
        if (el && el.remove) el.remove();
      }, 1800);
    } catch (_) {}
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || msg.type !== "LINKEDMD_EXPORT") return;

    if (running) {
      sendResponse({ ok: false, error: "Export already in progress" });
      return true;
    }

    running = true;
    showToast("LinkedMD: exporting profile...", "info");

    Promise.resolve(window.__li_export_md__())
      .then(() => {
        showToast("LinkedMD: markdown downloaded", "info");
        sendResponse({ ok: true });
      })
      .catch((err) => {
        console.error(err);
        showToast("LinkedMD: export failed", "error");
        sendResponse({
          ok: false,
          error: String((err && err.message) || err || "unknown error"),
        });
      })
      .finally(() => {
        running = false;
      });

    return true;
  });
})();
"""
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--infile", default="src/li_export_md.js", help="Source exporter payload")
    parser.add_argument("--outfile", default="extension/content.js", help="Extension content script output")
    args = parser.parse_args()

    src = Path(args.infile).read_text(encoding="utf-8")
    out = build_extension_content(src)

    out_path = Path(args.outfile)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(out, encoding="utf-8")
    print(out_path)


if __name__ == "__main__":
    main()
