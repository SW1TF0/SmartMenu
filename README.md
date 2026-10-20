# SmartMenuKJ

> Web Development · 3D Printing · Smart Home & Business Automation · Camera & Security Systems · Digital Smart Menus · PC & Printer Service

A professional, trilingual (🇬🇧 EN / 🇧🇬 BG / 🇹🇷 TR) multi-service business website for **SmartMenuKJ**, founded by **Krasimir Uzun** in Kardzhali, Bulgaria. Rebuilt from the original single-product SmartMenu site into a full technology-services company site, backed by **Firebase** (Authentication + Firestore).

---

## Stack

Plain HTML/CSS/JS — no build step, no framework, no npm install. Firebase is loaded straight from the `gstatic.com` CDN as ES modules (lazily for the header, so the page shell still renders if the SDK is slow or blocked).

## Design system

The look is shared with the SmartHomeKJ division ([smarthomekj.eu](https://smarthomekj.eu)) and kept Apple-like and monochrome: quiet white and light-grey surfaces, large bold headlines, near-black icon tiles, one blue accent and rounded tiles. No decorative colour or gradients.

- **Themes** — the site always opens in the white theme (white `#ffffff`, light-grey `#f5f5f7` bands and tiles), whatever the visitor's OS setting. The header toggle switches to a black dark theme (saved as `smkj_theme`). All colours are tokens at the top of `css/style.css`; `.invert` re-scopes them for black surfaces (stats band, CTA, SmartHomeKJ card, cookie card), and `.section-alt` flips tiles to white on grey bands.
- **Blue (`--accent`) is only for actions** — buttons, links and focus rings. Everything else is black, white and greys; secondary headline lines (like the hero's rotating word) are grey.
- **Type** — `Inter` (OFL), self-hosted in `fonts/` as Latin, Latin Extended (Turkish) and Cyrillic subsets — no Google Fonts requests, which matters for GDPR.
- **Logo** — a grid of three tiles plus the blue dot shared with SmartHomeKJ (`LOGO_MARK` in `js/chrome.js`, also `favicon.svg`).
- **Service icons** — app-style near-black rounded squares with white line pictograms, inverted in dark mode (`js/icons.js`, `ICONS`). Use `<span class="icon-badge" data-icon="web"></span>` and call `mountIcons()`. The home hero's showcase cycles through the same icons.

## Divisions

SmartMenuKJ is the parent company; each division has its own site. The home page's **Our divisions** section (`#divisions` in `index.html`) and the footer's **Divisions** column (`js/chrome.js`) link to them. Currently: **SmartHomeKJ** — [smarthomekj.eu](https://smarthomekj.eu). To add a division, copy the SmartHomeKJ card in `index.html` (with its EN/BG/TR strings) and add a link to the footer column.

- **Firebase Authentication** — email/password + Google sign-in
- **Cloud Firestore** — `users` (accounts) and `leads` (contact/quote requests)
- **Firebase Hosting** — static hosting (or keep using GitHub Pages with the existing `CNAME`)

## Project structure

```
index.html         Home — hero, services overview, process, work teaser, partners
services.html       All six services in detail, each with its own quote CTA
about.html          Company story + founder bio
portfolio.html      Filterable sample-work showcase
contact.html        Contact form / quote request (writes to Firestore `leads`)
login.html          Sign in / register (email+password and Google)
account.html        Signed-in customer dashboard — profile + their own requests
admin.html          Admin dashboard — all leads + users, CSV export (gated)
privacy.html, terms.html, 404.html
css/style.css       Design system (tokens, themes, components)
fonts/              Self-hosted Inter woff2 subsets + OFL licence
js/
  firebase-config.js  Firebase project config + ADMIN_EMAILS
  auth.js             Auth helpers (register/login/Google/logout/reset)
  chrome.js           Shared header/nav + footer, theme toggle, Kardzhali clock
  i18n.js             EN/BG/TR translation engine (data-i18n attributes) + escapeHtml
  icons.js            App-style service icons + the hero's icon stage
  site.js             Scroll-reveal + typewriter helper
  home.js             Home hero (service showcase + typing headline) and stat counters
  partners.js         Partner list for the home page — edit PARTNERS to add names, logos, links
  cookies.js          GDPR cookie consent banner
  contact.js, contact-page.js   Lead-form submission
  account.js, admin.js, login.js  Page-specific logic
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

## Local preview

Any static file server works, e.g.:

```bash
node tools/build-langs.mjs   # builds the Bulgarian and Turkish pages into bg/ and tr/
npx serve .
```

## Bulgarian and Turkish pages (SEO)

Every public page also exists at `/bg/<page>` and `/tr/<page>` with the translated text already in the HTML, so Google can index all three languages. `tools/build-langs.mjs` generates `bg/` and `tr/` from the English pages and the BG/TR strings in each page's `registerDict` (plus `js/i18n.js`), and sets the translated `<title>`, description and canonical from the `BG_PAGES` / `TR_PAGES` tables at the top of the script. `bg/` and `tr/` are committed (so GitHub Pages serves them however the site is published) and rebuilt on every deploy — edit the English page and its BG/TR strings, run `node tools/build-langs.mjs` and commit `bg/` and `tr/` with the change; never edit them by hand. The PR check fails if either is out of date. The build fails if a page is missing a Bulgarian or Turkish string.

The site opens in Bulgarian: a first-time visitor landing on an English URL (including `smartmenukj.com/`) is sent to the `/bg/` twin, or to `/tr/` if their browser is Turkish. English is shown only when picked; the EN/BG/TR switch in the header saves the choice (`smkj_lang`). Crawlers are not redirected, so the English pages stay indexed, and `x-default` in hreflang/sitemap points to the Bulgarian pages.

A new public page needs: an entry in `BG_PAGES` and `TR_PAGES`, the four `hreflang` links in its `<head>` (copy from any page), and its three URLs in `sitemap.xml`.

## Deploying

- **Firebase Hosting:** `firebase deploy --project smartmenukj` (deploys hosting + rules; the `predeploy` hook builds `bg/` and `tr/`).
- **GitHub Pages (keeps the existing `www.smartmenukj.com` domain):** push to `main`; the workflow builds `bg/` and `tr/` and the `CNAME` file is already in place.

## Contact

**SmartMenuKJ** — Krasimir Uzun, Founder & CEO
📱 +359 88 534 8666 · ✉️ krasimiruzun@smartmenukj.com
📍 ul. „Dzhebelska" 2, 6600 Baykal, Kardzhali, Bulgaria
[Instagram](https://www.instagram.com/smartmenukj/) · [LinkedIn](https://www.linkedin.com/in/krasimir-uzun-316a053bb/)

---

© 2026 SmartMenuKJ. All rights reserved.
