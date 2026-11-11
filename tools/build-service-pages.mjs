// Builds the service landing pages in EN (site root), BG (bg/) and TR (tr/) from
// the texts in content/<lang>/*.md, using that language's services.html as the
// page template (head, header, footer, scripts). The versions of one service
// are tied together by their `service` key (hreflang), not by file names, since
// each language has its own URL slug. Then each language's services.html gets a
// "learn more" link per service and its home page's service cards open the
// pages.
//
//   node tools/build-service-pages.mjs     (build-langs.mjs also runs it, since it rebuilds bg/ and tr/)
//
// Each .md file: a front matter block (url, title, description, h1, breadcrumb,
// service), then the text: "## " headings, "- " and "1. " lists, paragraphs,
// **bold** and [links](/…). The first paragraph is the intro under the H1. The
// FAQ section (heading in UI[lang].faq) holds **question** lines, each followed
// by its answer; it becomes the visible FAQ and the FAQPage JSON-LD. A notes
// section (UI[lang].notes) is for the author and is not published.
//
// The English services.html and index.html are also the sources of bg/ and tr/:
// the links added to them carry data-svc-page="<service>", so the BG/TR copies
// get their own language's link instead.

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.smartmenukj.com";
// contact.html?service=<key> preselects the service; it is also the section id on services.html.
const SERVICES = ["menu", "web", "cameras", "smarthome", "print3d", "pc"];
const LANGS = ["en", "bg", "tr"];
const X_DEFAULT = "bg";
const PHONE = "+359 88 534 8666";
const UI = {
  en: { dir: "", faq: "FAQ", faqTitle: "Frequently asked questions", notes: "Internal links", region: "Kardzhali and the region",
        quote: "Get a quote", call: "Call", ctaEyebrow: "Free quote within 24 hours", ctaTitle: "Tell us what you need.",
        ctaLede: "We'll reply with a clear written quote within a day, with no obligation.", more: "Learn more", city: "Kardzhali" },
  bg: { dir: "bg/", faq: "Често задавани въпроси", faqTitle: "Често задавани въпроси", notes: "Вътрешни линкове", region: "Кърджали и региона",
        quote: "Поискай оферта", call: "Обади се", ctaEyebrow: "Безплатна оферта до 24 часа", ctaTitle: "Кажете ни какво ви трябва.",
        ctaLede: "Ще ви върнем ясна писмена оферта до един ден, без ангажимент.", more: "Научете повече", city: "Kardzhali" },
  tr: { dir: "tr/", faq: "Sık sorulan sorular", faqTitle: "Sık sorulan sorular", notes: "İç bağlantılar", region: "Kırcaali ve bölgesi",
        quote: "Teklif al", call: "Arayın", ctaEyebrow: "24 saat içinde ücretsiz teklif", ctaTitle: "Neye ihtiyacınız olduğunu anlatın.",
        ctaLede: "Bir gün içinde, hiçbir yükümlülük olmadan net bir yazılı teklif gönderiyoruz.", more: "Daha fazla bilgi", city: "Kardzhali" },
};

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tel = `tel:${PHONE.replace(/\s/g, "")}`;

// **bold**, [text](url) and the phone number; everything else is escaped text.
function inline(text) {
  const out = esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      if (!/^(\/|https:\/\/|tel:|mailto:)/.test(url)) throw new Error(`link must be a site path or https: ${url}`);
      return `<a href="${url}">${label}</a>`;
    });
  return out.replace(esc(PHONE), `<a href="${tel}">${esc(PHONE)}</a>`);
}
const plain = (text) => text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

function parse(md, file, lang) {
  const ui = UI[lang];
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no front matter`);
  const meta = Object.fromEntries(m[1].split("\n").map((l) => l.split(/:\s(.*)/s).slice(0, 2).map((x) => x.trim())));
  for (const k of ["url", "title", "description", "h1", "breadcrumb", "service"]) if (!meta[k]) throw new Error(`${file}: front matter needs ${k}`);
  if (!SERVICES.includes(meta.service)) throw new Error(`${file}: service must be one of ${SERVICES.join(", ")}`);
  if (!new RegExp(`^/${ui.dir.replace("/", "\\/")}[a-z0-9-]+\\.html$`).test(meta.url)) throw new Error(`${file}: url must look like /${ui.dir}<slug>.html`);
  if (meta.breadcrumb.split("›").length !== 3) throw new Error(`${file}: breadcrumb must be "<home> › <services> › <service>"`);

  // Blocks, split by headings and blank lines.
  const sections = [{ heading: null, lines: [] }];
  for (const line of m[2].split("\n")) {
    if (/^# /.test(line)) continue; // the H1 comes from the front matter
    const h = line.match(/^## (.+)/);
    if (h) sections.push({ heading: h[1].trim(), lines: [] });
    else sections[sections.length - 1].lines.push(line);
  }
  const blocks = (lines) => {
    const out = [];
    let cur = null;
    for (const raw of lines) {
      const line = raw.trimEnd();
      const kind = /^- /.test(line) ? "ul" : /^\d+\. /.test(line) ? "ol" : line ? "p" : null;
      if (!kind) { cur = null; continue; }
      const text = line.replace(/^(- |\d+\. )/, "");
      if (cur && cur.kind === kind) cur.items.push(text);
      else out.push((cur = { kind, items: [text] }));
    }
    return out;
  };
  const intro = blocks(sections[0].lines);
  if (!intro.length || intro[0].kind !== "p") throw new Error(`${file}: the text must start with an intro paragraph`);
  const body = [];
  let faq = [];
  for (const s of sections.slice(1)) {
    if (s.heading === ui.notes) continue;
    if (s.heading === ui.faq) {
      for (const l of s.lines.map((x) => x.trim()).filter(Boolean)) {
        const q = l.match(/^\*\*(.+)\*\*$/);
        if (q) faq.push({ q: q[1], a: [] });
        else if (faq.length) faq[faq.length - 1].a.push(l);
        else throw new Error(`${file}: FAQ text before the first **question**`);
      }
      faq = faq.map(({ q, a }) => {
        if (!a.length) throw new Error(`${file}: no answer for "${q}"`);
        return { q, a: a.join(" ") };
      });
      continue;
    }
    body.push({ heading: s.heading, blocks: blocks(s.lines) });
  }
  if (faq.length < 2) throw new Error(`${file}: the FAQ ("## ${ui.faq}") needs at least 2 questions`);
  return { lang, file, meta, lede: intro[0].items.join(" "), rest: intro.slice(1), body, faq };
}

function renderBlocks(blocks) {
  return blocks
    .map((b) => {
      if (b.kind === "p") return `          <p>${inline(b.items.join(" "))}</p>`;
      // Steps keep their numbers in the text: .legal styles every list item as a bullet.
      const items = b.items.map((t, i) => `            <li>${b.kind === "ol" ? `<strong>${i + 1}.</strong> ` : ""}${inline(t)}</li>`);
      return `          <ul>\n${items.join("\n")}\n          </ul>`;
    })
    .join("\n");
}

function jsonLd(page) {
  const { meta, faq, lang } = page;
  const url = SITE + meta.url;
  const crumbs = meta.breadcrumb.split("›").map((s) => s.trim());
  const home = `${SITE}/${UI[lang].dir}`;
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: meta.h1,
        serviceType: crumbs[2],
        description: meta.description,
        url,
        inLanguage: lang,
        provider: { "@id": `${SITE}/#business` },
        areaServed: { "@type": "City", name: UI[lang].city },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: lang,
        mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: plain(q), acceptedAnswer: { "@type": "Answer", text: plain(a) } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [home, `${home}services.html`, url].map((item, i) => ({ "@type": "ListItem", position: i + 1, name: crumbs[i], item })),
      },
    ],
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, "\\u003c")}\n</script>\n`;
}

function render(template, page, twins) {
  const { meta, lang } = page;
  const ui = UI[lang];
  const url = SITE + meta.url;
  const crumbs = meta.breadcrumb.split("›").map((s) => s.trim());
  const up = ui.dir ? "../" : "";
  const head = template.slice(0, template.indexOf("<main"));
  const tail = template.slice(template.indexOf("</main>") + "</main>".length, template.indexOf('<script type="module">'));
  const sub = (html, re, value) => {
    if (!re.test(html)) throw new Error(`template: no match for ${re}`);
    return html.replace(re, (_, a, b) => `${a}${value}${b}`);
  };
  let h = head.replace(/(<html lang="[a-z]+") data-aud-page>/, "$1>");
  h = sub(h, /(<title>)[^<]*(<\/title>)/, esc(meta.title));
  h = sub(h, /(<meta name="description" content=")[^"]*(")/, esc(meta.description));
  h = sub(h, /(<link rel="canonical" href=")[^"]*(")/, url);
  h = sub(h, /(<meta property="og:url" content=")[^"]*(")/, url);
  h = sub(h, /(<meta property="og:title" content=")[^"]*(")/, esc(meta.h1));
  h = sub(h, /(<meta property="og:description" content=")[^"]*(")/, esc(meta.description));
  // hreflang: the versions of this service that exist; x-default is the Bulgarian one (or this page).
  h = h.replace(/<link rel="alternate" hreflang="[^"]+" href="[^"]*" \/>\n/g, "");
  const alts = LANGS.filter((l) => twins[l]).map((l) => `<link rel="alternate" hreflang="${l}" href="${SITE + twins[l]}" />\n`).join("");
  const xDefault = SITE + (twins[X_DEFAULT] || meta.url);
  h = h.replace(/(<link rel="canonical"[^>]*>\n)/, `$1${alts}<link rel="alternate" hreflang="x-default" href="${xDefault}" />\n`);
  if (LANGS.some((l) => !twins[l])) h = h.replace(/<meta property="og:locale:alternate" content="[^"]*" \/>\n/g, "");
  h = h.replace("</head>", jsonLd(page) + "</head>");

  const quote = `contact.html?service=${meta.service}#quote`;
  const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const sections = page.body.map((s) => `          <h2>${esc(s.heading)}</h2>\n${renderBlocks(s.blocks)}`).join("\n\n");
  const faq = page.faq.map(({ q, a }) => `        <details name="faq"><summary>${inline(q)}</summary><p>${inline(a)}</p></details>`).join("\n");
  const main = `<main id="main">
  <section class="page-hero">
    <div class="container">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">${esc(crumbs[0])}</a><span aria-hidden="true">/</span><a href="services.html#${meta.service}">${esc(crumbs[1])}</a><span aria-hidden="true">/</span><span>${esc(crumbs[2])}</span></nav>
      <p class="eyebrow">${esc(ui.region)}</p>
      <h1 class="h-lg">${esc(meta.h1)}</h1>
      <p class="lede">${inline(page.lede)}</p>
      <div class="hero-actions">
        <a href="${quote}" class="btn btn-primary"><span>${esc(ui.quote)}</span>${arrow}</a>
        <a href="${tel}" class="btn btn-ghost"><span>${esc(ui.call)}: ${esc(PHONE)}</span></a>
      </div>
    </div>
  </section>

  <section class="svc">
    <div class="container">
      <article class="card legal-card">
        <div class="legal">
${page.rest.length ? renderBlocks(page.rest) + "\n\n" : ""}${sections}
        </div>
      </article>
    </div>
  </section>

  <section class="section section-alt" id="faq">
    <div class="container">
      <div class="section-head">
        <h2 class="h-lg">${esc(ui.faqTitle)}</h2>
      </div>
      <div class="faq">
${faq}
      </div>
    </div>
  </section>

  <section class="section section-cta">
    <div class="container">
      <div class="cta-band invert">
        <div>
          <p class="eyebrow live">${esc(ui.ctaEyebrow)}</p>
          <h2 class="h-lg">${esc(ui.ctaTitle)}</h2>
          <p class="lede">${esc(ui.ctaLede)}</p>
        </div>
        <div class="hero-actions">
          <a href="${quote}" class="btn btn-primary"><span>${esc(ui.quote)}</span></a>
          <a href="${tel}" class="btn btn-ghost"><span>${esc(ui.call)}: ${esc(PHONE)}</span></a>
        </div>
      </div>
    </div>
  </section>
</main>`;
  const v = (template.match(/js\/i18n\.js\?v=(\d+)/) || [])[1];
  if (!v) throw new Error("template: no asset version");
  const script = `<script type="module">
  import { mountChrome } from "./${up}js/chrome.js?v=${v}";
  import { applyI18n, initLangSwitch } from "./${up}js/i18n.js?v=${v}";
  import { initCookieBanner } from "./${up}js/cookies.js?v=${v}";
  import { initReveal } from "./${up}js/site.js?v=${v}";

  mountChrome();
  applyI18n();
  initLangSwitch();
  initCookieBanner();
  initReveal();
</script>
</body>
</html>
`;
  return h + main + tail + script;
}

// "Learn more" next to each quote button on services.html, and the service
// cards on index.html open the service page. Idempotent; also turns the copies
// that bg/ and tr/ inherit from the English sources into their own language.
function linkPages(root, lang, slugs) {
  const dir = join(root, UI[lang].dir);
  const servicesPath = join(dir, "services.html");
  let services = readFileSync(servicesPath, "utf8")
    .replace(/\n {10}<a href="[^"]*" class="link-chevron" data-svc-page="\w+">[^<]*<\/a>/g, "")
    .replace(/\n {10}<a href="[a-z0-9-]+\.html" class="link-chevron">Научете повече<\/a>/g, ""); // first BG-only version
  for (const [svc, file] of Object.entries(slugs)) {
    const re = new RegExp(`(<a href="contact\\.html\\?service=${svc}#quote" class="btn btn-primary">[\\s\\S]*?</a>)`);
    if (!re.test(services)) throw new Error(`${UI[lang].dir}services.html: no quote button for ${svc}`);
    services = services.replace(re, `$1\n          <a href="${file}" class="link-chevron" data-svc-page="${svc}">${esc(UI[lang].more)}</a>`);
  }
  writeFileSync(servicesPath, services);

  const indexPath = join(dir, "index.html");
  let index = readFileSync(indexPath, "utf8");
  for (const [svc, file] of Object.entries(slugs)) {
    const card = new RegExp(`<a href="services\\.html#${svc}" class="card |<a href="[a-z0-9-]+\\.html" data-svc-page="${svc}" class="card `);
    if (!card.test(index)) throw new Error(`${UI[lang].dir}index.html: no service card for ${svc}`);
    index = index.replace(card, `<a href="${file}" data-svc-page="${svc}" class="card `);
  }
  writeFileSync(indexPath, index);
}

export function buildServicePages(root = ROOT) {
  const pages = [];
  for (const lang of LANGS) {
    const dir = join(root, "content", lang);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".md")).sort()) {
      pages.push(parse(readFileSync(join(dir, f), "utf8"), `content/${lang}/${f}`, lang));
    }
  }
  const byService = {};
  for (const p of pages) {
    const t = (byService[p.meta.service] ??= {});
    if (t[p.lang]) throw new Error(`two ${p.lang} pages for service ${p.meta.service}`);
    t[p.lang] = p.meta.url;
  }
  // Templates are read before any page links are added, and the links are
  // added after all pages are written, so the order of languages never matters.
  const templates = Object.fromEntries(LANGS.map((l) => [l, readFileSync(join(root, UI[l].dir, "services.html"), "utf8")]));
  for (const p of pages) writeFileSync(join(root, p.meta.url.slice(1)), render(templates[p.lang], p, byService[p.meta.service]));
  for (const lang of LANGS) {
    const slugs = Object.fromEntries(pages.filter((p) => p.lang === lang).map((p) => [p.meta.service, p.meta.url.slice(1 + UI[lang].dir.length)]));
    if (Object.keys(slugs).length) linkPages(root, lang, slugs);
  }
  return pages.map((p) => p.meta.url);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const url of buildServicePages()) console.log(`Built ${url.slice(1)}`);
}
