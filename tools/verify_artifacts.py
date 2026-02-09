#!/usr/bin/env python3
"""Verify generated artifacts are in sync with src/li_export_md.js."""

import argparse
from pathlib import Path

import build_bookmarklet
import build_userscript


def verify_bookmarklet(src_js: str, path: Path) -> None:
    expected = build_bookmarklet.build_bookmarklet(src_js)
    actual = path.read_text(encoding="utf-8").strip()
    if actual != expected:
        raise SystemExit(f"{path} is stale. Run: npm run build:bookmarklet")


def verify_userscript(src_js: str, path: Path) -> None:
    expected = build_userscript.build_userscript(src_js)
    actual = path.read_text(encoding="utf-8")
    if actual != expected:
        raise SystemExit(f"{path} is stale. Run: npm run build:userscript")


def verify_docs_index(path: Path) -> None:
    html = path.read_text(encoding="utf-8")
    if 'href="javascript:' in html:
        raise SystemExit(f"{path} should not embed bookmarklet payload inline")
    if "bookmarklet.txt" not in html:
        raise SystemExit(f"{path} must load bookmarklet from docs/bookmarklet.txt")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--infile", default="src/li_export_md.js", help="Exporter source file")
    parser.add_argument("--bookmarklet", default="docs/bookmarklet.txt", help="Bookmarklet output file")
    parser.add_argument("--userscript", default="userscript/linkedin-export-md.user.js", help="Userscript output file")
    parser.add_argument("--index", default="docs/index.html", help="GitHub Pages landing page")
    args = parser.parse_args()

    src_js = Path(args.infile).read_text(encoding="utf-8")
    verify_bookmarklet(src_js, Path(args.bookmarklet))
    verify_userscript(src_js, Path(args.userscript))
    verify_docs_index(Path(args.index))

    print("Artifacts verified")


if __name__ == "__main__":
    main()
