#!/usr/bin/env python3
"""Verify generated artifacts are in sync with src/li_export_md.js."""

import argparse
from pathlib import Path

import build_extension
from PIL import Image


def verify_extension_content(src_js: str, path: Path) -> None:
    expected = build_extension.build_extension_content(src_js)
    actual = path.read_text(encoding="utf-8")
    if actual != expected:
        raise SystemExit(f"{path} is stale. Run: npm run build:extension")


def verify_docs_index(path: Path) -> None:
    html = path.read_text(encoding="utf-8")
    required_terms = [
        "Chrome Web Store",
        "arc://extensions",
        "Load unpacked",
        "LinkedMD",
        "privacy.html",
        "support.html",
    ]
    for term in required_terms:
        if term not in html:
            raise SystemExit(f"{path} missing required install guidance: {term}")


def verify_store_assets(assets_dir: Path) -> None:
    required = {
        "store-icon-128.png": (128, 128),
        "small-promo-440x280.png": (440, 280),
        "marquee-promo-1400x560.png": (1400, 560),
        "screenshots/01-one-click-export.png": (1280, 800),
        "screenshots/02-profile-to-markdown.png": (1280, 800),
        "screenshots/03-popup-experience.png": (1280, 800),
        "screenshots/04-local-only-security.png": (1280, 800),
        "screenshots/05-section-coverage.png": (1280, 800),
    }

    for rel, dims in required.items():
        path = assets_dir / rel
        if not path.exists():
            raise SystemExit(f"Missing store asset: {path}")
        with Image.open(path) as im:
            if im.size != dims:
                raise SystemExit(f"Wrong size for {path}: got {im.size}, expected {dims}")
            if rel.endswith(".png") and rel.startswith("screenshots/") and im.mode != "RGB":
                raise SystemExit(f"{path} must be PNG without alpha (RGB)")


def verify_extension_icons(icon_dir: Path) -> None:
    required = {
        "icon-16.png": (16, 16),
        "icon-32.png": (32, 32),
        "icon-48.png": (48, 48),
        "icon-128.png": (128, 128),
    }
    for name, dims in required.items():
        path = icon_dir / name
        if not path.exists():
            raise SystemExit(f"Missing extension icon: {path}")
        with Image.open(path) as im:
            if im.size != dims:
                raise SystemExit(f"Wrong size for {path}: got {im.size}, expected {dims}")


def verify_store_listing_pack(path: Path) -> None:
    txt = path.read_text(encoding="utf-8")
    required = [
        "Title from package: `LinkedMD`",
        "Summary from package: `Export the current LinkedIn profile page to Markdown.`",
        "Category",
        "Language",
        "Store icon",
        "Screenshots",
        "Small promo tile",
        "Marquee promo tile",
        "Homepage URL",
        "Support URL",
    ]
    for term in required:
        if term not in txt:
            raise SystemExit(f"{path} missing required store-listing field: {term}")


def verify_docs_page(path: Path, page_name: str) -> None:
    if not path.exists():
        raise SystemExit(f"Missing docs page: {path}")
    txt = path.read_text(encoding="utf-8")
    if "LinkedMD" not in txt:
        raise SystemExit(f"{path} missing project name in {page_name} page")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--infile", default="src/li_export_md.js", help="Exporter source file")
    parser.add_argument(
        "--extension-content",
        default="extension/content.js",
        help="Extension content script output file",
    )
    parser.add_argument("--index", default="docs/index.html", help="GitHub Pages landing page")
    parser.add_argument("--store-assets", default="store-assets", help="Store visual assets directory")
    parser.add_argument(
        "--store-fields",
        default="store-assets/chrome-web-store-fields.md",
        help="Chrome Web Store field pack markdown",
    )
    parser.add_argument("--extension-icons", default="extension/icons", help="Extension icon directory")
    parser.add_argument("--privacy-page", default="docs/privacy.html", help="Privacy page")
    parser.add_argument("--support-page", default="docs/support.html", help="Support page")
    args = parser.parse_args()

    src_js = Path(args.infile).read_text(encoding="utf-8")
    verify_extension_content(src_js, Path(args.extension_content))
    verify_docs_index(Path(args.index))
    verify_store_assets(Path(args.store_assets))
    verify_extension_icons(Path(args.extension_icons))
    verify_store_listing_pack(Path(args.store_fields))
    verify_docs_page(Path(args.privacy_page), "privacy")
    verify_docs_page(Path(args.support_page), "support")

    print("Artifacts verified")


if __name__ == "__main__":
    main()
