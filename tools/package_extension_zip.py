#!/usr/bin/env python3
"""Package extension/ into a Chrome Web Store upload zip."""

import argparse
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile


def iter_extension_files(root: Path):
    for path in sorted(root.rglob("*")):
        if path.is_dir():
            continue
        if path.name.startswith("."):
            continue
        yield path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--extension-dir", default="extension", help="Extension source directory")
    parser.add_argument(
        "--outfile",
        default="dist/linkedmd-extension.zip",
        help="Output zip path for Chrome Web Store upload",
    )
    args = parser.parse_args()

    ext_dir = Path(args.extension_dir)
    if not ext_dir.exists():
        raise SystemExit(f"Missing extension directory: {ext_dir}")

    manifest = ext_dir / "manifest.json"
    if not manifest.exists():
        raise SystemExit(f"Missing manifest: {manifest}")

    out_path = Path(args.outfile)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with ZipFile(out_path, "w", compression=ZIP_DEFLATED) as zf:
        for file_path in iter_extension_files(ext_dir):
            zf.write(file_path, arcname=str(file_path.relative_to(ext_dir)))

    print(out_path)


if __name__ == "__main__":
    main()
