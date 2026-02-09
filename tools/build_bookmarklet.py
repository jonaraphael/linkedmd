#!/usr/bin/env python3
import argparse
from pathlib import Path
from urllib.parse import quote


PLACEHOLDER = "__BOOKMARKLET_URL__"


def build_bookmarklet(js: str) -> str:
    payload = js.strip()
    return "javascript:" + quote(payload, safe="!()*-._~")


def inject_into_html(path: Path, bookmarklet_url: str) -> None:
    html = path.read_text(encoding="utf-8")
    if PLACEHOLDER not in html:
        return
    path.write_text(html.replace(PLACEHOLDER, bookmarklet_url), encoding="utf-8")


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
        help="Optional HTML file that contains __BOOKMARKLET_URL__ placeholder",
    )
    ap.add_argument(
        "--print-url",
        action="store_true",
        help="Print full javascript: bookmarklet URL to stdout",
    )
    args = ap.parse_args()

    js = Path(args.infile).read_text(encoding="utf-8")
    bml = build_bookmarklet(js)

    out_bml = Path(args.out_bookmarklet)
    out_bml.parent.mkdir(parents=True, exist_ok=True)
    out_bml.write_text(bml + "\n", encoding="utf-8")

    if args.html:
        html_path = Path(args.html)
        if html_path.exists():
            inject_into_html(html_path, bml)

    print(out_bml)
    if args.print_url:
        print(bml)


if __name__ == "__main__":
    main()
