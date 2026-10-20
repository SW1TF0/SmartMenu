// ============================================================================
// Builds the Bulgarian and Turkish twins of every public page into bg/ and
// tr/ (bg/index.html, tr/services.html, …) so search engines can index the
// text in every language.
//
// The English pages stay the single source of truth: this script reads each
// page, takes the strings for the language from js/i18n.js (COMMON) plus the
// page's own registerDict({...}) block, and writes the same markup with the
// translated text already in place, plus a translated
// <title>/description/canonical.
//
// Run:  node tools/build-langs.mjs     (the deploy workflow runs it too;
//       bg/ and tr/ are generated but committed, so GitHub Pages' branch
//       build has them too; re-run after editing a page — never edit bg/ or
//       tr/ by hand)
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.smartmenukj.com";

// Pages that get a twin in each language, with their translated <title>,
// description and social-card text. Login/account/admin are not indexed, so
// they keep the in-place language switch instead.
const BG_PAGES = {
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

const TR_PAGES = {
  "index.html": {
    path: "/tr/",
    title: "SmartMenuKJ — Kırcaali'de Web Sitesi, 3D Baskı, Akıllı Ev, Kamera ve Bilgisayar Servisi",
    description: "SmartMenuKJ Kırcaali'de web siteleri, 3D baskı, akıllı ev ve otomasyon, güvenlik kamerası kurulumu, restoranlar için QR dijital menüler ve bilgisayar/yazıcı servisi sunar. 24 saat içinde ücretsiz teklif.",
    ogTitle: "SmartMenuKJ — Kırcaali'de tasarlanan ve kurulan teknoloji",
    ogDescription: "Web siteleri, 3D baskı, akıllı ev, kamera sistemleri, dijital menüler ve bilgisayar servisi — Kırcaali'de tek ekip.",
  },
  "services.html": {
    path: "/tr/services.html",
    title: "Kırcaali'de Hizmetler — web siteleri, 3D baskı, akıllı ev, kameralar, QR menüler ve bilgisayar onarımı | SmartMenuKJ",
    description: "SmartMenuKJ'nin Kırcaali'deki tüm hizmetleri: web sitesi yapımı, 3D baskı parçalar, akıllı ev ve otomasyon, güvenlik kameraları, restoranlar için QR menüler, bilgisayar ve yazıcı onarımı.",
    ogTitle: "Hizmetler — SmartMenuKJ, Kırcaali",
    ogDescription: "Web siteleri, 3D baskı, akıllı ev, kamera sistemleri, dijital menüler ve bilgisayar/yazıcı servisi — Kırcaali'de tek ekip.",
  },
  "portfolio.html": {
    path: "/tr/portfolio.html",
    title: "Projeler — Kırcaali'de web siteleri, 3D baskı, akıllı ev ve kameralar | SmartMenuKJ",
    description: "SmartMenuKJ projelerinden örnekler: Kırcaali ve Bulgaristan'daki müşteriler için web siteleri, 3D baskı parçalar, akıllı ev, kamera sistemleri, QR menüler ve bilgisayar servisi.",
    ogTitle: "Projeler — SmartMenuKJ",
    ogDescription: "Neler yapıyoruz: web, 3D baskı, akıllı ev, kameralar, dijital menüler ve bilgisayar servisi.",
  },
  "about.html": {
    path: "/tr/about.html",
    title: "Hakkımızda — SmartMenuKJ, Kırcaali'de teknoloji şirketi",
    description: "SmartMenuKJ, Krasimir Uzun tarafından kurulan Kırcaalili bir teknoloji şirketidir: web siteleri, 3D baskı, akıllı ev, kamera sistemleri, dijital menüler ve bilgisayar/yazıcı servisi.",
    ogTitle: "Hakkımızda — SmartMenuKJ",
    ogDescription: "Bir kurucu, altı uzmanlık, tek hedef — Kırcaali'de tasarlanan ve kurulan teknoloji.",
  },
  "contact.html": {
    path: "/tr/contact.html",
    title: "İletişim ve ücretsiz teklif — SmartMenuKJ, Kırcaali",
    description: "Web sitesi, 3D baskı, akıllı ev, güvenlik kamerası, QR menü veya bilgisayar/yazıcı onarımı için SmartMenuKJ'den ücretsiz teklif isteyin. 24 saat içinde yanıt. Tel. +359 88 534 8666.",
    ogTitle: "İletişim — SmartMenuKJ",
    ogDescription: "İhtiyacınızı anlatın — tekliflerin çoğu 24 saat içinde gönderilir. Bağlayıcılığı yoktur.",
  },
  "privacy.html": {
    path: "/tr/privacy.html",
    title: "Gizlilik ve Çerezler — SmartMenuKJ",
    description: "SmartMenuKJ'nin kişisel verileri ve çerezleri nasıl topladığı, kullandığı ve sakladığı ile GDPR kapsamındaki haklarınız.",
  },
  "terms.html": {
    path: "/tr/terms.html",
    title: "Hizmet Şartları — SmartMenuKJ",
    description: "SmartMenuKJ'nin teklifler, ödemeler, kurulum, hesaplar ve sorumluluk ile ilgili hizmet şartları.",
  },
};

// Every language that gets twins: output folder, Open Graph locale and the
// per-page head text.
const LANGS = {
  bg: { name: "Bulgarian", ogLocale: "bg_BG", pages: BG_PAGES },
  tr: { name: "Turkish", ogLocale: "tr_TR", pages: TR_PAGES },
};
const OG_LOCALES = { en: "en_GB", ...Object.fromEntries(Object.entries(LANGS).map(([l, c]) => [l, c.ogLocale])) };

// Root-level files a translated page must still reach one level up.
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
  if (start < 0) return {};
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
function translateBody(html, strings, file, missing) {
  const lookup = (key) => {
    if (!(key in strings)) missing.add(`${file}: ${key}`);
    return strings[key];
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

function setHead(html, meta, lang) {
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
  sub(/(<meta property="og:locale" content=")[^"]*(")/, OG_LOCALES[lang]);
  // The alternates are every other language, in the order the page lists them.
  const others = Object.keys(OG_LOCALES).filter((l) => l !== lang);
  let n = 0;
  html = html.replace(/(<meta property="og:locale:alternate" content=")[^"]*(")/g, (_, a, b) => `${a}${OG_LOCALES[others[n++]] || ""}${b}`);
  sub(/("inLanguage":\s*")en(")/, lang);
  return html.replace(/<html lang="en"/, `<html lang="${lang}"`);
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
const sources = Object.fromEntries(Object.keys(BG_PAGES).map((file) => [file, readFileSync(join(ROOT, file), "utf8")]));

for (const [lang, { pages }] of Object.entries(LANGS)) {
  const out = join(ROOT, lang);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  for (const [file, meta] of Object.entries(pages)) {
    const src = sources[file];
    if (!src.includes(`hreflang="${lang}"`)) throw new Error(`${file}: add the hreflang alternate links to the <head>`);
    const strings = { ...COMMON[lang], ...(pageDict(src, file)[lang] || {}) };
    const html = rebase(setHead(translateBody(src, strings, `${lang}/${file}`, missing), meta, lang));
    writeFileSync(join(out, file), html);
  }
}

if (missing.size) {
  console.error(`Missing translations (left in English):\n  ${[...missing].join("\n  ")}`);
  process.exit(1);
}
for (const [lang, { name, pages }] of Object.entries(LANGS)) console.log(`Built ${Object.keys(pages).length} ${name} pages into ${lang}/`);
