// Open Graph pictures (1200×630) for the service pages, one per service and language:
// logo, the service icon, the service name and the region, in the site's style.
//
//   node tools/make-og-images.mjs        -> img/og/<lang>-<service>.jpg (commit them; the build links them)
//
// Needs Playwright with Chromium (only for making the pictures, not for the build).
// The service names come from tools/build-service-pages.mjs (SVC_NAMES, UI[lang].region), the icons from js/icons.js.

import { mkdirSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { SVC_NAMES, UI } from "./build-service-pages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "img", "og");
const { chromium } = createRequire(import.meta.url)("playwright");

// The icon paths, read from js/icons.js (importing it would need a browser).
const iconsJs = readFileSync(join(ROOT, "js", "icons.js"), "utf8");
const icon = (key) => {
  const m = iconsJs.match(new RegExp(`\\b${key}: \\{\\s*path: '([^']+)'`));
  if (!m) throw new Error(`js/icons.js: no icon ${key}`);
  return m[1];
};
const LOGO = '<svg viewBox="0 0 32 32" width="44" height="44"><g fill="#1d1d1f"><rect x="4" y="4" width="10.5" height="10.5" rx="3"/><rect x="17.5" y="4" width="10.5" height="10.5" rx="3"/><rect x="4" y="17.5" width="10.5" height="10.5" rx="3"/></g><circle cx="22.75" cy="22.75" r="5.25" fill="#0a84ff"/></svg>';
const font = (file, range) => `@font-face{font-family:Inter;font-weight:100 900;src:url(${pathToFileURL(join(ROOT, "fonts", file))}) format("woff2");unicode-range:${range}}`;

const page = (lang, key) => `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><style>
${font("inter-latin.woff2", "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD")}
${font("inter-latin-ext.woff2", "U+0100-02AF,U+1E00-1EFF,U+2020,U+20A0-20AB,U+20AD-20CF,U+2113,U+2C60-2C7F,U+A720-A7FF")}
${font("inter-cyrillic.woff2", "U+0400-045F,U+0490-0491,U+04B0-04B1,U+2116")}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:630px;background:#fff;font-family:Inter,sans-serif;color:#1d1d1f;display:flex;flex-direction:column;justify-content:center;padding:0 96px;position:relative;overflow:hidden}
body::after{content:"";position:absolute;right:-160px;top:-160px;width:620px;height:620px;border-radius:50%;background:radial-gradient(circle,rgba(10,132,255,.13),rgba(10,132,255,0) 70%)}
.brand{display:flex;align-items:center;gap:14px;font-weight:600;font-size:34px;letter-spacing:-.02em}
.row{display:flex;align-items:center;gap:40px;margin-top:64px}
.tile{flex:none;width:168px;height:168px;border-radius:40px;background:linear-gradient(180deg,#2c2c2e,#1d1d1f);display:flex;align-items:center;justify-content:center;box-shadow:0 24px 60px rgba(0,0,0,.18)}
.tile svg{width:92px;height:92px;stroke:#fff}
.eyebrow{font-size:30px;font-weight:600;color:#0066cc;letter-spacing:-.01em}
h1{font-size:76px;line-height:1.02;font-weight:700;letter-spacing:-.045em;margin-top:10px;max-width:820px;text-wrap:balance}
.url{position:absolute;left:96px;bottom:56px;font-size:26px;color:#6e6e73;letter-spacing:-.01em}
</style></head><body>
<div class="brand">${LOGO}SmartMenuKJ</div>
<div class="row"><div class="tile"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icon(key)}</svg></div>
<div><p class="eyebrow">${UI[lang].region}</p><h1>${SVC_NAMES[lang][key]}</h1></div></div>
<p class="url">smartmenukj.com</p>
</body></html>`;

mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch();
const tab = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
for (const lang of Object.keys(SVC_NAMES)) {
  for (const key of Object.keys(SVC_NAMES[lang])) {
    await tab.setContent(page(lang, key), { waitUntil: "load" });
    await tab.evaluate(() => document.fonts.ready);
    const file = join(OUT, `${lang}-${key}.jpg`);
    await tab.screenshot({ path: file, type: "jpeg", quality: 88 });
    const kb = Math.round(statSync(file).size / 1024);
    if (kb >= 200) throw new Error(`${file}: ${kb} KB (must be < 200 KB)`);
    console.log(`img/og/${lang}-${key}.jpg ${kb} KB`);
  }
}
await browser.close();
