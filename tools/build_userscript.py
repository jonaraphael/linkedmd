#!/usr/bin/env python3
"""Build userscript/linkedin-export-md.user.js from src/li_export_md.js."""

import argparse
from pathlib import Path


HEADER = """// ==UserScript==
// @name         LinkedIn -> Markdown Export (local-only)
// @namespace    local
// @version      1.0
// @description  Adds an "Export MD" button on LinkedIn profile pages; downloads dense markdown export.
// @match        https://www.linkedin.com/*
// @grant        none
// ==/UserScript==
"""


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


def build_userscript(src_js: str) -> str:
    body = extract_exporter_body(src_js)

    return (
        HEADER
        + """
(function () {
  "use strict";

  const BTN_ID = "li-export-md-userscript-btn";

  function buildExporter() {
"""
        + body
        + """

    return exportProfileMarkdown;
  }

  if (typeof window.__li_export_md__ !== "function") {
    window.__li_export_md__ = buildExporter();
  }

  function mount() {
    if (!document.body || document.getElementById(BTN_ID)) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.textContent = "Export MD";
    btn.style.cssText = [
      "position:fixed",
      "top:12px",
      "right:12px",
      "z-index:2147483647",
      "padding:8px 10px",
      "border-radius:10px",
      "border:1px solid rgba(0,0,0,0.25)",
      "background:white",
      "color:black",
      "font:600 13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif",
      "box-shadow:0 6px 18px rgba(0,0,0,0.15)",
      "cursor:pointer",
    ].join(";");

    btn.addEventListener("click", async () => {
      const prev = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Exporting...";
      try {
        await window.__li_export_md__();
      } catch (e) {
        console.error(e);
        alert("Export failed. Open DevTools console for details.");
      } finally {
        btn.disabled = false;
        btn.textContent = prev;
      }
    });

    document.body.appendChild(btn);
  }

  mount();
  setInterval(mount, 1200);
})();
"""
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--infile", default="src/li_export_md.js", help="Source exporter payload")
    parser.add_argument(
        "--outfile",
        default="userscript/linkedin-export-md.user.js",
        help="Userscript output path",
    )
    args = parser.parse_args()

    src = Path(args.infile).read_text(encoding="utf-8")
    out = build_userscript(src)

    out_path = Path(args.outfile)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(out, encoding="utf-8")
    print(out_path)


if __name__ == "__main__":
    main()
