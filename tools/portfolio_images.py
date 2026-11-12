"""Photos of real projects for portfolio.html -> img/portfolio/<name>.webp: cropped to 3:2 around the middle
(like the card), at most 1200 px wide, quality 80.

    python3 tools/portfolio_images.py <photo.jpg> <name> [<photo.jpg> <name> ...]

The metadata (EXIF: GPS location, camera, date) is dropped: only the pixels are kept, turned upright first.
Use only photos the owner gave for the site (no faces, no addresses or plates)."""
import os, sys
from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'img', 'portfolio')


def convert(src, name):
    if not name.replace('-', '').isalnum() or name != name.lower():
        raise SystemExit(f'name must be lowercase letters, digits and dashes: {name}')
    img = ImageOps.exif_transpose(Image.open(src)).convert('RGB')
    w = min(img.width, round(img.height * 3 / 2))
    img = ImageOps.fit(img, (w, round(w * 2 / 3)), Image.LANCZOS)  # the 3:2 frame of the card, from the middle
    if img.width > 1200:
        img = img.resize((1200, 800), Image.LANCZOS)
    os.makedirs(OUT, exist_ok=True)
    dest = os.path.join(OUT, f'{name}.webp')
    img.save(dest, 'WEBP', quality=80, method=6)  # no exif= argument: nothing of the original metadata is written
    print(f'img/portfolio/{name}.webp {img.width}x{img.height} {os.path.getsize(dest) // 1024} KB')


if __name__ == '__main__':
    a = sys.argv[1:]
    if not a or len(a) % 2:
        raise SystemExit(__doc__)
    for i in range(0, len(a), 2):
        convert(a[i], a[i + 1])
