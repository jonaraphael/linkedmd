#!/usr/bin/env python3
"""Generate Chrome Web Store visual assets for LinkedMD.

If custom source assets exist under `store-assets/images/`, they are treated as
source-of-truth and transformed into all required store/icon outputs:
- images/logo.png -> extension icons + store icon
- images/demo1280.png -> screenshots + promo tiles

If custom assets are missing, fallback visuals are generated.
"""

import argparse
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


BG_TOP = (236, 244, 238)
BG_BOTTOM = (215, 236, 223)
INK = (16, 33, 22)
MUTED = (74, 98, 82)
ACCENT = (13, 111, 68)
ACCENT_DARK = (11, 86, 62)
WHITE = (255, 255, 255)
CARD_LINE = (197, 215, 204)

SCREENSHOT_SPECS = [
    ("01-one-click-export.png", "One-click profile export"),
    ("02-profile-to-markdown.png", "Profile to Markdown in seconds"),
    ("03-popup-experience.png", "Fast, clear extension UX"),
    ("04-local-only-security.png", "Local-only by design"),
    ("05-section-coverage.png", "Comprehensive section coverage"),
]


def load_font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    candidates = []
    if bold:
        candidates.extend(
            [
                "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
                "/System/Library/Fonts/SFNS.ttf",
                "/Library/Fonts/Arial Bold.ttf",
            ]
        )
    else:
        candidates.extend(
            [
                "/System/Library/Fonts/Supplemental/Arial.ttf",
                "/System/Library/Fonts/SFNS.ttf",
                "/Library/Fonts/Arial.ttf",
            ]
        )
    for path in candidates:
        p = Path(path)
        if p.exists():
            return ImageFont.truetype(str(p), size=size)
    return ImageFont.load_default()


def make_gradient(width: int, height: int, top_rgb, bottom_rgb) -> Image.Image:
    img = Image.new("RGB", (width, height), top_rgb)
    draw = ImageDraw.Draw(img)
    for y in range(height):
        t = y / max(1, height - 1)
        c = (
            int(top_rgb[0] * (1 - t) + bottom_rgb[0] * t),
            int(top_rgb[1] * (1 - t) + bottom_rgb[1] * t),
            int(top_rgb[2] * (1 - t) + bottom_rgb[2] * t),
        )
        draw.line([(0, y), (width, y)], fill=c)
    return img


def fit_cover(image: Image.Image, width: int, height: int) -> Image.Image:
    src = image.convert("RGB")
    if src.width == 0 or src.height == 0:
        return Image.new("RGB", (width, height), WHITE)

    ratio = max(width / src.width, height / src.height)
    new_w = max(1, int(round(src.width * ratio)))
    new_h = max(1, int(round(src.height * ratio)))
    resized = src.resize((new_w, new_h), Image.Resampling.LANCZOS)

    left = max(0, (new_w - width) // 2)
    top = max(0, (new_h - height) // 2)
    return resized.crop((left, top, left + width, top + height))


def fit_contain(image: Image.Image, width: int, height: int) -> Image.Image:
    src = image.convert("RGBA")
    if src.width == 0 or src.height == 0:
        return Image.new("RGBA", (width, height), (0, 0, 0, 0))

    ratio = min(width / src.width, height / src.height)
    new_w = max(1, int(round(src.width * ratio)))
    new_h = max(1, int(round(src.height * ratio)))
    resized = src.resize((new_w, new_h), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    x = (width - new_w) // 2
    y = (height - new_h) // 2
    canvas.paste(resized, (x, y), resized)
    return canvas


def draw_logo_badge(draw: ImageDraw.ImageDraw, x: int, y: int, size: int) -> None:
    r = max(4, int(size * 0.22))
    draw.rounded_rectangle(
        [x, y, x + size, y + size],
        radius=r,
        fill=ACCENT,
        outline=(9, 76, 50),
        width=max(1, size // 24),
    )
    inner = int(size * 0.08)
    draw.rounded_rectangle(
        [x + inner, y + inner, x + size - inner, y + size - inner],
        radius=max(3, int(r * 0.7)),
        fill=ACCENT_DARK,
    )
    f = load_font(max(8, int(size * 0.36)), bold=True)
    text = "LM"
    tw = draw.textlength(text, font=f)
    _, _, _, th = draw.textbbox((0, 0), text, font=f)
    tx = x + (size - tw) / 2
    ty = y + (size - th) / 2 - size * 0.02
    draw.text((tx, ty), text, fill=WHITE, font=f)


def fallback_icon(size: int) -> Image.Image:
    im = make_gradient(size, size, (30, 122, 78), (11, 86, 62)).convert("RGBA")
    d = ImageDraw.Draw(im)
    pad = max(1, int(size * 0.06))
    draw_logo_badge(d, pad, pad, size - 2 * pad)
    return im


def load_custom_asset(path: Path) -> Image.Image | None:
    if not path.exists():
        return None
    with Image.open(path) as im:
        return im.copy()


def save_icon_set(outdir: Path, logo_source: Image.Image | None) -> None:
    icons_dir = outdir / "extension-icons"
    icons_dir.mkdir(parents=True, exist_ok=True)

    for size in [16, 32, 48, 128]:
        if logo_source is not None:
            icon = fit_contain(logo_source, size, size)
        else:
            icon = fallback_icon(size)
        icon.save(icons_dir / f"icon-{size}.png", format="PNG")


def stamp_screenshot_title(image: Image.Image, title: str) -> Image.Image:
    im = image.convert("RGB")
    d = ImageDraw.Draw(im)

    bar_h = 92
    d.rectangle([0, 0, im.width, bar_h], fill=(13, 31, 22))

    title_font = load_font(34, bold=True)
    sub_font = load_font(18)
    d.text((24, 18), "LinkedMD", fill=(231, 245, 236), font=title_font)
    d.text((220, 28), title, fill=(198, 224, 207), font=sub_font)

    return im


def save_screenshots(outdir: Path, demo_source: Image.Image | None) -> None:
    screenshots_dir = outdir / "screenshots"
    screenshots_dir.mkdir(parents=True, exist_ok=True)

    if demo_source is None:
        demo_source = make_gradient(1280, 800, BG_TOP, BG_BOTTOM)

    for filename, title in SCREENSHOT_SPECS:
        shot = fit_cover(demo_source, 1280, 800)
        stamped = stamp_screenshot_title(shot, title)
        stamped.save(screenshots_dir / filename, format="PNG")


def save_promo_tile(path: Path, width: int, height: int, title: str, subtitle: str, demo_source: Image.Image | None) -> None:
    if demo_source is not None:
        im = fit_cover(demo_source, width, height)
        d = ImageDraw.Draw(im)
        d.rectangle([0, height - int(height * 0.42), width, height], fill=(12, 38, 28))
    else:
        im = make_gradient(width, height, (233, 243, 236), (203, 229, 214))
        d = ImageDraw.Draw(im)

    draw_logo_badge(d, int(width * 0.05), int(height * 0.14), int(height * 0.32))
    d.text((int(width * 0.22), int(height * 0.18)), title, fill=WHITE, font=load_font(int(height * 0.15), bold=True))
    d.text((int(width * 0.22), int(height * 0.48)), subtitle, fill=(206, 230, 214), font=load_font(int(height * 0.085)))

    im.convert("RGB").save(path, format="PNG")


def write_listing_template(path: Path) -> None:
    content = """# LinkedMD Chrome Web Store Listing Draft

## Product details
- Title: LinkedMD
- Summary: Export the current LinkedIn profile page to Markdown.
- Category: Developer Tools
- Language: English

## URLs
- Official URL: none (unless verified domain)
- Homepage URL: https://github.com/jonaraphael/linkedmd
- Support URL: https://github.com/jonaraphael/linkedmd/issues

## Media files
- Store icon: store-assets/store-icon-128.png
- Screenshots:
  - store-assets/screenshots/01-one-click-export.png
  - store-assets/screenshots/02-profile-to-markdown.png
  - store-assets/screenshots/03-popup-experience.png
  - store-assets/screenshots/04-local-only-security.png
  - store-assets/screenshots/05-section-coverage.png
- Small promo tile: store-assets/small-promo-440x280.png
- Marquee promo tile: store-assets/marquee-promo-1400x560.png

## Policy fields
- Mature content: No
- Item support: On
- Visibility: Public
"""
    path.write_text(content, encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--outdir", default="store-assets", help="Output directory for generated assets")
    args = parser.parse_args()

    outdir = Path(args.outdir)
    outdir.mkdir(parents=True, exist_ok=True)

    images_dir = outdir / "images"
    logo_source = load_custom_asset(images_dir / "logo.png")
    demo_source = load_custom_asset(images_dir / "demo1280.png")

    save_icon_set(outdir, logo_source)
    save_screenshots(outdir, demo_source)

    # Copy extension icons into extension/icons for runtime use.
    ext_icons = Path("extension/icons")
    ext_icons.mkdir(parents=True, exist_ok=True)
    for size in [16, 32, 48, 128]:
        src = outdir / "extension-icons" / f"icon-{size}.png"
        dst = ext_icons / f"icon-{size}.png"
        dst.write_bytes(src.read_bytes())

    (outdir / "store-icon-128.png").write_bytes((outdir / "extension-icons" / "icon-128.png").read_bytes())

    save_promo_tile(
        outdir / "small-promo-440x280.png",
        440,
        280,
        "LinkedMD",
        "LinkedIn to Markdown",
        demo_source,
    )
    save_promo_tile(
        outdir / "marquee-promo-1400x560.png",
        1400,
        560,
        "LinkedMD",
        "Clean profile exports for builders and researchers",
        demo_source,
    )

    write_listing_template(outdir / "listing-template.md")
    print(outdir)


if __name__ == "__main__":
    main()
