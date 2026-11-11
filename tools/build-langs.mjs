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
//
// It also refuses to build when:
//   - a page is missing a Bulgarian or Turkish string,
//   - a "For home" string ("key@personal") exists in one language but not
//     the others,
//   - the ?v= asset versions don't all match (see tools/stamp-version.mjs).
// ============================================================================
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ASSET_REF, sourceFiles } from "./stamp-version.mjs";
import { buildServicePages } from "./build-service-pages.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.smartmenukj.com";

// Pages that get a twin in each language, with their translated <title>,
// description and social-card text. Login/account/admin are not indexed, so
// they keep the in-place language switch instead.
const BG_PAGES = {
  "index.html": {
    path: "/bg/",
    title: "QR менюта, сайтове и камери в Кърджали | SmartMenuKJ",
    description: "QR менюта, изработка на сайтове, видеонаблюдение, умен дом, 3D печат и компютърен сервиз в Кърджали. Един екип за всичко. Безплатна оферта до 24 ч.",
    ogTitle: "QR менюта, сайтове и камери в Кърджали | SmartMenuKJ",
    ogDescription: "QR менюта, изработка на сайтове, видеонаблюдение, умен дом, 3D печат и компютърен сервиз в Кърджали. Един екип за всичко. Безплатна оферта до 24 ч.",
  },
  "services.html": {
    path: "/bg/services.html",
    title: "Услуги в Кърджали: сайтове, камери, QR меню | SmartMenuKJ",
    description: "Шестте услуги на SmartMenuKJ в Кърджали: сайтове, QR менюта, видеонаблюдение, умен дом, 3D печат, ремонт на компютри и принтери. Оферта до 24 ч.",
    ogTitle: "Услуги в Кърджали: сайтове, камери, QR меню | SmartMenuKJ",
    ogDescription: "Шестте услуги на SmartMenuKJ в Кърджали: сайтове, QR менюта, видеонаблюдение, умен дом, 3D печат, ремонт на компютри и принтери. Оферта до 24 ч.",
  },
  "portfolio.html": {
    path: "/bg/portfolio.html",
    title: "Проекти в Кърджали: сайтове, камери, 3D | SmartMenuKJ",
    description: "Проекти на SmartMenuKJ в Кърджали и България: сайтове, QR менюта, видеонаблюдение, умен дом, 3D печат на части и компютърен сервиз.",
    ogTitle: "Проекти в Кърджали: сайтове, камери, 3D | SmartMenuKJ",
    ogDescription: "Проекти на SmartMenuKJ в Кърджали и България: сайтове, QR менюта, видеонаблюдение, умен дом, 3D печат на части и компютърен сервиз.",
  },
  "about.html": {
    path: "/bg/about.html",
    title: "За нас: SmartMenuKJ, технологична фирма в Кърджали",
    description: "SmartMenuKJ е технологична фирма от Кърджали, основана от Красимир Узун: сайтове, QR менюта, камери, умен дом, 3D печат и компютърен сервиз.",
    ogTitle: "За нас: SmartMenuKJ, технологична фирма в Кърджали",
    ogDescription: "SmartMenuKJ е технологична фирма от Кърджали, основана от Красимир Узун: сайтове, QR менюта, камери, умен дом, 3D печат и компютърен сервиз.",
  },
  "contact.html": {
    path: "/bg/contact.html",
    title: "Контакти и безплатна оферта в Кърджали | SmartMenuKJ",
    description: "Безплатна оферта в Кърджали за сайт, QR меню, камери, умен дом, 3D печат или ремонт на компютър. Писмен отговор до 24 ч. Тел. +359 88 534 8666.",
    ogTitle: "Контакти и безплатна оферта в Кърджали | SmartMenuKJ",
    ogDescription: "Безплатна оферта в Кърджали за сайт, QR меню, камери, умен дом, 3D печат или ремонт на компютър. Писмен отговор до 24 ч. Тел. +359 88 534 8666.",
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
    title: "Kırcaali'de QR Menü, Web Sitesi ve Kamera | SmartMenuKJ",
    description: "Kırcaali'de QR menü, web sitesi, güvenlik kamerası, akıllı ev, 3D baskı ve bilgisayar servisi. Hepsi tek ekipten. 24 saatte ücretsiz yazılı teklif.",
    ogTitle: "Kırcaali'de QR Menü, Web Sitesi ve Kamera | SmartMenuKJ",
    ogDescription: "Kırcaali'de QR menü, web sitesi, güvenlik kamerası, akıllı ev, 3D baskı ve bilgisayar servisi. Hepsi tek ekipten. 24 saatte ücretsiz yazılı teklif.",
  },
  "services.html": {
    path: "/tr/services.html",
    title: "Kırcaali'de Hizmetler: Web, Kamera, QR Menü | SmartMenuKJ",
    description: "SmartMenuKJ'nin Kırcaali'deki altı hizmeti: web sitesi, QR menü, güvenlik kamerası, akıllı ev, 3D baskı, bilgisayar ve yazıcı servisi. 24 saatte teklif.",
    ogTitle: "Kırcaali'de Hizmetler: Web, Kamera, QR Menü | SmartMenuKJ",
    ogDescription: "SmartMenuKJ'nin Kırcaali'deki altı hizmeti: web sitesi, QR menü, güvenlik kamerası, akıllı ev, 3D baskı, bilgisayar ve yazıcı servisi. 24 saatte teklif.",
  },
  "portfolio.html": {
    path: "/tr/portfolio.html",
    title: "Kırcaali'de Projeler: Web, Kamera, 3D | SmartMenuKJ",
    description: "SmartMenuKJ'nin Kırcaali ve Bulgaristan'daki projeleri: web siteleri, QR menüler, güvenlik kameraları, akıllı ev, 3D baskı parçalar ve bilgisayar servisi.",
    ogTitle: "Kırcaali'de Projeler: Web, Kamera, 3D | SmartMenuKJ",
    ogDescription: "SmartMenuKJ'nin Kırcaali ve Bulgaristan'daki projeleri: web siteleri, QR menüler, güvenlik kameraları, akıllı ev, 3D baskı parçalar ve bilgisayar servisi.",
  },
  "about.html": {
    path: "/tr/about.html",
    title: "Hakkımızda: SmartMenuKJ, Kırcaali'de teknoloji",
    description: "SmartMenuKJ, Krasimir Uzun'un kurduğu Kırcaalili teknoloji şirketi: web sitesi, QR menü, kamera, akıllı ev, 3D baskı ve bilgisayar servisi.",
    ogTitle: "Hakkımızda: SmartMenuKJ, Kırcaali'de teknoloji",
    ogDescription: "SmartMenuKJ, Krasimir Uzun'un kurduğu Kırcaalili teknoloji şirketi: web sitesi, QR menü, kamera, akıllı ev, 3D baskı ve bilgisayar servisi.",
  },
  "contact.html": {
    path: "/tr/contact.html",
    title: "Kırcaali'de İletişim ve Ücretsiz Teklif | SmartMenuKJ",
    description: "Kırcaali'de web sitesi, QR menü, kamera, akıllı ev, 3D baskı veya bilgisayar servisi için ücretsiz teklif. 24 saatte yazılı yanıt. +359 88 534 8666.",
    ogTitle: "Kırcaali'de İletişim ve Ücretsiz Teklif | SmartMenuKJ",
    ogDescription: "Kırcaali'de web sitesi, QR menü, kamera, akıllı ev, 3D baskı veya bilgisayar servisi için ücretsiz teklif. 24 saatte yazılı yanıt. +359 88 534 8666.",
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

// The Inter subset each language needs on top of the Latin one, preloaded so
// the headline doesn't render in a fallback font first.
const FONT_PRELOADS = { bg: "fonts/inter-cyrillic.woff2", tr: "fonts/inter-latin-ext.woff2" };

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
  const font = FONT_PRELOADS[lang];
  if (font) {
    html = html.replace(/(<link rel="preload" href="fonts\/inter-latin\.woff2"[^>]*>\n)/, `$1<link rel="preload" href="${font}" as="font" type="font/woff2" crossorigin />\n`);
  }
  return html.replace(/<html lang="en"/, `<html lang="${lang}"`);
}

// Structured data in a translated page: Service URLs point to this language's
// pages, every inLanguage is this language, and the FAQPage questions and
// answers come from the page dictionary. The English JSON-LD must quote the
// English FAQ strings exactly, so Google never sees answers that differ from
// the page.
function localizeJsonLd(html, lang, dict, file) {
  const en = dict.en || {};
  const tr = dict[lang] || {};
  const keyOf = new Map(Object.entries(en).filter(([k]) => /^faq\.\d+\.[qa]$/.test(k)).map(([k, v]) => [v, k]));
  const say = (text) => {
    const key = keyOf.get(text);
    if (!key) throw new Error(`${file}: FAQPage text is not an English faq.N.q/a string: ${text.slice(0, 60)}`);
    if (!(key in tr)) throw new Error(`${lang}/${file}: no ${lang} string for ${key}`);
    return tr[key];
  };
  const walk = (node) => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (!node || typeof node !== "object") return;
    if ("inLanguage" in node) node.inLanguage = lang;
    if (node["@type"] === "Service" && typeof node.url === "string" && node.url.startsWith(SITE + "/")) {
      node.url = `${SITE}/${lang}/${node.url.slice(SITE.length + 1)}`;
    }
    if (node["@type"] === "FAQPage") {
      const asked = new Set(node.mainEntity.map((q) => keyOf.get(q.name)));
      const onPage = Object.keys(en).filter((k) => /^faq\.\d+\.q$/.test(k));
      if (onPage.some((k) => !asked.has(k))) throw new Error(`${file}: FAQPage must list every FAQ question on the page`);
      for (const q of node.mainEntity) {
        q.name = say(q.name);
        q.acceptedAnswer.text = say(q.acceptedAnswer.text);
      }
    }
    Object.values(node).forEach(walk);
  };
  return html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/g, (_, a, json, b) => {
    const data = JSON.parse(json);
    walk(data);
    return `${a}\n${JSON.stringify(data, null, 2).replace(/</g, "\\u003c")}\n${b}`;
  });
}

// Points root-relative assets and the root-only pages one level up.
function rebase(html) {
  return html.replace(/(\s(?:href|src)="|\bimport\s[^"]*"|\bfrom\s+")([^"#:/][^"]*)"/g, (all, lead, url) => {
    if (ASSET_PREFIXES.some((p) => url.startsWith(p))) return `${lead}../${url.replace(/^\.\//, "")}"`;
    if (ROOT_ONLY_PAGES.some((p) => url === p || url.startsWith(p + "?") || url.startsWith(p + "#"))) return `${lead}../${url}"`;
    return all;
  });
}

// Every "key@personal" string must exist in all three languages, or home
// visitors would see the business text in one of them.
function checkAudienceParity(dicts, file, problems) {
  const langs = ["en", ...Object.keys(LANGS)];
  const keys = new Set(langs.flatMap((l) => Object.keys(dicts[l] || {}).filter((k) => k.endsWith("@personal"))));
  for (const key of keys) {
    for (const l of langs) if (!(dicts[l] && key in dicts[l])) problems.add(`${file}: ${key} has no ${l} string`);
  }
}

// One ?v= for every stylesheet, module script and import.
function checkAssetVersions() {
  const versions = new Map();
  for (const file of sourceFiles()) {
    for (const m of readFileSync(join(ROOT, file), "utf8").matchAll(ASSET_REF)) {
      const v = m[3] ? m[3].slice(3) : "(none)";
      if (!versions.has(v)) versions.set(v, `${file}: ${m[2]}`);
    }
  }
  if (versions.size > 1) {
    console.error(`Mixed asset versions — run node tools/stamp-version.mjs:\n  ${[...versions].map(([v, at]) => `?v=${v} (e.g. ${at})`).join("\n  ")}`);
    process.exit(1);
  }
}

// ------------------------------------------------------------------- main --
checkAssetVersions();
const COMMON = await loadCommon();
const missing = new Set();
const sources = Object.fromEntries(Object.keys(BG_PAGES).map((file) => [file, readFileSync(join(ROOT, file), "utf8")]));

const parity = new Set();
checkAudienceParity(COMMON, "js/i18n.js", parity);
for (const [file, src] of Object.entries(sources)) checkAudienceParity(pageDict(src, file), file, parity);
if (parity.size) {
  console.error(`"For home" strings missing in some languages:\n  ${[...parity].join("\n  ")}`);
  process.exit(1);
}

for (const [lang, { pages }] of Object.entries(LANGS)) {
  const out = join(ROOT, lang);
  rmSync(out, { recursive: true, force: true });
  mkdirSync(out, { recursive: true });

  for (const [file, meta] of Object.entries(pages)) {
    const src = sources[file];
    if (!src.includes(`hreflang="${lang}"`)) throw new Error(`${file}: add the hreflang alternate links to the <head>`);
    const strings = { ...COMMON[lang], ...(pageDict(src, file)[lang] || {}) };
    const html = rebase(localizeJsonLd(setHead(translateBody(src, strings, `${lang}/${file}`, missing), meta, lang), lang, pageDict(src, file), file));
    writeFileSync(join(out, file), html);
  }
}

// Bulgarian-only service pages: rebuilt here because bg/ was just cleared.
for (const url of buildServicePages(ROOT)) console.log(`Built ${url.slice(1)}`);

if (missing.size) {
  console.error(`Missing translations (left in English):\n  ${[...missing].join("\n  ")}`);
  process.exit(1);
}
for (const [lang, { name, pages }] of Object.entries(LANGS)) console.log(`Built ${Object.keys(pages).length} ${name} pages into ${lang}/`);
