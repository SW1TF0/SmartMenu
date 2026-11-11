# SmartMenuKJ

> Web Development · 3D Printing · Smart Home & Business Automation · Camera & Security Systems · Digital Smart Menus · PC & Printer Service

A professional, trilingual (🇬🇧 EN / 🇧🇬 BG / 🇹🇷 TR) multi-service business website for **SmartMenuKJ**, founded by **Krasimir Uzun** in Kardzhali, Bulgaria. Rebuilt from the original single-product SmartMenu site into a full technology-services company site, backed by **Firebase** (Authentication + Firestore).

---

## Stack

Plain HTML/CSS/JS — no build step, no framework, no npm install. Firebase is loaded straight from the `gstatic.com` CDN as ES modules (lazily for the header, so the page shell still renders if the SDK is slow or blocked).

## Design system

The look is shared with the SmartHomeKJ division ([smarthomekj.eu](https://smarthomekj.eu)) and kept Apple-like and monochrome: quiet white and light-grey surfaces, large bold headlines, near-black icon tiles, one blue accent and rounded tiles. No decorative colour or gradients.

- **Themes** — the site always opens in the white theme (white `#ffffff`, light-grey `#f5f5f7` bands and tiles), whatever the visitor's OS setting. The header toggle (a moon, or a sun in the dark theme) switches to a black dark theme (saved as `smkj_theme`); the new theme grows out of the toggle as a circle (`js/motion.js`, View Transitions API, with a short colour fade in browsers without it). All colours are tokens at the top of `css/style.css`; `.invert` re-scopes them for black surfaces (stats band, CTA, SmartHomeKJ card, cookie card), and `.section-alt` flips tiles to white on grey bands.
- **Blue (`--accent`) is only for actions** — buttons, links and focus rings. Everything else is black, white and greys.
- **Type** — `Inter` (OFL), self-hosted in `fonts/` as Latin, Latin Extended (Turkish) and Cyrillic subsets — no Google Fonts requests, which matters for GDPR.
- **Logo** — a grid of three tiles plus the blue dot shared with SmartHomeKJ (`LOGO_MARK` in `js/chrome.js`, also `favicon.svg`).
- **Service icons** — app-style near-black rounded squares with white line pictograms, inverted in dark mode (`js/icons.js`, `ICONS`). Use `<span class="icon-badge" data-icon="web"></span>` and call `mountIcons()`. The home hero's showcase cycles through the same icons.
- **Product photos** — the devices we install, as transparent WebP in `img/products/` (400×400, made from the PNGs in the repo root). They sit on a light plate that glows softly in the dark theme so black devices stay visible. Used by the home page's "Hardware we install" section and the smart home and camera panels on the services page.
- **Motion** — short and quiet: scroll reveals of 0.6 s (0.45 s on phones), card hover/press feedback, the theme circle and the Home / Business cross-fade. Everything is instant for visitors who prefer reduced motion.

## For home / For business

Every page with services has two versions: **For business** (the default, and what the HTML itself contains, so search engines index it) and **For home**. A switch at the top of the home, services, work and contact pages — and at the top of the phone menu — flips between them with a cross-fade; the choice is saved (`smkj_audience`) and used on every page. Links can preset it with `?for=personal` or `?for=business`.

- **Text** — add `"key@personal": "…"` next to `"key"` in a page's `registerDict` (EN, BG and TR — the build fails if one is missing). Home visitors see it; everyone else sees `"key"`.
- **Whole blocks** — `data-for="business"` or `data-for="personal"` shows an element to one version only (e.g. QR menus are business-only).
- **Order** — on a container with `data-reorder`, the HTML order is the business order; give children `data-order-personal="1"`, `"2"`, … for the home order (children without a number go last).
- **Links into the other version** — a link to business-only content (e.g. `services.html#menu`) shows the business version for that visit without changing the saved choice. A link with `data-set-audience="business"` switches in place.
- **Quote requests** record which version they came from (`audience`: `personal` / `business`) and, for businesses, a `company` name; both show in the admin panel and its CSV export.

The inline script at the top of every page's `<head>` sets the theme and version before anything is drawn and sends first-time visitors to their language (see below) before any CSS or JS loads. Keep it identical on every page.

## Divisions

SmartMenuKJ is the parent company; each division has its own site. The home page's **Our divisions** section (`#divisions` in `index.html`) and the footer's **Divisions** column (`js/chrome.js`) link to them. Currently: **SmartHomeKJ** — [smarthomekj.eu](https://smarthomekj.eu). To add a division, copy the SmartHomeKJ card in `index.html` (with its EN/BG/TR strings) and add a link to the footer column.

- **Firebase Authentication** — email/password + Google sign-in
- **Cloud Firestore** — `users` (accounts) and `leads` (contact/quote requests)
- **Firebase Hosting** — static hosting (or keep using GitHub Pages with the existing `CNAME`)

## Project structure

```
index.html         Home — hero with the Home/Business switch, services, products, divisions, process, work teaser, partners
services.html       All six services in detail, each with its own quote CTA
about.html          Company story + founder bio
portfolio.html      Filterable sample-work showcase
contact.html        Contact form / quote request (writes to Firestore `leads`)
login.html          Sign in / register (email+password and Google)
account.html        Signed-in customer dashboard — profile + their own requests
admin.html          Admin dashboard — leads (search, filters, charts, bulk status, notes) + users, CSV export (gated)
privacy.html, terms.html, 404.html
css/style.css       Design system (tokens, themes, transitions, components)
img/products/       Product photos (transparent WebP)
fonts/              Self-hosted Inter woff2 subsets + OFL licence
js/
  firebase-config.js  Firebase project config + ADMIN_EMAILS
  auth.js             Auth helpers (register/login/Google/logout/reset)
  chrome.js           Shared header/nav + footer, theme toggle, Home/Business switch, Kardzhali clock
  i18n.js             EN/BG/TR translation engine (data-i18n attributes), Home/Business versions, escapeHtml
  motion.js           Theme circle reveal + Home/Business cross-fade
  icons.js            App-style service icons + the hero's icon stage
  site.js             Scroll-reveal
  home.js             Home hero service showcase and stat counters
  partners.js         Partner list for the home page — edit PARTNERS to add names, logos, links
  cookies.js          GDPR cookie consent banner
  contact.js, contact-page.js   Lead-form submission
  account.js, admin.js, login.js  Page-specific logic
  admin-i18n.js       Admin panel strings (BG / TR / EN)
tools/build-langs.mjs      Builds the BG/TR pages (and checks strings and asset versions)
tools/stamp-version.mjs    Stamps ?v= on every CSS/JS reference
firebase/firestore.rules   Security rules
firebase.json, .firebaserc  Firebase project config (project: smartmenukj)
```

## One-time Firebase setup

The `smartmenukj` Firebase project already exists and this repo is wired to it, but two things need enabling once in the [Firebase console](https://console.firebase.google.com/project/smartmenukj):

1. **Firestore Database** → Create database (any mode; rules are provided) — required for accounts, leads and the admin panel to work.
2. **Authentication → Sign-in method** → enable **Email/Password** and **Google**.

Then deploy the security rules once:

```bash
firebase deploy --only firestore:rules --project smartmenukj
```

### Admin access

Whoever signs in with the email listed in `ADMIN_EMAILS` (`js/firebase-config.js`, currently `krasimiruzun@smartmenukj.com`) gets access to `/admin.html`. Keep that list in sync with the `isAdminEmail()` allowlist in `firebase/firestore.rules`.

Internal notes on requests are stored in `leadNotes/{leadId}` (admin-only), not in the lead itself, because a customer can read their own leads. The panel works without them; notes start working once the current `firebase/firestore.rules` is published.

## Local preview

Any static file server works, e.g.:

```bash
node tools/build-langs.mjs   # builds the Bulgarian and Turkish pages into bg/ and tr/
npx serve .
```

## Bulgarian and Turkish pages (SEO)

Every public page also exists at `/bg/<page>` and `/tr/<page>` with the translated text already in the HTML, so Google can index all three languages. `tools/build-langs.mjs` generates `bg/` and `tr/` from the English pages and the BG/TR strings in each page's `registerDict` (plus `js/i18n.js`), and sets the translated `<title>`, description and canonical from the `BG_PAGES` / `TR_PAGES` tables at the top of the script. `bg/` and `tr/` are committed (so GitHub Pages serves them however the site is published) and rebuilt on every deploy — edit the English page and its BG/TR strings, run `node tools/build-langs.mjs` and commit `bg/` and `tr/` with the change; never edit them by hand. The PR check fails if either is out of date. The build fails if a page is missing a Bulgarian or Turkish string.

The site opens in Bulgarian: a first-time visitor landing on an English URL (including `smartmenukj.com/`) is sent to the `/bg/` twin, or to `/tr/` if their browser is Turkish — by the inline `<head>` script, before the English page's CSS and JS load. The Bulgarian and Turkish pages also preload the Cyrillic / Latin Extended font subset. English is shown only when picked; the EN/BG/TR switch in the header saves the choice (`smkj_lang`). Crawlers are not redirected, so the English pages stay indexed, and `x-default` in hreflang/sitemap points to the Bulgarian pages.

A new public page needs: an entry in `BG_PAGES` and `TR_PAGES`, the four `hreflang` links in its `<head>` (copy from any page), and its three URLs in `sitemap.xml`. When a page's content changes, set `<lastmod>` of its three URLs in `sitemap.xml` to that date. Pages that must stay out of Google (login, account, admin, 404) use `<meta name="robots" content="noindex">` and are left out of the sitemap; do not block them in `robots.txt`, or Google cannot see the noindex.

The home page's JSON-LD has a `FAQPage` that quotes the English FAQ (`faq.N.q` / `faq.N.a`) word for word; `build-langs.mjs` swaps in the BG/TR strings, points the Service URLs at `/bg/…` and `/tr/…` and sets `inLanguage`. When a FAQ question changes or is added, change it in the JSON-LD too — the build fails if they differ.

**Service landing pages (EN / BG / TR).** Six pages per language — QR menu, websites, CCTV, smart home, 3D printing, PC service — at `/<slug>-kardzhali.html` (EN), `/bg/<slug>-kardzhali.html` and `/tr/<slug>-kircaali.html`, built from the texts in `content/<lang>/*.md` by `tools/build-service-pages.mjs` (`build-langs.mjs` runs it, since it rebuilds `bg/` and `tr/`). Each page uses its language's `services.html` as the template and gets Service, FAQPage and BreadcrumbList JSON-LD. The three versions of a service are tied by the `service:` key in the front matter (each language has its own slug): that gives hreflang and the EN/BG/TR switch. The build also adds a "Learn more" link per service to each `services.html` and points the service cards on each home page at the pages (marked `data-svc-page`). To change a page, edit its `.md` and run `node tools/build-langs.mjs`; a new page also needs its URL in `sitemap.xml`.

**Blog (Bulgarian).** `/bg/blog/` lists the articles in `content/bg/blog/*.md` (front matter: url, title, description, h1, date, breadcrumb, service = URL of the related service page); the same tool builds each article with BlogPosting, FAQPage and BreadcrumbList JSON-LD and adds "Прочетете още" to the related service page. Blog pages sit one folder deeper, so they carry `<base href="/bg/">` and every relative link resolves as on the other Bulgarian pages. The footer shows "Блог" on Bulgarian pages only (`js/chrome.js`). A new article: add its `.md`, run `node tools/build-langs.mjs`, add its URL to `sitemap.xml`.

## Speed

- Pages are prefetched when a visitor hovers over or presses a link (Speculation Rules in each public page's `<head>`), so the next page opens almost instantly. Login, account and admin are left out.
- The shared modules (`i18n.js`, `chrome.js`, `motion.js`) are preloaded from the `<head>` instead of being discovered at the end of the page.
- Product photos are small WebP files loaded lazily.
- Partner logos are WebP too, at most 256 px on the long side (they show at about 100 px).
- The deploy minifies `css/*.css` (`tools/minify-css.mjs`: comments and whitespace only, strings and `url()` untouched) — about 20% less CSS over the wire. The repo keeps the readable source; never run it on your working copy.

## Deploying

**Re-stamp the asset version on every CSS/JS change.** GitHub Pages lets browsers reuse files for 10 minutes, so right after a deploy a returning visitor could get new HTML with old CSS/JS and see a broken page. Every stylesheet link, `<script src>`, module preload and relative import carries `?v=YYYYMMDD`. Run

```bash
node tools/stamp-version.mjs   # today's date everywhere (all *.html and js/*.js)
node tools/build-langs.mjs     # copies it into bg/ and tr/
```

and commit everything. The build refuses to run if the versions don't all match — a module imported under two different URLs loads twice (Firebase would initialise twice).

- **Firebase Hosting:** `firebase deploy --project smartmenukj` (deploys hosting + rules; the `predeploy` hook builds `bg/` and `tr/`).
- **GitHub Pages (keeps the existing `www.smartmenukj.com` domain):** push to `main`; the workflow builds `bg/` and `tr/` and the `CNAME` file is already in place.

## Contact

**SmartMenuKJ** — Krasimir Uzun, Founder & CEO
📱 +359 88 534 8666 · ✉️ krasimiruzun@smartmenukj.com
📍 ul. „Dzhebelska" 2, 6600 Baykal, Kardzhali, Bulgaria
[Instagram](https://www.instagram.com/smartmenukj/) · [LinkedIn](https://www.linkedin.com/in/krasimir-uzun-316a053bb/)

---

© 2026 SmartMenuKJ. All rights reserved.
