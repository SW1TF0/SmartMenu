"""Photos of real projects for portfolio.html -> img/portfolio/<name>.webp: cropped to 3:2 around the middle
(like the card), at most 1200 px wide, quality 80.

    python3 tools/portfolio_images.py [--half] <photo.jpg> <name> [<photo.jpg> <name> ...]

--half: 3:4 (one half of a before/after card), at most 600 px wide.

The metadata (EXIF: GPS location, camera, date) is dropped: only the pixels are kept, turned upright first.
Use only photos the owner gave for the site (no faces, no addresses or plates)."""
import os, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'img', 'portfolio')


def convert(src, name, half=False):
    if not name.replace('-', '').isalnum() or name != name.lower():
        raise SystemExit(f'name must be lowercase letters, digits and dashes: {name}')
    img = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    rw, rh, maxw = (3, 4, 600) if half else (3, 2, 1200)  # a before/after card shows two 3:4 halves side by side
    w = min(img.width, round(img.height * rw / rh))
    img = ImageOps.fit(img, (w, round(w * rh / rw)), Image.LANCZOS)  # the card's frame, from the middle
    if img.width > maxw:
        img = img.resize((maxw, round(maxw * rh / rw)), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    dest = os.path.join(OUT, f'{name}.webp')
    img.save(dest, 'WEBP', quality=80, method=6)  # no exif= argument: nothing of the original metadata is written
    print(f'img/portfolio/{name}.webp {img.width}x{img.height} {os.path.getsize(dest) // 1024} KB')


if __name__ == '__main__':
    a = sys.argv[1:]
    half = bool(a) and a[0] == '--half'
    a = a[1:] if half else a
    if not a or len(a) % 2:
        raise SystemExit(__doc__)
    for i in range(0, len(a), 2):
        convert(a[i], a[i + 1], half)
