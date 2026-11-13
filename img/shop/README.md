WebP copies of the product photos at the site root (/<name>.png), used by the smarthomekj shop
(smarthomekj src/lib/images.ts maps https://smartmenukj.com/<name>.png → /img/shop/<name>.webp and
falls back to the PNG when a copy is missing). A new product photo: add its PNG as before and, for speed,
a WebP here with the same name (quality 82, transparency kept).
