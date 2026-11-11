// Builds the Bulgarian service landing pages (bg/<slug>.html) from the texts in
// content/bg/*.md, using the built bg/services.html as the page template (head,
// header, footer, scripts). Then links them from bg/services.html and the
// service cards on bg/index.html.
//
//   node tools/build-service-pages.mjs     (build-langs.mjs also runs it, since it rebuilds bg/)
//
// Each .md file: a front matter block (url, title, description, h1, breadcrumb,
// service), then the text: "## " headings, "- " and "1. " lists, paragraphs,
// **bold** and [links](/bg/…). The first paragraph is the intro under the H1.
// "## Често задавани въпроси" holds **question** lines, each followed by its
// answer; it becomes the visible FAQ and the FAQPage JSON-LD. A
// "## Вътрешни линкове" section is a note for the author and is not published.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://www.smartmenukj.com";
const FAQ_HEADING = "Често задавани въпроси";
const NOTES_HEADING = "Вътрешни линкове";
// contact.html?service=<key> preselects the service; it is also the section id on services.html.
const SERVICES = ["menu", "web", "cameras", "smarthome", "print3d", "pc"];
const PHONE = "+359 88 534 8666";

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// **bold**, [text](url) and the phone number; everything else is escaped text.
function inline(text) {
  let out = esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, url) => {
      if (!/^(\/|https:\/\/|tel:|mailto:)/.test(url)) throw new Error(`link must be a site path or https: ${url}`);
      return `<a href="${url}">${label}</a>`;
    });
  return out.replace(esc(PHONE), `<a href="tel:${PHONE.replace(/\s/g, "")}">${esc(PHONE)}</a>`);
}
const plain = (text) => text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

function parse(md, file) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: no front matter`);
  const meta = Object.fromEntries(m[1].split("\n").map((l) => l.split(/:\s(.*)/s).slice(0, 2).map((x) => x.trim())));
  for (const k of ["url", "title", "description", "h1", "breadcrumb", "service"]) if (!meta[k]) throw new Error(`${file}: front matter needs ${k}`);
  if (!SERVICES.includes(meta.service)) throw new Error(`${file}: service must be one of ${SERVICES.join(", ")}`);
  if (!/^\/bg\/[a-z0-9-]+\.html$/.test(meta.url)) throw new Error(`${file}: url must look like /bg/<slug>.html`);

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
      if (cur && cur.kind === kind && kind !== "p") cur.items.push(text);
      else if (cur && kind === "p" && cur.kind === "p") cur.items.push(text);
      else out.push((cur = { kind, items: [text] }));
    }
    return out;
  };
  const intro = blocks(sections[0].lines);
  if (!intro.length || intro[0].kind !== "p") throw new Error(`${file}: the text must start with an intro paragraph`);
  const body = [];
  let faq = [];
  for (const s of sections.slice(1)) {
    if (s.heading === NOTES_HEADING) continue;
    if (s.heading === FAQ_HEADING) {
      const lines = s.lines.map((l) => l.trim()).filter(Boolean);
      for (const l of lines) {
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
  if (faq.length < 2) throw new Error(`${file}: the FAQ needs at least 2 questions`);
  return { meta, lede: intro[0].items.join(" "), rest: intro.slice(1), body, faq };
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
  const { meta, faq } = page;
  const url = SITE + meta.url;
  const crumbs = meta.breadcrumb.split("›").map((s) => s.trim());
  const name = crumbs[crumbs.length - 1];
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Service",
        "@id": `${url}#service`,
        name: meta.h1,
        serviceType: name,
        description: meta.description,
        url,
        inLanguage: "bg",
        provider: { "@id": `${SITE}/#business` },
        areaServed: { "@type": "City", name: "Kardzhali" },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: "bg",
        mainEntity: faq.map(({ q, a }) => ({ "@type": "Question", name: plain(q), acceptedAnswer: { "@type": "Answer", text: plain(a) } })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [`${SITE}/bg/`, `${SITE}/bg/services.html`, url].map((item, i) => ({ "@type": "ListItem", position: i + 1, name: crumbs[i], item })),
      },
    ],
  };
  return `<script type="application/ld+json">\n${JSON.stringify(data, null, 2).replace(/</g, "\\u003c")}\n</script>\n`;
}

function render(template, page) {
  const { meta } = page;
  const url = SITE + meta.url;
  const crumbs = meta.breadcrumb.split("›").map((s) => s.trim());
  if (crumbs.length !== 3) throw new Error(`${meta.url}: breadcrumb must be "Начало › Услуги › <service>"`);
  const head = template.slice(0, template.indexOf("<main"));
  const tail = template.slice(template.indexOf("</main>") + "</main>".length, template.indexOf('<script type="module">'));
  const sub = (html, re, value) => {
    if (!re.test(html)) throw new Error(`template: no match for ${re}`);
    return html.replace(re, (_, a, b) => `${a}${value}${b}`);
  };
  let h = head.replace("<html lang=\"bg\" data-aud-page>", '<html lang="bg">');
  h = sub(h, /(<title>)[^<]*(<\/title>)/, esc(meta.title));
  h = sub(h, /(<meta name="description" content=")[^"]*(")/, esc(meta.description));
  h = sub(h, /(<link rel="canonical" href=")[^"]*(")/, url);
  h = sub(h, /(<meta property="og:url" content=")[^"]*(")/, url);
  h = sub(h, /(<meta property="og:title" content=")[^"]*(")/, esc(meta.h1));
  h = sub(h, /(<meta property="og:description" content=")[^"]*(")/, esc(meta.description));
  // Only a Bulgarian version exists so far: no en/tr alternates.
  h = h.replace(/<link rel="alternate" hreflang="[^"]+" href="[^"]*" \/>\n/g, "");
  h = h.replace(/<meta property="og:locale:alternate" content="[^"]*" \/>\n/g, "");
  h = h.replace(/(<link rel="canonical"[^>]*>\n)/, `$1<link rel="alternate" hreflang="bg" href="${url}" />\n<link rel="alternate" hreflang="x-default" href="${url}" />\n`);
  h = h.replace("</head>", jsonLd(page) + "</head>");

  const quote = `contact.html?service=${meta.service}#quote`;
  const arrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const sections = page.body.map((s) => `          <h2>${esc(s.heading)}</h2>\n${renderBlocks(s.blocks)}`).join("\n\n");
  const faq = page.faq.map(({ q, a }) => `        <details name="faq"><summary>${inline(q)}</summary><p>${inline(a)}</p></details>`).join("\n");
  const main = `<main id="main">
  <section class="page-hero">
    <div class="container">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="index.html">${esc(crumbs[0])}</a><span aria-hidden="true">/</span><a href="services.html#${meta.service}">${esc(crumbs[1])}</a><span aria-hidden="true">/</span><span>${esc(crumbs[2])}</span></nav>
      <p class="eyebrow">Кърджали и региона</p>
      <h1 class="h-lg">${esc(meta.h1)}</h1>
      <p class="lede">${inline(page.lede)}</p>
      <div class="hero-actions">
        <a href="${quote}" class="btn btn-primary"><span>Поискай оферта</span>${arrow}</a>
        <a href="tel:${PHONE.replace(/\s/g, "")}" class="btn btn-ghost"><span>Обади се: ${esc(PHONE)}</span></a>
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
        <h2 class="h-lg">${esc(FAQ_HEADING)}</h2>
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
          <p class="eyebrow live">Безплатна оферта до 24 часа</p>
          <h2 class="h-lg">Кажете ни какво ви трябва.</h2>
          <p class="lede">Ще ви върнем ясна писмена оферта до един ден, без ангажимент.</p>
        </div>
        <div class="hero-actions">
          <a href="${quote}" class="btn btn-primary"><span>Поискай оферта</span></a>
          <a href="tel:${PHONE.replace(/\s/g, "")}" class="btn btn-ghost"><span>Обади се: ${esc(PHONE)}</span></a>
        </div>
      </div>
    </div>
  </section>
</main>`;
  const v = (template.match(/js\/i18n\.js\?v=(\d+)/) || [])[1];
  if (!v) throw new Error("template: no asset version");
  const script = `<script type="module">
  import { mountChrome } from "../js/chrome.js?v=${v}";
  import { applyI18n, initLangSwitch } from "../js/i18n.js?v=${v}";
  import { initCookieBanner } from "../js/cookies.js?v=${v}";
  import { initReveal } from "../js/site.js?v=${v}";

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

export function buildServicePages(root = ROOT) {
  const dir = join(root, "content", "bg");
  const pages = readdirSync(dir).filter((f) => f.endsWith(".md")).sort().map((f) => parse(readFileSync(join(dir, f), "utf8"), `content/bg/${f}`));
  const seen = new Set();
  for (const p of pages) {
    if (seen.has(p.meta.service)) throw new Error(`two pages for service ${p.meta.service}`);
    seen.add(p.meta.service);
  }
  const servicesPath = join(root, "bg", "services.html");
  const template = readFileSync(servicesPath, "utf8");
  for (const p of pages) writeFileSync(join(root, p.meta.url.slice(1)), render(template, p));

  // Links to the new pages: a "Научете повече" link next to each quote button on
  // bg/services.html, and the service cards on bg/index.html.
  const slug = Object.fromEntries(pages.map((p) => [p.meta.service, p.meta.url.slice("/bg/".length)]));
  // Idempotent: drop the links an earlier run added.
  let services = template.replace(/\n {10}<a href="[a-z0-9-]+\.html" class="link-chevron">Научете повече<\/a>/g, "");
  for (const [svc, file] of Object.entries(slug)) {
    const re = new RegExp(`(<a href="contact\\.html\\?service=${svc}#quote" class="btn btn-primary">[\\s\\S]*?</a>)`);
    if (!re.test(services)) throw new Error(`bg/services.html: no quote button for ${svc}`);
    services = services.replace(re, `$1\n          <a href="${file}" class="link-chevron">Научете повече</a>`);
  }
  writeFileSync(servicesPath, services);
  const indexPath = join(root, "bg", "index.html");
  let index = readFileSync(indexPath, "utf8");
  for (const [svc, file] of Object.entries(slug)) {
    const re = new RegExp(`<a href="services\\.html#${svc}" class="card `);
    if (index.includes(`<a href="${file}" class="card `)) continue;
    if (!re.test(index)) throw new Error(`bg/index.html: no service card for ${svc}`);
    index = index.replace(re, `<a href="${file}" class="card `);
  }
  writeFileSync(indexPath, index);
  return pages.map((p) => p.meta.url);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const url of buildServicePages()) console.log(`Built ${url.slice(1)}`);
}
