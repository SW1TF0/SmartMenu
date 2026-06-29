# SmartMenuKJ

> Premium technology execution enterprise — **Web Development · 3D Printing · Home & Business Automation · SmartMenus for Restaurants.**

A high-end, fully responsive, bilingual (🇧🇬 / 🇬🇧) single-page website with scroll-driven background morphing, an interactive estimator, a glassmorphism auth experience, a real backend, an **admin dashboard**, and full **EU / GDPR cookie compliance**.

Headquartered in Kardzhali, Bulgaria. Founder & CEO: **Krasimir Uzun**.

---

## ⚡ Quick start (zero setup)

1. Copy this folder anywhere on a Windows PC.
2. Double-click **`Start-SmartMenuKJ.bat`**.
3. Your browser opens at `http://localhost:5173` — the full site, with working registration, contact form and admin panel. Done.

> The admin dashboard is at `http://localhost:5173/admin.html` (or the **Admin** link in the footer). Sign in with the admin account (the email listed in `config.js` → `ADMIN_EMAILS`, default `krasimiruzun@smartmenukj.com`). All data is saved as JSON files in `server-data/`.

---

## ✨ Features

- **Scroll-driven background morphing**, animated particle hero, rotating headline.
- **Interactive 4-pillar showcase**, **filterable portfolio**, **testimonials**, **CEO vision**, **FAQ**.
- **Project estimator** with multi-service bundle discounts.
- **Registration & login** with hashed passwords + sessions.
- **Contact form** that stores inquiries.
- **Admin dashboard** (`admin.html`) — total views, views today, registered users, contact inquiries, a 14-day views chart, sortable tables and **CSV export**.
- **EU / GDPR cookie consent** (accept / reject / customize) with consent-gated analytics + a bilingual **Privacy & Cookie Policy** page.
- **Bilingual** EN/BG toggle (persisted), full `prefers-reduced-motion` support.
- **SEO** — JSON-LD structured data, Open Graph, sitemap, robots, custom 404.

---

## 🗄️ Where your data lives (3 modes — it auto-detects)

The site has an adaptive data layer. It picks the best available backend automatically:

| Mode | When | Data location | Admin sees |
|------|------|---------------|-----------|
| **Cloud (Supabase)** | `config.js` has Supabase keys | Your Supabase project | All visitors, any device — works on GitHub Pages |
| **Self-hosted** | Served by `server.ps1` (e.g. the launcher) | `server-data/*.json` files | All data on that machine |
| **Static demo** | Plain static hosting, no config | The visitor's browser (localStorage) | Only that browser |

**Want one central place to see ALL data, on GitHub Pages?** Use the Cloud mode below.

---

## ☁️ Enable the cloud database (Supabase) — optional, ~3 min

This gives you real centralized data + analytics that you can view from the admin panel on any device, while still hosting on GitHub Pages.

1. Create a free project at <https://supabase.com>.
2. Open **SQL Editor → New query**, paste the entire contents of **`SUPABASE_SETUP.sql`**, and **Run**.
3. **Authentication → Providers → Email** → turn **OFF** "Confirm email" (so sign-up logs in instantly).
4. **Project Settings → API** → copy **Project URL** and the **anon public** key into `config.js`:
   ```js
   window.SMKJ_CONFIG = {
     SUPABASE_URL: 'https://YOURPROJECT.supabase.co',
     SUPABASE_ANON_KEY: 'your-anon-public-key',
     ADMIN_EMAILS: ['krasimiruzun@smartmenukj.com'],
   };
   ```
5. Register on the site with your admin email — you're now the admin. The anon key is public by design and safe to commit.

---

## 🚀 Deploy to GitHub Pages

The site runs perfectly as a **static site**. Auth & contact keep working via the cloud (if configured) or the local fallback.

**Option A — GitHub Actions (recommended):** included in `.github/workflows/deploy.yml`.
1. Push this repo to GitHub.
2. **Settings → Pages → Source: GitHub Actions.** Every push to `main` deploys to `https://<username>.github.io/<repo>/`.

**Option B — Deploy from branch:** Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`.

> Custom domain (e.g. `smartmenukj.com`)? Add it under Settings → Pages → Custom domain and create a `CNAME` file with the domain.

---

## 🔐 GDPR / EU cookies

- A consent banner appears on first visit: **Accept all**, **Reject non-essential**, or **Customize**.
- Only **essential** storage (login session, language, consent choice) is used until you opt in.
- **Analytics** (anonymous visit counting) runs only after consent and can be changed anytime via the **Cookie settings** link in the footer.
- A full bilingual **Privacy & Cookie Policy** lives at `privacy.html`.

---

## 🔌 Backend API (self-hosted via `server.ps1`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/register` | Create an account |
| `POST` | `/api/login` | Sign in |
| `POST` | `/api/logout` | Sign out |
| `GET`  | `/api/me` | Current session user |
| `POST` | `/api/contact` | Submit a contact inquiry |
| `POST` | `/api/track` | Record an (anonymous) page view |
| `GET`  | `/api/admin/summary` | Admin-only: views, users, inquiries |

**Security:** PBKDF2-SHA256 password hashing (100k iterations, per-user salt); HttpOnly session cookies; server-side validation; admin endpoints gated by `$AdminEmails`; data files are never served over HTTP.

---

## 📁 Project structure

```
.
├── index.html              # The single-page website
├── admin.html / admin.js   # Admin dashboard (views + all data)
├── privacy.html            # Bilingual GDPR privacy & cookie policy
├── styles.css              # Styling, animations, components
├── script.js               # Site behaviour + adaptive backend adapter
├── config.js               # Your Supabase keys + admin emails
├── server.ps1              # Full app server (static + JSON API)
├── serve.ps1               # Static-only dev server
├── Start-SmartMenuKJ.bat   # One-click launcher (Windows)
├── SUPABASE_SETUP.sql      # One-time cloud database setup
├── 404.html · robots.txt · sitemap.xml
├── .github/workflows/      # GitHub Pages deployment
└── server-data/            # Runtime JSON storage (git-ignored)
```

---

## ⚙️ Configuration (`config.js`)

| Constant | Purpose |
|----------|---------|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Enable the cloud database |
| `ADMIN_EMAILS` | Accounts allowed into the admin panel |

In `script.js`: `CONTACT_ENDPOINT` (a Formspree URL for contact delivery on static hosting) and `HERO_VIDEO` (an `.mp4` to overlay behind the hero).

---

## 📞 Contact

**SmartMenuKJ** — Krasimir Uzun, Founder & CEO
📱 +359 88 534 8666 · ✉️ krasimiruzun@smartmenukj.com
📍 ul. „Dzhebelska" 2, 6600 Baykal, Kardzhali, Bulgaria
[Instagram](https://www.instagram.com/1337_krasimir_/) · [LinkedIn](https://www.linkedin.com/in/krasimir-uzun-316a053bb/)

---

© 2026 SmartMenuKJ. All rights reserved.
