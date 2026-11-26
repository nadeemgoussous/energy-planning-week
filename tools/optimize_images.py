"""Resize and re-encode images for the web.

The 2025 portal shipped 33 MB of images — one headshot alone was 5.7 MB. On a
conference wifi or a mobile connection that makes the speakers page unusable.
This script takes full-size originals and writes web-sized JPEG/WebP pairs.

Usage
-----
    python tools/optimize_images.py speakers  <source-folder>
    python tools/optimize_images.py covers    <source-folder>
    python tools/optimize_images.py scene     <source-folder>
    python tools/optimize_images.py speakers  <source-folder> --out=<other-folder>

The source folder holds the originals at whatever size they arrived in; it does
not need to be inside the repo (and originals should NOT be committed). Output
goes to images/speakers/, images/publications/ or images/scene/.

Filenames are slugified: "Ana María Pérez.JPG" -> "ana-maria-perez.jpg".
Each input produces both a .jpg (fallback) and a .webp (served first).
"""

from __future__ import annotations

import sys
import re
import unicodedata
from pathlib import Path

from PIL import Image, ImageOps

REPO = Path(__file__).resolve().parent.parent

PROFILES = {
    # name:        (output dir,               box,        square-crop, jpeg quality)
    "speakers": (REPO / "images" / "speakers", (600, 600), True, 82),
    "covers": (REPO / "images" / "publications", (800, 1200), False, 80),
    "brand": (REPO / "images" / "brand", (900, 900), False, 88),
    # Room photography is wide and gets shown at most 1000px on screen; 78 is
    # the point where a busy conference room stops gaining anything visible.
    "scene": (REPO / "images" / "scene", (1600, 1100), False, 78),
}

SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp"}


def slugify(name: str) -> str:
    """'Ana María Pérez' -> 'ana-maria-perez'."""
    ascii_name = (
        unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode("ascii")
    )
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_name).strip("-").lower()
    return re.sub(r"-{2,}", "-", slug)


def process(src: Path, out_dir: Path, box, square: bool, quality: int) -> tuple[int, int]:
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)  # honour camera rotation
        if im.mode in ("RGBA", "LA", "P"):
            background = Image.new("RGB", im.size, (255, 255, 255))
            im = im.convert("RGBA")
            background.paste(im, mask=im.split()[-1])
            im = background
        else:
            im = im.convert("RGB")

        if square:
            im = ImageOps.fit(im, box, method=Image.LANCZOS, centering=(0.5, 0.38))
            # centering biased upward so heads are not cropped at the forehead
        else:
            im.thumbnail(box, Image.LANCZOS)

        stem = slugify(src.stem)
        out_dir.mkdir(parents=True, exist_ok=True)
        jpg = out_dir / f"{stem}.jpg"
        webp = out_dir / f"{stem}.webp"
        im.save(jpg, "JPEG", quality=quality, optimize=True, progressive=True)
        im.save(webp, "WEBP", quality=quality, method=6)
        return jpg.stat().st_size, webp.stat().st_size


def main() -> int:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]

    if len(args) != 2 or args[0] not in PROFILES:
        print(__doc__)
        print("profiles:", ", ".join(PROFILES))
        return 2

    profile = args[0]
    source = Path(args[1]).expanduser()
    if not source.is_dir():
        print(f"Source folder not found: {source}")
        return 1

    out_dir, box, square, quality = PROFILES[profile]

    # --out lets the same resizing serve things that are not the site, such as the
    # reusable speaker pool in 06 Speakers/.
    for flag in flags:
        if flag.startswith("--out="):
            out_dir = Path(flag.split("=", 1)[1]).expanduser()

    files = sorted(p for p in source.iterdir() if p.suffix.lower() in SUFFIXES)
    if not files:
        print(f"No images in {source}")
        return 1

    before = after = 0
    for src in files:
        try:
            jpg_size, webp_size = process(src, out_dir, box, square, quality)
        except Exception as exc:  # a single bad file should not stop the batch
            print(f"  skipped {src.name}: {exc}")
            continue
        before += src.stat().st_size
        after += webp_size
        print(f"  {src.name:<45} {src.stat().st_size/1024:>8.0f} KB -> {webp_size/1024:>6.0f} KB")

    try:
        shown = out_dir.relative_to(REPO)
    except ValueError:  # --out pointed somewhere outside the repo
        shown = out_dir
    print(f"\n{len(files)} images -> {shown}")
    print(f"{before/1024/1024:.1f} MB in, {after/1024/1024:.1f} MB out (WebP)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
