// ============================================================================
// Builds the Bulgarian twin of every public page into bg/ (bg/index.html,
// bg/services.html, …) so search engines can index the Bulgarian text.
//
// The English pages stay the single source of truth: this script reads each
// page, takes the BG strings from js/i18n.js (COMMON) plus the page's own
// registerDict({...}) block, and writes the same markup with the Bulgarian
// text already in place, plus Bulgarian <title>/description/canonical.
//
// Run:  node tools/build-bg.mjs        (the deploy workflow runs it too;
//       bg/ is generated, so it is git-ignored — never edit it by hand)
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "bg");
const SITE = "https://www.smartmenukj.com";

// Pages that get a Bulgarian twin, with their Bulgarian <title>, description
// and social-card text. Login/account/admin are not indexed, so they keep the
// in-place language switch instead.
const PAGES = {
  "index.html": {
    path: "/bg/",
    title: "SmartMenuKJ — Изработка на сайтове, 3D печат, умен дом, видеонаблюдение и компютърен сервиз в Кърджали",
    description: "SmartMenuKJ в Кърджали: изработка на уебсайтове, 3D принтиране, умен дом и автоматизация, монтаж на камери за видеонаблюдение, QR дигитални менюта за ресторанти и сервиз на компютри и принтери. Безплатна оферта до 24 часа.",
    ogTitle: "SmartMenuKJ — технологии, изградени и монтирани в Кърджали",
    ogDescription: "Уебсайтове, 3D печат, умен дом, видеонаблюдение, дигитални менюта и компютърен сервиз — един екип в Кърджали.",
  },
  "services.html": {
    path: "/bg/services.html",
    title: "Услуги в Кърджали — уебсайтове, 3D печат, умен дом, камери, QR менюта и ремонт на компютри | SmartMenuKJ",
    description: "Всички услуги на SmartMenuKJ в Кърджали: изработка на сайтове, 3D принтиране на части, умен дом и автоматизация, видеонаблюдение и камери, QR менюта за ресторанти, ремонт на компютри и принтери.",
    ogTitle: "Услуги — SmartMenuKJ, Кърджали",
    ogDescription: "Уебсайтове, 3D печат, умен дом, видеонаблюдение, дигитални менюта и сервиз на компютри и принтери — един екип в Кърджали.",
  },
  "portfolio.html": {
    path: "/bg/portfolio.html",
    title: "Проекти — сайтове, 3D печат, умен дом и камери в Кърджали | SmartMenuKJ",
    description: "Примери за проекти на SmartMenuKJ: уебсайтове, 3D принтирани части, умен дом, видеонаблюдение, QR менюта и компютърен сервиз за клиенти в Кърджали и България.",
    ogTitle: "Проекти — SmartMenuKJ",
    ogDescription: "Какви проекти изграждаме: уеб, 3D печат, умен дом, камери, дигитални менюта и компютърен сервиз.",
  },
  "about.html": {
    path: "/bg/about.html",
    title: "За нас — SmartMenuKJ, технологична фирма в Кърджали",
    description: "SmartMenuKJ е технологична фирма от Кърджали, основана от Красимир Узун: уебсайтове, 3D печат, умен дом, видеонаблюдение, дигитални менюта и сервиз на компютри и принтери.",
    ogTitle: "За нас — SmartMenuKJ",
    ogDescription: "Един основател, шест направления, една цел — технологии, изградени и монтирани в Кърджали.",
  },
  "contact.html": {
    path: "/bg/contact.html",
    title: "Контакти и безплатна оферта — SmartMenuKJ, Кърджали",
    description: "Поискайте безплатна оферта от SmartMenuKJ в Кърджали за уебсайт, 3D печат, умен дом, видеонаблюдение, QR меню или ремонт на компютър и принтер. Отговор до 24 часа. Тел. +359 88 534 8666.",
    ogTitle: "Контакти — SmartMenuKJ",
    ogDescription: "Кажете ни какво ви трябва — повечето оферти излизат до 24 часа. Без ангажимент.",
  },
  "privacy.html": {
    path: "/bg/privacy.html",
    title: "Поверителност и бисквитки — SmartMenuKJ",
    description: "Как SmartMenuKJ събира, използва и съхранява лични данни и бисквитки, и вашите права според GDPR.",
  },
  "terms.html": {
    path: "/bg/terms.html",
    title: "Общи условия — SmartMenuKJ",
    description: "Общи условия на SmartMenuKJ за оферти, плащания, монтаж, профили и отговорност.",
  },
};

// Root-level files a /bg/ page must still reach one level up.
const ASSET_PREFIXES = ["css/", "js/", "img/", "fonts/", "./js/"];
const ROOT_ONLY_PAGES = ["login.html", "account.html", "admin.html"];

// ------------------------------------------------------------ dictionaries --
async function loadCommon() {
  // i18n.js touches window and document at import time; give it a harmless stand-in.
  globalThis.window ??= { addEventListener() {} };
  globalThis.document ??= { querySelectorAll: () => [], documentElement: { getAttribute: () => null } };
  const mod = await import(join(ROOT, "js/i18n.js"));
  return mod.COMMON;
}

// Pulls the object literal out of the page's registerDict({...}) call, along
// with any constants the script declares before it (e.g. MAIL).
function pageDict(html, file) {
  const start = html.indexOf("registerDict(");
  if (start < 0) return { en: {}, bg: {} };
  const scriptStart = html.lastIndexOf('<script type="module">', start);
  const prelude = html
    .slice(scriptStart + '<script type="module">'.length, start)
    .split("\n")
    .filter((line) => !/^\s*import\s/.test(line))
    .join("\n");
  let i = html.indexOf("{", start);
  const from = i;
  let depth = 0;
  let quote = null;
  for (; i < html.length; i++) {
    const c = html[i];
    if (quote) {
      if (c === "\\") i++;
      else if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") quote = c;
    else if (c === "{") depth++;
    else if (c === "}" && --depth === 0) break;
  }
  if (depth !== 0) throw new Error(`${file}: could not read registerDict({...})`);
  // Site-authored source, evaluated only at build time.
  return new Function(`${prelude}\nreturn (${html.slice(from, i + 1)});`)();
}

// -------------------------------------------------------------- utilities --
const escText = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escAttr = (s) => escText(s).replace(/"/g, "&quot;");

// Index just past the element's matching close tag, given the index just past
// its opening tag. Counts nested elements of the same name.
function closeTagEnd(html, name, from) {
  const re = new RegExp(`<(/?)${name}\\b[^>]*>`, "gi");
  re.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return { innerEnd: m.index, end: re.lastIndex };
  }
  return null;
}

// Replaces the text of every data-i18n / data-i18n-html element and the
// placeholder / aria-label of data-i18n-ph / data-i18n-aria elements.
function translateBody(html, bg, file, missing) {
  const lookup = (key) => {
    if (!(key in bg)) missing.add(`${file}: ${key}`);
    return bg[key];
  };

  // Attributes first — they never change element boundaries.
  html = html.replace(/<[a-z][^>]*\sdata-i18n-(ph|aria)="([^"]+)"[^>]*>/gi, (tag, kind, key) => {
    const value = lookup(key);
    if (value == null) return tag;
    const attr = kind === "ph" ? "placeholder" : "aria-label";
    const re = new RegExp(`\\s${attr}="[^"]*"`);
    return re.test(tag) ? tag.replace(re, ` ${attr}="${escAttr(value)}"`) : tag.replace(/\s*\/?>$/, (end) => ` ${attr}="${escAttr(value)}"${end}`);
  });

  const open = /<([a-z][a-z0-9]*)\b[^>]*\sdata-i18n(-html)?="([^"]+)"[^>]*>/gi;
  let out = "";
  let pos = 0;
  let m;
  while ((m = open.exec(html))) {
    const [tag, name, isHtml, key] = m;
    const bodyStart = m.index + tag.length;
    const close = closeTagEnd(html, name, bodyStart);
    const value = lookup(key);
    if (!close || value == null) continue;
    out += html.slice(pos, bodyStart) + (isHtml ? value : escText(value));
    pos = close.innerEnd;
    open.lastIndex = close.innerEnd;
  }
  return out + html.slice(pos);
}

function setHead(html, meta) {
  const url = SITE + meta.path;
  const sub = (re, value) => {
    if (!re.test(html)) return;
    html = html.replace(re, (_, a, b) => `${a}${value}${b}`);
  };
  sub(/(<title>)[^<]*(<\/title>)/, escText(meta.title));
  sub(/(<meta name="description" content=")[^"]*(")/, escAttr(meta.description));
  sub(/(<link rel="canonical" href=")[^"]*(")/, url);
  sub(/(<meta property="og:url" content=")[^"]*(")/, url);
  if (meta.ogTitle) sub(/(<meta property="og:title" content=")[^"]*(")/, escAttr(meta.ogTitle));
  if (meta.ogDescription) sub(/(<meta property="og:description" content=")[^"]*(")/, escAttr(meta.ogDescription));
  sub(/(<meta property="og:locale" content=")[^"]*(")/, "bg_BG");
  sub(/(<meta property="og:locale:alternate" content=")[^"]*(")/, "en_GB");
  sub(/("inLanguage":\s*")en(")/, "bg");
  return html.replace(/<html lang="en"/, '<html lang="bg"');
}

// Points root-relative assets and the root-only pages one level up.
function rebase(html) {
  return html.replace(/(\s(?:href|src)="|\bimport\s[^"]*"|\bfrom\s+")([^"#:/][^"]*)"/g, (all, lead, url) => {
    if (ASSET_PREFIXES.some((p) => url.startsWith(p))) return `${lead}../${url.replace(/^\.\//, "")}"`;
    if (ROOT_ONLY_PAGES.some((p) => url === p || url.startsWith(p + "?") || url.startsWith(p + "#"))) return `${lead}../${url}"`;
    return all;
  });
}

// ------------------------------------------------------------------- main --
const COMMON = await loadCommon();
const missing = new Set();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

for (const [file, meta] of Object.entries(PAGES)) {
  const src = readFileSync(join(ROOT, file), "utf8");
  if (!src.includes('hreflang="bg"')) throw new Error(`${file}: add the hreflang alternate links to the <head>`);
  const bg = { ...COMMON.bg, ...pageDict(src, file).bg };
  const html = rebase(setHead(translateBody(src, bg, file, missing), meta));
  writeFileSync(join(OUT, file), html);
}

if (missing.size) {
  console.error(`Missing Bulgarian strings (left in English):\n  ${[...missing].join("\n  ")}`);
  process.exit(1);
}
console.log(`Built ${Object.keys(PAGES).length} Bulgarian pages into bg/`);
