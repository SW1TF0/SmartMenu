# SmartMenuKJ

> Web Development · 3D Printing · Smart Home & Business Automation · Camera & Security Systems · Digital Smart Menus · PC & Printer Service

A professional, bilingual (🇬🇧 EN / 🇧🇬 BG) multi-service business website for **SmartMenuKJ**, founded by **Krasimir Uzun** in Kardzhali, Bulgaria. Rebuilt from the original single-product SmartMenu site into a full technology-services company site, backed by **Firebase** (Authentication + Firestore).

---

## Stack

Plain HTML/CSS/JS — no build step, no framework, no npm install. Firebase is loaded straight from the `gstatic.com` CDN as ES modules.

- **Firebase Authentication** — email/password + Google sign-in
- **Cloud Firestore** — `users` (accounts) and `leads` (contact/quote requests)
- **Firebase Hosting** — static hosting (or keep using GitHub Pages with the existing `CNAME`)

## Project structure

```
index.html         Home — hero, services overview, process, work teaser, testimonials
services.html       All six services in detail, each with its own quote CTA
about.html          Company story + founder bio
portfolio.html      Filterable sample-work showcase
contact.html        Contact form / quote request (writes to Firestore `leads`)
login.html          Sign in / register (email+password and Google)
account.html        Signed-in customer dashboard — profile + their own requests
admin.html          Admin dashboard — all leads + users, CSV export (gated)
privacy.html, terms.html, 404.html
css/style.css       Design system
js/
  firebase-config.js  Firebase project config + ADMIN_EMAILS
  auth.js             Auth helpers (register/login/Google/logout/reset)
  chrome.js           Shared header/nav + footer, injected on every page
  i18n.js             EN/BG translation engine (data-i18n attributes)
  site.js             Scroll-reveal + hero word rotator
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
npx serve .
```

## Deploying

- **Firebase Hosting:** `firebase deploy --project smartmenukj` (deploys hosting + rules).
- **GitHub Pages (keeps the existing `www.smartmenukj.com` domain):** push to `main`; the `CNAME` file is already in place.

## Contact

**SmartMenuKJ** — Krasimir Uzun, Founder & CEO
📱 +359 88 534 8666 · ✉️ krasimiruzun@smartmenukj.com
📍 ul. „Dzhebelska" 2, 6600 Baykal, Kardzhali, Bulgaria
[Instagram](https://www.instagram.com/1337_krasimir_/) · [LinkedIn](https://www.linkedin.com/in/krasimir-uzun-316a053bb/)

---

© 2026 SmartMenuKJ. All rights reserved.
