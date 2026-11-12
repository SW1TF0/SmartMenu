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

import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.smartmenukj.com";
// contact.html?service=<key> preselects the service; it is also the section id on services.html.
const SERVICES = ["menu", "web", "cameras", "smarthome", "print3d", "pc"];
const LANGS = ["en", "bg", "tr"];
const X_DEFAULT = "bg";
const PHONE = "+359 88 534 8666";
// Link text for each service in the "other services" block (SEO audit M-1111-24).
export const SVC_NAMES = {
  en: { menu: "QR menus for restaurants", web: "Website design", cameras: "CCTV & security cameras", smarthome: "Smart home automation", print3d: "3D printing", pc: "Computer & printer repair" },
  bg: { menu: "QR меню за заведения", web: "Изработка на сайтове", cameras: "Видеонаблюдение и камери", smarthome: "Умен дом и автоматизация", print3d: "3D печат", pc: "Компютърен сервиз и принтери" },
  tr: { menu: "Restoranlar için QR menü", web: "Web sitesi tasarımı", cameras: "Güvenlik kamerası sistemleri", smarthome: "Akıllı ev otomasyonu", print3d: "3D baskı", pc: "Bilgisayar ve yazıcı servisi" },
};
export const UI = {
  en: { dir: "", faq: "FAQ", faqTitle: "Frequently asked questions", notes: "Internal links", region: "Kardzhali and the region",
        quote: "Get a quote", call: "Call", others: "Other services in Kardzhali", ctaEyebrow: "Free quote within 24 hours", ctaTitle: "Tell us what you need.",
        ctaLede: "We'll reply with a clear written quote within a day, with no obligation.", more: "Learn more", readMore: "Read more", city: "Kardzhali",
        blog: "Blog", moreBlog: "More from the blog", blogCta: "Blog: tips on QR menus, cameras and smart homes",
        blogTitle: "Blog — tips on QR menus, CCTV and smart homes | SmartMenuKJ",
        blogLede: "Practical notes for owners of restaurants, shops and homes in Kardzhali: how the technology we install works and how to choose.",
        published: "Published", months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"] },
  bg: { dir: "bg/", faq: "Често задавани въпроси", faqTitle: "Често задавани въпроси", notes: "Вътрешни линкове", region: "Кърджали и региона",
        quote: "Поискай оферта", call: "Обади се", others: "Други услуги в Кърджали", ctaEyebrow: "Безплатна оферта до 24 часа", ctaTitle: "Кажете ни какво ви трябва.",
        ctaLede: "Ще ви върнем ясна писмена оферта до един ден, без ангажимент.", more: "Научете повече", readMore: "Прочетете още", city: "Kardzhali",
        blog: "Блог", moreBlog: "Още от блога", faqSee: "Вижте и", faqLink: "често задаваните въпроси", faqCta: "Често задавани въпроси за всички услуги", blogCta: "Блог: съвети за QR менюта, камери и умен дом",
        blogTitle: "Блог — съвети за QR менюта, видеонаблюдение и умен дом | SmartMenuKJ", blogLede: "Полезно за собственици на заведения, магазини и домове в Кърджали: как работят технологиите, които монтираме, и как да изберете.",
        published: "Публикувано", months: ["януари", "февруари", "март", "април", "май", "юни", "юли", "август", "септември", "октомври", "ноември", "декември"] },
  tr: { dir: "tr/", faq: ["Sık sorulan sorular", "Sıkça sorulan sorular"], faqTitle: "Sık sorulan sorular", notes: "İç bağlantılar", region: "Kırcaali ve bölgesi",
        quote: "Teklif al", call: "Arayın", others: "Kırcaali'deki diğer hizmetlerimiz", ctaEyebrow: "24 saat içinde ücretsiz teklif", ctaTitle: "Neye ihtiyacınız olduğunu anlatın.",
        ctaLede: "Bir gün içinde, hiçbir yükümlülük olmadan net bir yazılı teklif gönderiyoruz.", more: "Daha fazla bilgi", readMore: "Devamını okuyun", city: "Kardzhali",
        blog: "Blog", moreBlog: "Blogdan daha fazlası", blogCta: "Blog: QR menü, kamera ve akıllı ev ipuçları",
        blogTitle: "Blog — QR menü, güvenlik kamerası ve akıllı ev ipuçları | SmartMenuKJ",
        blogLede: "Kırcaali'deki restoran, mağaza ve ev sahipleri için: kurduğumuz teknolojiler nasıl çalışır ve nasıl seçilir.",
        published: "Yayın tarihi", months: ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"] },
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

// Markdown lines -> blocks: "### " h3, "- " list, "1. " steps, "=> [label](https://…)" buttons, paragraphs (split by blank lines).
function mdBlocks(lines) {
  const out = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const kind = /^### /.test(line) ? "h3" : /^- /.test(line) ? "ul" : /^\d+\. /.test(line) ? "ol" : /^=> /.test(line) ? "btn" : line ? "p" : null;
    if (!kind) { cur = null; continue; }
    const text = line.replace(/^(### |- |\d+\. |=> )/, "");
    if (kind === "h3") { out.push((cur = { kind, items: [text] })); cur = null; continue; }
    if (cur && cur.kind === kind) cur.items.push(text);
    else out.push((cur = { kind, items: [text] }));
  }
  return out;
}

function parse(md, file, lang, kind = "service") {
  const ui = UI[lang];
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no front matter`);
  const meta = Object.fromEntries(m[1].split("\n").map((l) => l.split(/:\s(.*)/s).slice(0, 2).map((x) => x.trim())));
  const need = kind === "article" ? ["url", "title", "description", "h1", "breadcrumb", "date", "service"] : ["url", "title", "description", "h1", "breadcrumb", "service"];
  for (const k of need) if (!meta[k]) throw new Error(`${file}: front matter needs ${k}`);
  const dir = kind === "article" ? `${ui.dir}blog/` : ui.dir;
  if (!new RegExp(`^/${dir.replace(/\//g, "\\/")}[a-z0-9-]+\\.html$`).test(meta.url)) throw new Error(`${file}: url must look like /${dir}<slug>.html`);
  if (kind === "article") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.date)) throw new Error(`${file}: date must be YYYY-MM-DD`);
    if (!/^\/[a-z0-9/-]+\.html$/.test(meta.service)) throw new Error(`${file}: service must be the URL of the service page`);
  } else if (!SERVICES.includes(meta.service)) throw new Error(`${file}: service must be one of ${SERVICES.join(", ")}`);
  if (meta.breadcrumb.split("›").length !== 3) throw new Error(`${file}: breadcrumb must be "<home> › <services> › <service>"`);

  // Blocks, split by headings and blank lines.
  const sections = [{ heading: null, lines: [] }];
  for (const line of m[2].split("\n")) {
    if (/^# /.test(line)) continue; // the H1 comes from the front matter
    const h = line.match(/^## (.+)/);
    if (h) sections.push({ heading: h[1].trim(), lines: [] });
    else sections[sections.length - 1].lines.push(line);
  }
  const intro = mdBlocks(sections[0].lines);
  if (!intro.length || intro[0].kind !== "p") throw new Error(`${file}: the text must start with an intro paragraph`);
  const body = [];
  let faq = [];
  for (const s of sections.slice(1)) {
    if (s.heading === ui.notes) continue;
    if ([].concat(ui.faq).includes(s.heading)) {
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
    body.push({ heading: s.heading, blocks: mdBlocks(s.lines) });
  }
  // Service pages need a FAQ; an article may have none (e.g. a case study), but if it has one, at least 2 questions.
  if ((kind !== "article" || faq.length) && faq.length < 2) throw new Error(`${file}: the FAQ ("## ${[].concat(ui.faq)[0]}") needs at least 2 questions`);
  return { lang, file, meta, lede: intro[0].items.join(" "), rest: intro.slice(1), body, faq };
}

// A row of buttons from "=> [label](url)" lines: the first one primary; links to other sites open in a new tab.
function renderButtons(b, indent = "          ") {
  const links = b.items.map((t) => {
    const m = t.match(/^\[([^\]]+)\]\(((?:https:\/\/|\/)[^)\s]+)\)$/);
    if (!m) throw new Error(`a "=> " line must be exactly [label](https://… or /…): ${t}`);
    const ext = m[2].startsWith("https://") && !m[2].startsWith(SITE);
    return `<a href="${esc(m[2])}" class="btn ${b.items.indexOf(t) === 0 ? "btn-primary" : "btn-ghost"}"${ext ? ' target="_blank" rel="noopener"' : ""}><span>${esc(m[1])}</span></a>`;
  });
  return `${indent}<div class="hero-actions">\n${links.map((l) => `${indent}  ${l}`).join("\n")}\n${indent}</div>`;
}

function renderBlocks(blocks) {
  return blocks
    .map((b) => {
      if (b.kind === "btn") return renderButtons(b);
      if (b.kind === "p") return `          <p>${inline(b.items.join(" "))}</p>`;
      if (b.kind === "h3") return `          <h3>${inline(b.items[0])}</h3>`;
      // Steps keep their numbers in the text: .legal styles every list item as a bullet.
      const items = b.items.map((t, i) => `            <li>${b.kind === "ol" ? `<strong>${i + 1}.</strong> ` : ""}${inline(t)}</li>`);
      return `          <ul${b.kind === "ol" ? ' class="legal-steps"' : ""}>\n${items.join("\n")}\n          </ul>`;
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

// Head, footer and scripts of a generated page, from a services.html template.
// `base` ("/bg/") makes every relative link of the shared header, footer and
// assets resolve as on the language's top level, for pages one folder deeper.
function shell(template, { lang, url, title, description, ogTitle, alts, xDefault, jsonld, base = "", ogType = "website", image = null }) {
  const up = UI[lang].dir ? "../" : "";
  const head = template.slice(0, template.indexOf("<main"));
  const tail = template.slice(template.indexOf("</main>") + "</main>".length, template.indexOf('<script type="module">'));
  const sub = (html, re, value) => {
    if (!re.test(html)) throw new Error(`template: no match for ${re}`);
    return html.replace(re, (_, a, b) => `${a}${value}${b}`);
  };
  let h = head.replace(/(<html lang="[a-z]+") data-aud-page>/, "$1>");
  if (base) h = h.replace(/(<head>\n)/, `$1<base href="${base}" />\n`);
  h = sub(h, /(<title>)[^<]*(<\/title>)/, esc(title));
  h = sub(h, /(<meta name="description" content=")[^"]*(")/, esc(description));
  h = sub(h, /(<link rel="canonical" href=")[^"]*(")/, url);
  h = sub(h, /(<meta property="og:url" content=")[^"]*(")/, url);
  h = sub(h, /(<meta property="og:title" content=")[^"]*(")/, esc(ogTitle));
  h = sub(h, /(<meta property="og:description" content=")[^"]*(")/, esc(description));
  h = sub(h, /(<meta property="og:type" content=")[^"]*(")/, ogType);
  // A page's own share picture (tools/make-og-images.mjs): og:image with its size and text, and a large Twitter/X card.
  if (image) {
    h = sub(h, /(<meta property="og:image" content=")[^"]*(")/, image.url);
    h = h.replace(/(<meta property="og:image" content="[^"]*" \/>\n)/, `$1<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />\n<meta property="og:image:alt" content="${esc(image.alt)}" />\n<meta name="twitter:card" content="summary_large_image" />\n<meta name="twitter:image" content="${image.url}" />\n`);
  }
  h = h.replace(/(<header id="site-header" class="site-header") data-active="[^"]*"/, base ? "$1" : "$&");
  // hreflang: only versions that exist; x-default is the Bulgarian one (or this page).
  h = h.replace(/<link rel="alternate" hreflang="[^"]+" href="[^"]*" \/>\n/g, "");
  const links = alts.map(([l, u]) => `<link rel="alternate" hreflang="${l}" href="${SITE + u}" />\n`).join("");
  h = h.replace(/(<link rel="canonical"[^>]*>\n)/, `$1${links}<link rel="alternate" hreflang="x-default" href="${SITE + xDefault}" />\n`);
  if (alts.length < LANGS.length) h = h.replace(/<meta property="og:locale:alternate" content="[^"]*" \/>\n/g, "");
  h = h.replace("</head>", jsonld + "</head>");
  const v = (template.match(/js\/i18n\.js\?v=([\w.-]+)"/) || [])[1];
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
  return { head: h, tail, script };
}

// img/og/<lang>-<service>.jpg, made by tools/make-og-images.mjs; the build fails if one is missing.
function ogImage(lang, service) {
  const file = `img/og/${lang}-${service}.jpg`;
  if (!existsSync(join(ROOT, file))) throw new Error(`${file} is missing: run node tools/make-og-images.mjs`);
  return { url: `${SITE}/${file}`, alt: `SmartMenuKJ: ${SVC_NAMES[lang][service]} · ${UI[lang].region}` };
}

const ldScript = (data) => `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, "\\u003c")}\n</script>\n`;

function render(template, page, twins, related = [], siblings = {}) {
  const { meta, lang } = page;
  const ui = UI[lang];
  const url = SITE + meta.url;
  const crumbs = meta.breadcrumb.split("›").map((s) => s.trim());
  const { head: h, tail, script } = shell(template, {
    lang, url, title: meta.title, description: meta.description, ogTitle: meta.h1,
    alts: LANGS.filter((l) => twins[l]).map((l) => [l, twins[l]]), xDefault: twins[X_DEFAULT] || meta.url, jsonld: jsonLd(page),
    image: ogImage(lang, meta.service),
  });
  const others = SERVICES.filter((k) => k !== meta.service && siblings[k])
    .map((k) => `            <li><a href="${siblings[k]}">${esc(SVC_NAMES[lang][k])}</a></li>`).join("\n");
  const othersBlock = others ? `\n\n          <h2>${esc(ui.others)}</h2>\n          <ul>\n${others}\n          </ul>` : "";
  const readMore = related.map((a) => `          <p><strong>${esc(ui.readMore)}:</strong> <a href="${a.meta.url}">${esc(a.meta.h1)}</a></p>`).join("\n");

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
${page.rest.length ? renderBlocks(page.rest) + "\n\n" : ""}${sections}${readMore ? "\n\n" + readMore : ""}${othersBlock}
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
  return h + main + tail + script;
}

// "Learn more" next to each quote button on services.html, and the service
// cards on index.html open the service page. Idempotent; also turns the copies
// that bg/ and tr/ inherit from the English sources into their own language.
function linkPages(root, lang, slugs, articles = [], pages = []) {
  const dir = join(root, UI[lang].dir);
  const servicesPath = join(dir, "services.html");
  let services = readFileSync(servicesPath, "utf8")
    .replace(/\n {10}<a href="[^"]*" class="link-chevron" data-svc-page="\w+"[^>]*>[^<]*<\/a>/g, "")
    .replace(/\n {10}<a href="[a-z0-9-]+\.html" class="link-chevron">Научете повече<\/a>/g, "") // first BG-only version
    .replace(/\n {10}<p data-blog-link[^>]*><a href="[^"]*" class="link-chevron">[^<]*<\/a><\/p>/g, "")
    .replace(/\n {2}<section class="section" data-blog-link>[\s\S]*?<\/section>/g, "");
  for (const [svc, file] of Object.entries(slugs)) {
    const re = new RegExp(`(<a href="contact\\.html\\?service=${svc}#quote" class="btn btn-primary">[\\s\\S]*?</a>)`);
    if (!re.test(services)) throw new Error(`${UI[lang].dir}services.html: no quote button for ${svc}`);
    const about = articles.filter((a) => pages.find((p) => p.lang === lang && p.meta.service === svc)?.meta.url === a.meta.service);
    const extra = about.map((a) => `\n          <p data-blog-link style="margin:16px 0 0"><a href="${a.meta.url.slice(1 + UI[lang].dir.length)}" class="link-chevron">${esc(UI[lang].readMore)}: ${esc(a.meta.h1)}</a></p>`).join("");
    services = services.replace(re, `$1\n          <a href="${file}" class="link-chevron" data-svc-page="${svc}" style="margin-left:18px">${esc(UI[lang].more)}</a>${extra}`);
  }
  if (articles.length) {
    const block = `\n  <section class="section" data-blog-link>\n    <div class="container"><p class="lede" style="text-align:center"><a href="blog/" class="link-chevron">${esc(UI[lang].blogCta)}</a></p></div>\n  </section>`;
    services = beforeCta(services, block, `${UI[lang].dir}services.html`);
  }
  writeFileSync(servicesPath, services);

  const indexPath = join(dir, "index.html");
  let index = readFileSync(indexPath, "utf8");
  for (const [svc, file] of Object.entries(slugs)) {
    const card = new RegExp(`<a href="services\\.html#${svc}" class="card |<a href="[a-z0-9-]+\\.html" data-svc-page="${svc}" class="card `);
    if (!card.test(index)) throw new Error(`${UI[lang].dir}index.html: no service card for ${svc}`);
    index = index.replace(card, `<a href="${file}" data-svc-page="${svc}" class="card `);
  }
  if (articles.length) {
    index = index.replace(/\n {2}<section class="section" data-blog-link>[\s\S]*?<\/section>/g, "");
    const block = `\n  <section class="section" data-blog-link>\n    <div class="container"><p class="lede" style="text-align:center"><a href="blog/" class="link-chevron">${esc(UI[lang].blogCta)}</a></p></div>\n  </section>`;
    index = beforeCta(index, block, `${UI[lang].dir}index.html`);
  }
  writeFileSync(indexPath, index);
}

// Inserts `block` before the section that holds the page's last call-to-action band (and its comment, if any).
function beforeCta(html, block, name) {
  const band = html.lastIndexOf('<div class="cta-band');
  let at = band < 0 ? -1 : html.lastIndexOf("\n  <section", band);
  if (at < 0) throw new Error(`${name}: no call-to-action section to put the blog link before`);
  const comment = html.lastIndexOf("\n  <!--", at);
  if (comment >= 0 && !html.slice(comment, at).replace(/\n  <!--[^]*?-->/, "").trim()) at = comment;
  return html.slice(0, at) + block + html.slice(at);
}

// js/chrome.js links the footer to each service page; its table must match content/<lang>/*.md.
function checkFooterTable(root, pages) {
  const js = readFileSync(join(root, "js", "chrome.js"), "utf8");
  for (const p of pages) {
    const file = p.meta.url.slice(1 + UI[p.lang].dir.length);
    const row = js.match(new RegExp(`\\b${p.lang}: \\{([^}]*)\\}`));
    if (!row || !row[1].includes(`${p.meta.service}: "${file}"`)) throw new Error(`js/chrome.js SVC_PAGES.${p.lang}.${p.meta.service} must be "${file}"`);
  }
}

// ------------------------------------------------------------------ blog --
// content/<lang>/blog/*.md -> /<lang>/blog/<slug>.html + /<lang>/blog/ (list).
// Front matter: url, title, description, h1, date (YYYY-MM-DD), breadcrumb
// ("<home> › <blog> › <short title>"), service (URL of the related service page).
// Only languages with UI[lang].blog have a blog.

function humanDate(iso, lang) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${UI[lang].months[m - 1]} ${y}`;
}

function renderArticle(template, a, all = [], twins = {}) {
  const { meta, lang } = a;
  const ui = UI[lang];
  const url = SITE + meta.url;
  const crumbs = meta.breadcrumb.split("›").map((s) => s.trim());
  if (crumbs.length !== 3) throw new Error(`${a.file}: breadcrumb must be "<home> › <blog> › <article>"`);
  const home = `${SITE}/${ui.dir}`;
  const jsonld = ldScript({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: meta.h1,
        description: meta.description,
        datePublished: meta.date,
        dateModified: meta.modified || meta.date,
        inLanguage: lang,
        image: `${SITE}/og-image.png`,
        author: { "@id": `${SITE}/#business` },
        publisher: { "@id": `${SITE}/#business` },
        mainEntityOfPage: url,
        about: { "@id": `${SITE + meta.service}#service` },
      },
      ...(a.faq.length ? [{
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: lang,
        mainEntity: a.faq.map(({ q, a: ans }) => ({ "@type": "Question", name: plain(q), acceptedAnswer: { "@type": "Answer", text: plain(ans) } })),
      }] : []),
      {
        "@type": "BreadcrumbList",
        itemListElement: [home, `${home}blog/`, url].map((item, i) => ({ "@type": "ListItem", position: i + 1, name: crumbs[i], item })),
      },
    ],
  });
  const { head, tail, script } = shell(template, {
    lang, url, title: meta.title, description: meta.description, ogTitle: meta.h1,
    alts: LANGS.filter((l) => twins[l]).map((l) => [l, twins[l]]), xDefault: twins[X_DEFAULT] || meta.url, jsonld, base: `/${ui.dir}`, ogType: "article",
  });
  const sections = a.body.map((s) => `          <h2>${esc(s.heading)}</h2>\n${renderBlocks(s.blocks)}`).join("\n\n");
  // Every article links to the others, so each one has links from the whole blog (SEO audit, M-1111-32).
  const others = all.filter((x) => x !== a).map((x) => `            <li><a href="${x.meta.url}">${esc(x.meta.h1)}</a></li>`).join("\n");
  const more = others ? `\n\n          <h2>${esc(ui.moreBlog)}</h2>\n          <ul>\n${others}\n          </ul>` : "";
  const faq = a.faq.map(({ q, a: ans }) => `        <details name="faq"><summary>${inline(q)}</summary><p>${inline(ans)}</p></details>`).join("\n");
  // <base href="/bg/"> is set: links are written relative to the language's top level.
  const main = `<main id="main">
  <section class="page-hero">
    <div class="container">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">${esc(crumbs[0])}</a><span aria-hidden="true">/</span><a href="blog/">${esc(crumbs[1])}</a><span aria-hidden="true">/</span><span>${esc(crumbs[2])}</span></nav>
      <p class="eyebrow"><time datetime="${meta.date}">${esc(ui.published)}: ${esc(humanDate(meta.date, lang))}</time></p>
      <h1 class="h-lg">${esc(meta.h1)}</h1>
      <p class="lede">${inline(a.lede)}</p>
    </div>
  </section>

  <section class="svc">
    <div class="container">
      <article class="card legal-card">
        <div class="legal">
${a.rest.length ? renderBlocks(a.rest) + "\n\n" : ""}${sections}${more}
        </div>
      </article>
    </div>
  </section>

${faq ? `  <section class="section section-alt" id="faq">
    <div class="container">
      <div class="section-head">
        <h2 class="h-lg">${esc(ui.faqTitle)}</h2>
      </div>
      <div class="faq">
${faq}
      </div>
    </div>
  </section>

` : ""}  <section class="section section-cta">
    <div class="container">
      <div class="cta-band invert">
        <div>
          <p class="eyebrow live">${esc(ui.ctaEyebrow)}</p>
          <h2 class="h-lg">${esc(ui.ctaTitle)}</h2>
          <p class="lede">${esc(ui.ctaLede)}</p>
        </div>
        <div class="hero-actions">
          <a href="contact.html#quote" class="btn btn-primary"><span>${esc(ui.quote)}</span></a>
          <a href="${tel}" class="btn btn-ghost"><span>${esc(ui.call)}: ${esc(PHONE)}</span></a>
        </div>
      </div>
    </div>
  </section>
</main>`;
  return head + main + tail + script;
}

function renderBlogIndex(template, lang, articles, blogLangs = [lang]) {
  const ui = UI[lang];
  const path = `/${ui.dir}blog/`;
  const url = SITE + path;
  const home = `${SITE}/${ui.dir}`;
  const homeName = articles[0].meta.breadcrumb.split("›")[0].trim();
  const jsonld = ldScript({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${url}#blog`,
        name: `${ui.blog} — SmartMenuKJ`,
        description: ui.blogLede,
        url,
        inLanguage: lang,
        publisher: { "@id": `${SITE}/#business` },
        blogPost: articles.map((a) => ({ "@id": `${SITE + a.meta.url}#article` })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [[homeName, home], [ui.blog, url]].map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
      },
    ],
  });
  const { head, tail, script } = shell(template, {
    lang, url, title: ui.blogTitle, description: ui.blogLede, ogTitle: `${ui.blog} — SmartMenuKJ`,
    alts: blogLangs.map((l) => [l, `/${UI[l].dir}blog/`]), xDefault: blogLangs.includes(X_DEFAULT) ? `/${UI[X_DEFAULT].dir}blog/` : path, jsonld, base: `/${ui.dir}`,
  });
  const items = articles
    .map((a) => `          <h2><a href="${a.meta.url}">${esc(a.meta.h1)}</a></h2>
          <p><time datetime="${a.meta.date}">${esc(humanDate(a.meta.date, lang))}</time> · ${esc(a.meta.description)}</p>`)
    .join("\n\n");
  const main = `<main id="main">
  <section class="page-hero">
    <div class="container">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">${esc(homeName)}</a><span aria-hidden="true">/</span><span>${esc(ui.blog)}</span></nav>
      <h1 class="h-lg">${esc(ui.blog)}</h1>
      <p class="lede">${esc(ui.blogLede)}</p>
    </div>
  </section>

  <section class="svc section-last">
    <div class="container">
      <article class="card legal-card">
        <div class="legal">
${items}
        </div>
      </article>
    </div>
  </section>
</main>`;
  return head + main + tail + script;
}

function buildBlogs(root, templates) {
  const byLang = {};
  for (const lang of LANGS.filter((l) => UI[l].blog)) {
    const dir = join(root, "content", lang, "blog");
    if (!existsSync(dir)) continue;
    const articles = readdirSync(dir).filter((f) => f.endsWith(".md")).sort()
      .map((f) => parse(readFileSync(join(dir, f), "utf8"), `content/${lang}/blog/${f}`, lang, "article"))
      .sort((x, y) => y.meta.date.localeCompare(x.meta.date) || x.meta.url.localeCompare(y.meta.url));
    if (articles.length) byLang[lang] = articles;
  }
  // Translations of one article share the Bulgarian URL: a BG article is its own key, EN/TR name it in `bg:`.
  const groups = {};
  for (const [lang, articles] of Object.entries(byLang)) {
    for (const a of articles) {
      const key = lang === X_DEFAULT ? a.meta.url : a.meta[X_DEFAULT];
      if (!key) throw new Error(`${a.file}: front matter needs ${X_DEFAULT}: (the URL of the Bulgarian article)`);
      const g = (groups[key] ??= {});
      if (g[lang]) throw new Error(`${a.file}: two ${lang} articles for ${key}`);
      g[lang] = a.meta.url;
    }
  }
  for (const [key, g] of Object.entries(groups)) {
    if (!g[X_DEFAULT]) throw new Error(`${key}: no Bulgarian article with this URL (named in ${Object.values(g).join(", ")})`);
    for (const lang of Object.keys(g)) {  // the other-language URLs written in a front matter must match
      const a = byLang[lang].find((x) => x.meta.url === g[lang]);
      for (const l of LANGS) if (l !== lang && a.meta[l] && g[l] && a.meta[l] !== g[l]) throw new Error(`${a.file}: ${l}: ${a.meta[l]} but the ${l} article is ${g[l]}`);
    }
  }
  const twinsOf = (a) => groups[a.lang === X_DEFAULT ? a.meta.url : a.meta[X_DEFAULT]];
  const blogLangs = LANGS.filter((l) => byLang[l]);
  const all = [];
  for (const lang of blogLangs) {
    const articles = byLang[lang];
    mkdirSync(join(root, UI[lang].dir, "blog"), { recursive: true });
    for (const a of articles) writeFileSync(join(root, a.meta.url.slice(1)), renderArticle(templates[lang], a, articles, twinsOf(a)));
    writeFileSync(join(root, UI[lang].dir, "blog", "index.html"), renderBlogIndex(templates[lang], lang, articles, blogLangs));
    all.push(...articles);
  }
  return all;
}

// ------------------------------------------------------------------- faq --
// content/<lang>/faq.md -> /<lang>/faq.html: one page with every question, grouped by service.
// Front matter: url, title, description, h1, breadcrumb ("<home> › <page>"). Text: an intro
// paragraph, "## " groups of **question** + answer lines (other lines in a group are shown
// under its questions), and after a "---" line a closing paragraph.
function parseFaqPage(md, file, lang) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no front matter`);
  const meta = Object.fromEntries(m[1].split("\n").map((l) => l.split(/:\s(.*)/s).slice(0, 2).map((x) => x.trim())));
  for (const k of ["url", "title", "description", "h1", "breadcrumb"]) if (!meta[k]) throw new Error(`${file}: front matter needs ${k}`);
  const [main, outro = ""] = m[2].split(/\n---\n/);
  const parts = main.split(/\n## /);
  const lede = parts[0].split("\n").filter((l) => l.trim() && !/^# /.test(l)).join(" ");
  const groups = parts.slice(1).map((chunk) => {
    const [heading, ...lines] = chunk.split("\n");
    const qa = [], notes = [];
    for (const l of lines.map((x) => x.trim()).filter(Boolean)) {
      const q = l.match(/^\*\*(.+)\*\*$/);
      if (q) qa.push({ q: q[1], a: [] });
      else if (qa.length && !l.startsWith("👉") && !notes.length) qa[qa.length - 1].a.push(l);
      else notes.push(l);
    }
    for (const x of qa) if (!x.a.length) throw new Error(`${file}: no answer for "${x.q}"`);
    return { heading: heading.trim(), qa: qa.map((x) => ({ q: x.q, a: x.a.join(" ") })), notes };
  });
  if (!groups.length) throw new Error(`${file}: no "## " groups`);
  return { lang, file, meta, lede, groups, outro: outro.split("\n").filter((l) => l.trim()).join(" ") };
}

function renderFaqPage(template, page) {
  const { meta, lang } = page;
  const ui = UI[lang];
  const url = SITE + meta.url;
  const crumbs = meta.breadcrumb.split("›").map((s) => s.trim());
  const all = page.groups.flatMap((g) => g.qa);
  const jsonld = ldScript({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: lang,
        mainEntity: all.map(({ q, a }) => ({ "@type": "Question", name: plain(q), acceptedAnswer: { "@type": "Answer", text: plain(a) } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [[crumbs[0], `${SITE}/${ui.dir}`], [crumbs[1], url]].map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
      },
    ],
  });
  const { head, tail, script } = shell(template, {
    lang, url, title: meta.title, description: meta.description, ogTitle: meta.h1,
    alts: [[lang, meta.url]], xDefault: meta.url, jsonld,
  });
  const groups = page.groups.map((g) => `      <h2 class="h-md" style="margin:56px 0 18px">${esc(g.heading)}</h2>
      <div class="faq">
${g.qa.map(({ q, a }) => `        <details name="faq"><summary>${inline(q)}</summary><p>${inline(a)}</p></details>`).join("\n")}
      </div>
${g.notes.map((n) => `      <p class="faq-more" style="margin:14px 0 0">${inline(n.replace(/^👉\s*/, ""))}</p>`).join("\n")}`).join("\n");
  const main = `<main id="main">
  <section class="page-hero">
    <div class="container">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">${esc(crumbs[0])}</a><span aria-hidden="true">/</span><span>${esc(crumbs[1])}</span></nav>
      <h1 class="h-lg">${esc(meta.h1)}</h1>
      <p class="lede">${inline(page.lede)}</p>
    </div>
  </section>

  <section class="section section-alt" id="faq">
    <div class="container" style="max-width:880px">
${groups}
    </div>
  </section>

  <section class="section section-cta">
    <div class="container">
      <div class="cta-band invert">
        <div>
          <p class="eyebrow live">${esc(ui.ctaEyebrow)}</p>
          <h2 class="h-lg">${esc(ui.ctaTitle)}</h2>
          <p class="lede">${inline(page.outro.replace(/\*\*/g, ""))}</p>
        </div>
        <div class="hero-actions">
          <a href="contact.html#quote" class="btn btn-primary"><span>${esc(ui.quote)}</span></a>
          <a href="${tel}" class="btn btn-ghost"><span>${esc(ui.call)}: ${esc(PHONE)}</span></a>
        </div>
      </div>
    </div>
  </section>
</main>`;
  // Not a services page: no active item in the header menu.
  return head.replace(/(<header id="site-header" class="site-header") data-active="[^"]*"/, "$1") + main + tail + script;
}

// The FAQ page, linked from the language's contact page (under the form) and services page (before the call to action).
function buildFaqPages(root, templates) {
  const built = [];
  for (const lang of LANGS) {
    const file = join(root, "content", lang, "faq.md");
    if (!existsSync(file)) continue;
    const page = parseFaqPage(readFileSync(file, "utf8"), `content/${lang}/faq.md`, lang);
    writeFileSync(join(root, page.meta.url.slice(1)), renderFaqPage(templates[lang], page));
    const href = page.meta.url.slice(1 + UI[lang].dir.length);
    const contactPath = join(root, UI[lang].dir, "contact.html");
    let contact = readFileSync(contactPath, "utf8").replace(/\n {10}<p class="form-fine" data-faq-link>.*<\/p>/g, "");
    if (!contact.includes("\n        </form>")) throw new Error(`${UI[lang].dir}contact.html: no </form>`);
    contact = contact.replace("\n        </form>", `\n          <p class="form-fine" data-faq-link>${esc(UI[lang].faqSee)} <a href="${href}">${esc(UI[lang].faqLink)}</a>.</p>\n        </form>`);
    writeFileSync(contactPath, contact);
    const servicesPath = join(root, UI[lang].dir, "services.html");
    let services = readFileSync(servicesPath, "utf8").replace(/\n {2}<section class="section" data-faq-link>[\s\S]*?<\/section>/g, "");
    services = beforeCta(services, `\n  <section class="section" data-faq-link>\n    <div class="container"><p class="lede" style="text-align:center"><a href="${href}" class="link-chevron">${esc(UI[lang].faqCta)}</a></p></div>\n  </section>`, `${UI[lang].dir}services.html`);
    writeFileSync(servicesPath, services);
    built.push(page.meta.url);
  }
  return built;
}

// ----------------------------------------------------------------- pages --
// content/<lang>/pages/*.md -> one plain page each (e.g. /bg/konkurs.html, the contest rules).
// Front matter: url, title, description, h1, breadcrumb ("<home> › <page>"); optional `key`
// (the same in every language version: hreflang), `until` (YYYY-MM-DD) with `banner` (a link at the top of the language's home page) and
// `footer` (a footer link, listed in js/chrome.js PROMO_PAGES): js/chrome.js hides both
// from `until` on, the page itself stays. Text: an intro paragraph, then "## " sections.
function parseSimplePage(md, file, lang) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no front matter`);
  const meta = Object.fromEntries(m[1].split("\n").map((l) => l.split(/:\s(.*)/s).slice(0, 2).map((x) => x.trim())));
  for (const k of ["url", "title", "description", "h1", "breadcrumb"]) if (!meta[k]) throw new Error(`${file}: front matter needs ${k}`);
  if (!new RegExp(`^/${UI[lang].dir.replace(/\//g, "\\/")}[a-z0-9-]+\\.html$`).test(meta.url)) throw new Error(`${file}: url must look like /${UI[lang].dir}<slug>.html`);
  if (meta.breadcrumb.split("›").length !== 2) throw new Error(`${file}: breadcrumb must be "<home> › <page>"`);
  if ((meta.banner || meta.footer) && !/^\d{4}-\d{2}-\d{2}$/.test(meta.until || "")) throw new Error(`${file}: banner/footer need until: YYYY-MM-DD`);
  const sections = [{ heading: null, lines: [] }];
  for (const line of m[2].split("\n")) {
    if (/^# /.test(line)) continue;
    const h = line.match(/^## (.+)/);
    if (h) sections.push({ heading: h[1].trim(), lines: [] });
    else sections[sections.length - 1].lines.push(line);
  }
  const intro = mdBlocks(sections[0].lines);
  if (!intro.length || intro[0].kind !== "p") throw new Error(`${file}: the text must start with an intro paragraph`);
  return { lang, file, meta, lede: intro[0].items.join(" "), rest: intro.slice(1), body: sections.slice(1).map((x) => ({ heading: x.heading, blocks: mdBlocks(x.lines) })) };
}

function renderSimplePage(template, page, twins = { [page.lang]: page.meta.url }) {
  const { meta, lang } = page;
  const ui = UI[lang];
  const url = SITE + meta.url;
  const crumbs = meta.breadcrumb.split("›").map((s) => s.trim());
  const jsonld = ldScript({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [[crumbs[0], `${SITE}/${ui.dir}`], [crumbs[1], url]].map(([name, item], i) => ({ "@type": "ListItem", position: i + 1, name, item })),
  });
  const { head, tail, script } = shell(template, {
    lang, url, title: meta.title, description: meta.description, ogTitle: meta.h1,
    alts: LANGS.filter((l) => twins[l]).map((l) => [l, twins[l]]), xDefault: twins[X_DEFAULT] || meta.url, jsonld,
  });
  const heroButtons = page.rest.filter((b) => b.kind === "btn").map((b) => "\n" + renderButtons(b, "      ")).join("");
  const rest = page.rest.filter((b) => b.kind !== "btn");
  const sections = page.body.map((s) => `          <h2>${esc(s.heading)}</h2>\n${renderBlocks(s.blocks)}`).join("\n\n");
  const main = `<main id="main">
  <section class="page-hero">
    <div class="container">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">${esc(crumbs[0])}</a><span aria-hidden="true">/</span><span>${esc(crumbs[1])}</span></nav>
      <h1 class="h-lg">${esc(meta.h1)}</h1>
      <p class="lede">${inline(page.lede)}</p>${heroButtons}
    </div>
  </section>

  <section class="svc">
    <div class="container">
      <article class="card legal-card">
        <div class="legal">
${rest.length ? renderBlocks(rest) + "\n\n" : ""}${sections}
        </div>
      </article>
    </div>
  </section>

  <section class="section section-cta">
    <div class="container">
      <div class="cta-band invert">
        <div>
          <p class="eyebrow live">${esc(ui.ctaEyebrow)}</p>
          <h2 class="h-lg">${esc(ui.ctaTitle)}</h2>
        </div>
        <div class="hero-actions">
          <a href="contact.html#quote" class="btn btn-primary"><span>${esc(ui.quote)}</span></a>
          <a href="${tel}" class="btn btn-ghost"><span>${esc(ui.call)}: ${esc(PHONE)}</span></a>
        </div>
      </div>
    </div>
  </section>
</main>`;
  return head.replace(/(<header id="site-header" class="site-header") data-active="[^"]*"/, "$1") + main + tail + script;
}

function buildSimplePages(root, templates) {
  const built = [];
  const chrome = readFileSync(join(root, "js", "chrome.js"), "utf8");
  const byLang = Object.fromEntries(LANGS.map((lang) => {
    const dir = join(root, "content", lang, "pages");
    return [lang, existsSync(dir) ? readdirSync(dir).filter((x) => x.endsWith(".md")).sort()
      .map((f) => parseSimplePage(readFileSync(join(dir, f), "utf8"), `content/${lang}/pages/${f}`, lang)) : []];
  }));
  // Language versions of one page share a `key` in the front matter (hreflang + the language switch).
  const twinsOf = (page) => {
    if (!page.meta.key) return { [page.lang]: page.meta.url };
    const t = {};
    for (const l of LANGS) for (const p of byLang[l]) if (p.meta.key === page.meta.key) {
      if (t[l]) throw new Error(`${p.file}: two ${l} pages with key ${p.meta.key}`);
      t[l] = p.meta.url;
    }
    return t;
  };
  for (const lang of LANGS) {
    const pages = byLang[lang];
    for (const page of pages) {
      writeFileSync(join(root, page.meta.url.slice(1)), renderSimplePage(templates[lang], page, twinsOf(page)));
      built.push(page.meta.url);
    }
    // Home page banners: removed and added again, so rebuilding never doubles them.
    const homePath = join(root, UI[lang].dir, "index.html");
    let home = readFileSync(homePath, "utf8").replace(/\n {8}<p class="promo-banner"[^\n]*<\/p>/g, "");
    const banners = pages.filter((p) => p.meta.banner).map((p) => `\n        <p class="promo-banner" data-until="${p.meta.until}"><a href="${p.meta.url.slice(1 + UI[lang].dir.length)}">${esc(p.meta.banner)}</a></p>`).join("");
    if (banners) {
      const anchor = '\n        <p class="eyebrow" data-i18n="hero.eyebrow">';
      if (!home.includes(anchor)) throw new Error(`${UI[lang].dir}index.html: no hero eyebrow for the banner`);
      home = home.replace(anchor, banners + anchor);
    }
    writeFileSync(homePath, home);
    for (const p of pages.filter((x) => x.meta.footer)) {
      const href = p.meta.url.slice(1 + UI[lang].dir.length);
      if (!chrome.includes(`href: "${href}"`)) throw new Error(`${p.file}: footer link ${href} is missing from js/chrome.js PROMO_PAGES`);
    }
  }
  return built;
}

export function buildServicePages(root = ROOT) {
  const pages = [];
  for (const lang of LANGS) {
    const dir = join(root, "content", lang);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((x) => x.endsWith(".md") && x !== "faq.md").sort()) {
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
  const articles = buildBlogs(root, templates);
  const urlsOf = (lang) => Object.fromEntries(pages.filter((p) => p.lang === lang).map((p) => [p.meta.service, p.meta.url]));
  for (const p of pages) {
    const related = articles.filter((a) => a.meta.service === p.meta.url);
    writeFileSync(join(root, p.meta.url.slice(1)), render(templates[p.lang], p, byService[p.meta.service], related, urlsOf(p.lang)));
  }
  checkFooterTable(root, pages);
  const faqs = buildFaqPages(root, templates);
  const simple = buildSimplePages(root, templates);
  for (const a of articles) {
    if (!pages.some((p) => p.meta.url === a.meta.service)) throw new Error(`${a.file}: service ${a.meta.service} is not a service page`);
  }
  for (const lang of LANGS) {
    const slugs = Object.fromEntries(pages.filter((p) => p.lang === lang).map((p) => [p.meta.service, p.meta.url.slice(1 + UI[lang].dir.length)]));
    if (Object.keys(slugs).length) linkPages(root, lang, slugs, articles.filter((a) => a.lang === lang), pages);
  }
  const blogs = [...new Set(articles.map((a) => `/${UI[a.lang].dir}blog/`))];
  return [...pages.map((p) => p.meta.url), ...blogs, ...articles.map((a) => a.meta.url), ...faqs, ...simple];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const url of buildServicePages()) console.log(`Built ${url.slice(1)}`);
}
