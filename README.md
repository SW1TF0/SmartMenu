# SmartMenuKJ

> Premium technology execution enterprise — **Web Development · 3D Printing · Home & Business Automation · SmartMenus for Restaurants.**

A high-end, fully responsive, bilingual (🇧🇬 / 🇬🇧) single-page website with scroll-driven background morphing, an interactive project estimator, a glassmorphism auth experience, and a real backend for registration and contact inquiries.

Headquartered in Kardzhali, Bulgaria. Founder & CEO: **Krasimir Uzun**.

---

## ✨ Features

- **Scroll-driven background morphing** — the gradient & accent colour blend between each service section.
- **Animated hero** — particle-constellation canvas + rotating headline word.
- **Interactive 4-pillar showcase** with live mock visuals.
- **Project & service estimator** — combine services for an instant, multi-service bundle-discounted quote.
- **Filterable portfolio**, auto-rotating **testimonials**, **CEO vision** spotlight and an **FAQ** accordion.
- **Glassmorphism auth** (register / login) with a real backend, hashed passwords and sessions.
- **Contact form** with validation that stores inquiries server-side.
- **3D pointer-tilt** cards, cursor spotlight, magnetic buttons, reveal-on-scroll, section-progress rail.
- **Bilingual** EN/BG toggle (persisted) and full `prefers-reduced-motion` support.
- **SEO ready** — structured data (JSON-LD), Open Graph, sitemap, robots.

---

## 🧱 Tech stack

| Layer | Technology |
|-------|------------|
| Markup | HTML5 |
| Styling | Tailwind CSS (CDN) + custom `styles.css` |
| Behaviour | Vanilla JavaScript (no framework, no build step) |
| Icons / Fonts | Font Awesome 6, Google Fonts (Inter + Montserrat) |
| Backend (self-hosted) | PowerShell HTTP server (`server.ps1`) + JSON storage |
| Backend (static hosting) | Built-in client-side fallback (localStorage) |

There is **no build step** — it's plain files you can host anywhere.

---

## 🚀 Deploy to GitHub Pages

This site runs perfectly as a **static site**. When no backend is present (as on GitHub Pages), the front-end automatically falls back to a secure client-side store, so **registration, login, sessions and the contact form all still work** for the live demo.

**Option A — GitHub Actions (recommended):** already included in `.github/workflows/deploy.yml`.
1. Push this repo to GitHub.
2. Go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` deploys automatically. Your site goes live at `https://<username>.github.io/<repo>/`.

**Option B — Deploy from branch:** Settings → Pages → Source: *Deploy from a branch* → `main` / `/ (root)`.

> Using a custom domain (e.g. `smartmenukj.com`)? Add it under Settings → Pages → Custom domain, then create a `CNAME` file containing the domain.

---

## 🖥️ Run locally

### Static only (no installs)
Any static server works. With Windows PowerShell:
```powershell
powershell -ExecutionPolicy Bypass -File serve.ps1
```
Then open <http://localhost:5173>.

### Full backend (real registration + contact storage)
```powershell
powershell -ExecutionPolicy Bypass -File server.ps1
```
Then open <http://localhost:5173>. Data is written to `server-data/` (git-ignored).

> Opening `index.html` directly via `file://` will run the static fallback, but a served origin (`http://` / `https://`) is recommended so password hashing and sessions behave correctly.

---

## 🔌 Backend API (when self-hosted via `server.ps1`)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| `POST` | `/api/register` | Create an account |
| `POST` | `/api/login` | Sign in |
| `POST` | `/api/logout` | Sign out |
| `GET`  | `/api/me` | Current session user |
| `POST` | `/api/contact` | Submit a contact inquiry |

**Security:** passwords are hashed with **PBKDF2-SHA256** (100k iterations, per-user salt); sessions use an **HttpOnly cookie**; every endpoint validates input server-side; data files are never served over HTTP.

---

## ⚙️ Configuration

All in `script.js` (top of the file):

| Constant | Default | Purpose |
|----------|---------|---------|
| `CONTACT_ENDPOINT` | `''` | On static hosting, set to a form-service URL (e.g. Formspree) to deliver contact messages by email. |
| `HERO_VIDEO` | `''` | Set to an `.mp4` URL to overlay a real ambient video behind the hero. |

Server port: set the `SMKJ_PORT` environment variable before launching `server.ps1` (default `5173`).

---

## 📁 Project structure

```
.
├── index.html          # Markup for the whole single-page site
├── styles.css          # Custom styling, animations, morphing, components
├── script.js           # All behaviour + adaptive backend adapter
├── server.ps1          # Full app server (static + JSON API) — self-hosting
├── serve.ps1           # Static-only dev server
├── 404.html            # Branded not-found page (GitHub Pages)
├── robots.txt / sitemap.xml
├── .github/workflows/  # GitHub Pages deployment
└── server-data/        # Runtime JSON storage (git-ignored)
```

---

## 📞 Contact

**SmartMenuKJ** — Krasimir Uzun, Founder & CEO
📱 +359 88 534 8666 · ✉️ krasimiruzun@smartmenukj.com
📍 ul. „Dzhebelska" 2, 6600 Baykal, Kardzhali, Bulgaria
[Instagram](https://www.instagram.com/1337_krasimir_/) · [LinkedIn](https://www.linkedin.com/in/krasimir-uzun-316a053bb/)

---

© 2026 SmartMenuKJ. All rights reserved.
