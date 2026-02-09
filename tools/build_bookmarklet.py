#!/usr/bin/env python3
import argparse
import re
from pathlib import Path
from urllib.parse import quote


PLACEHOLDER = "__BOOKMARKLET_URL__"


def build_bookmarklet(js: str) -> str:
    payload = js.strip()
    return "javascript:" + quote(payload, safe="!()*-._~")


def inject_into_html(html: str, bookmarklet_url: str) -> str:
    if PLACEHOLDER in html:
        return html.replace(PLACEHOLDER, bookmarklet_url)

    # If already injected, keep updates idempotent by replacing existing javascript URL in href.
    return re.sub(
        r'href="(?:__BOOKMARKLET_URL__|javascript:[^"]*)"',
        f'href="{bookmarklet_url}"',
        html,
        count=1,
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--infile", required=True, help="Path to JS payload file")
    ap.add_argument(
        "--out-bookmarklet",
        default="docs/bookmarklet.txt",
        help="Where to write the bookmarklet URL",
    )
    ap.add_argument(
        "--html",
        default="docs/index.html",
        help="HTML file to inject bookmarklet into (in-place)",
    )
    args = ap.parse_args()

    js = Path(args.infile).read_text(encoding="utf-8")
    bml = build_bookmarklet(js)

    out_bml = Path(args.out_bookmarklet)
    out_bml.parent.mkdir(parents=True, exist_ok=True)
    out_bml.write_text(bml + "\n", encoding="utf-8")

    html_path = Path(args.html)
    if html_path.exists():
        html = html_path.read_text(encoding="utf-8")
        html2 = inject_into_html(html, bml)
        html_path.write_text(html2, encoding="utf-8")

    print(bml)


if __name__ == "__main__":
    main()
