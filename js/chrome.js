// ============================================================================
// Shared site chrome: header (nav) + footer, injected into every page so the
// nav/footer markup only needs to be maintained in one place. Also owns the
// light/dark theme toggle and the live Kardzhali clock in the footer.
// Expects <header id="site-header" data-active="PAGE"></header> and
// <footer id="site-footer"></footer> placeholders in the page HTML.
// ============================================================================
import { t, escapeHtml } from "./i18n.js?v=20260928";

const NAV_ITEMS = [
  { key: "index.html", label: "nav.home" },
  { key: "services.html", label: "nav.services" },
  { key: "portfolio.html", label: "nav.portfolio" },
  { key: "about.html", label: "nav.about" },
  { key: "contact.html", label: "nav.contact" },
];

const THEME_KEY = "smkj_theme";
const THEME_COLORS = { light: "#f1f0ee", dark: "#000000" };

function iconSvg(name) {
  const icons = {
    menu: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M5 9h14M5 15h14"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/></svg>',
    theme: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor"/></svg>',
    ig: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c3.2 0 3.6 0 4.85.07 3.25.15 4.77 1.69 4.92 4.92.06 1.25.07 1.63.07 4.81 0 3.19-.01 3.56-.07 4.81-.15 3.23-1.66 4.77-4.92 4.92-1.25.06-1.62.07-4.85.07-3.2 0-3.58-.01-4.83-.07-3.26-.15-4.77-1.7-4.92-4.92-.06-1.25-.07-1.62-.07-4.81 0-3.18.02-3.56.07-4.81.15-3.23 1.67-4.77 4.92-4.92C8.42 2.21 8.8 2.2 12 2.2zm0 1.8c-3.14 0-3.5 0-4.74.07-2.32.1-3.4 1.2-3.5 3.5-.06 1.24-.07 1.6-.07 4.74s.01 3.5.07 4.74c.1 2.3 1.18 3.4 3.5 3.5 1.24.06 1.6.07 4.74.07s3.5-.01 4.74-.07c2.31-.1 3.4-1.19 3.5-3.5.06-1.24.07-1.6.07-4.74s-.01-3.5-.07-4.74c-.1-2.3-1.19-3.4-3.5-3.5C15.5 4 15.14 4 12 4zm0 3.35a4.8 4.8 0 110 9.6 4.8 4.8 0 010-9.6zm0 1.8a3 3 0 100 6 3 3 0 000-6zm5-2a1.12 1.12 0 110 2.25A1.12 1.12 0 0117 7.15z"/></svg>',
    li: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.94 8.5H3.56V20.4h3.38V8.5zM5.25 3.6a1.96 1.96 0 100 3.92 1.96 1.96 0 000-3.92zM20.44 20.4h-3.37v-6.1c0-1.45-.03-3.32-2.02-3.32-2.03 0-2.34 1.58-2.34 3.22v6.2H9.34V8.5h3.24v1.63h.05c.45-.86 1.56-1.78 3.22-1.78 3.44 0 4.07 2.27 4.07 5.21v6.84z"/></svg>',
    phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 01-2.2 2 19.8 19.8 0 01-8.6-3.1 19.5 19.5 0 01-6-6A19.8 19.8 0 012.1 4.2 2 2 0 014.1 2h3a2 2 0 012 1.7c.1.9.3 1.8.6 2.7a2 2 0 01-.4 2.1L8.1 9.7a16 16 0 006.2 6.2l1.2-1.2a2 2 0 012.1-.4c.9.3 1.8.5 2.7.6a2 2 0 011.7 2z"/></svg>',
  };
  return icons[name] || "";
}

// ---------------------------------------------------------------- theme --
function storedTheme() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch (e) {
    return null;
  }
}

export function currentTheme() {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr === "dark" || attr === "light") return attr;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function syncThemeUI() {
  const theme = currentTheme();
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", THEME_COLORS[theme]));
  const btn = document.getElementById("themeToggle");
  if (btn) {
    btn.setAttribute("aria-label", t(theme === "dark" ? "theme.toLight" : "theme.toDark"));
    btn.setAttribute("aria-pressed", theme === "dark" ? "true" : "false");
  }
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    /* storage unavailable — the choice lasts for this page view only */
  }
  syncThemeUI();
  document.dispatchEvent(new CustomEvent("smkj:theme", { detail: { theme } }));
}

function initTheme() {
  const btn = document.getElementById("themeToggle");
  if (btn) btn.addEventListener("click", () => setTheme(currentTheme() === "dark" ? "light" : "dark"));
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    if (storedTheme()) return;
    syncThemeUI();
    document.dispatchEvent(new CustomEvent("smkj:theme", { detail: { theme: currentTheme() } }));
  });
  document.addEventListener("smkj:lang", syncThemeUI);
  syncThemeUI();
}

// --------------------------------------------------------------- markup --
function brandHTML() {
  return `<span class="brand-word">SmartMenuKJ</span><span class="brand-dot" aria-hidden="true"></span>`;
}

function headerHTML(active) {
  const links = NAV_ITEMS.map(
    (item) =>
      `<a href="${item.key}" data-i18n="${item.label}"${active === item.key ? ' class="active" aria-current="page"' : ""}>${item.label}</a>`
  ).join("");
  return `
  <div class="container nav">
    <a href="index.html" class="brand" data-i18n-aria="brand.home" aria-label="SmartMenuKJ">${brandHTML()}</a>
    <nav class="nav-links" id="navLinks" aria-label="Main">
      ${links}
      <div class="nav-cta-mobile">
        <div id="navAuthMobile"></div>
      </div>
    </nav>
    <div class="nav-actions">
      <button class="icon-btn theme-toggle" id="themeToggle" type="button">${iconSvg("theme")}</button>
      <div class="lang-switch" role="group" aria-label="Language">
        <button type="button" data-lang-btn="en" lang="en">EN</button>
        <button type="button" data-lang-btn="bg" lang="bg">BG</button>
      </div>
      <div id="navAuthDesktop"></div>
      <button class="icon-btn nav-toggle" id="navToggle" type="button" aria-controls="navLinks" aria-expanded="false" data-i18n-aria="nav.menu">${iconSvg("menu")}</button>
    </div>
  </div>`;
}

function authNavHTML(user, admin) {
  if (!user) {
    return `<div class="flex gap-8">
      <a href="login.html" class="btn btn-ghost btn-sm" data-i18n="nav.login">Log in</a>
      <a href="contact.html#quote" class="btn btn-primary btn-sm" data-i18n="nav.quote">Get a Quote</a>
    </div>`;
  }
  const initial = escapeHtml((user.displayName || user.email || "?").trim().charAt(0).toUpperCase());
  return `<div class="flex gap-8 items-center">
    ${admin ? `<a href="admin.html" class="btn btn-ghost btn-sm" data-i18n="nav.admin">Admin</a>` : ""}
    <a href="account.html" class="btn btn-ghost btn-sm"><span class="avatar-mini" aria-hidden="true">${initial}</span><span data-i18n="nav.account">Account</span></a>
    <button type="button" class="btn btn-warm btn-sm navLogout" data-i18n="nav.logout">Sign out</button>
  </div>`;
}

function footerHTML() {
  const year = new Date().getFullYear();
  return `
  <div class="container">
    <div class="footer-grid">
      <div>
        <a href="index.html" class="brand" aria-label="SmartMenuKJ">${brandHTML()}</a>
        <p class="footer-tagline" data-i18n="footer.tagline">One team for every piece of technology your home, restaurant or business needs.</p>
        <div class="social-row">
          <a href="https://www.instagram.com/1337_krasimir_/" target="_blank" rel="noopener" aria-label="Instagram">${iconSvg("ig")}</a>
          <a href="https://www.linkedin.com/in/krasimir-uzun-316a053bb/" target="_blank" rel="noopener" aria-label="LinkedIn">${iconSvg("li")}</a>
          <a href="tel:+359885348666" aria-label="+359 88 534 8666">${iconSvg("phone")}</a>
        </div>
      </div>
      <div>
        <h4 data-i18n="footer.services">Services</h4>
        <ul>
          <li><a href="services.html#web" data-i18n="svc.web">Web Development</a></li>
          <li><a href="services.html#print3d" data-i18n="svc.print3d">3D Printing</a></li>
          <li><a href="services.html#smarthome" data-i18n="svc.smarthome">Smart Home & Business</a></li>
          <li><a href="services.html#cameras" data-i18n="svc.cameras">Camera & Security Systems</a></li>
          <li><a href="services.html#menu" data-i18n="svc.menu">Digital Smart Menus</a></li>
          <li><a href="services.html#pc" data-i18n="svc.pc">PC & Printer Service</a></li>
        </ul>
      </div>
      <div>
        <h4 data-i18n="footer.company">Company</h4>
        <ul>
          <li><a href="about.html" data-i18n="footer.about">About us</a></li>
          <li><a href="portfolio.html" data-i18n="footer.portfolio">Our work</a></li>
          <li><a href="contact.html" data-i18n="footer.contact">Contact</a></li>
          <li><a href="login.html" data-i18n="footer.login">Log in / Register</a></li>
        </ul>
      </div>
      <div>
        <h4 data-i18n="footer.legal">Legal</h4>
        <ul>
          <li><a href="privacy.html" data-i18n="footer.privacy">Privacy & Cookies</a></li>
          <li><a href="terms.html" data-i18n="footer.terms">Terms of Service</a></li>
          <li><button type="button" class="linklike" data-open-cookie-settings data-i18n="footer.cookies">Cookie settings</button></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>&copy; ${year} SmartMenuKJ &mdash; Krasimir Uzun. <span data-i18n="footer.rights">All rights reserved.</span></span>
      <span class="local-time"><span class="rec" aria-hidden="true"></span><span data-i18n="footer.localtime">Kardzhali, local time</span><b id="localTime">--:--</b></span>
    </div>
    <div class="footer-mark" aria-hidden="true">SmartMenuKJ<i></i></div>
  </div>`;
}

function mobileCtaHTML() {
  return `
  <a href="tel:+359885348666" class="btn btn-ghost btn-sm" data-i18n="mobilecta.call">Call</a>
  <a href="contact.html#quote" class="btn btn-primary btn-block" data-i18n="nav.quote">Get a Quote</a>`;
}

function startClock() {
  const el = document.getElementById("localTime");
  if (!el) return;
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Sofia" });
  } catch (e) {
    return;
  }
  const tick = () => (el.textContent = fmt.format(new Date()));
  tick();
  setInterval(tick, 15000);
}

function initMobileNav() {
  const toggle = document.getElementById("navToggle");
  const links = document.getElementById("navLinks");
  if (!toggle || !links) return;
  const setOpen = (open) => {
    links.classList.toggle("open", open);
    document.body.classList.toggle("nav-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.setAttribute("data-i18n-aria", open ? "nav.close" : "nav.menu");
    toggle.setAttribute("aria-label", t(open ? "nav.close" : "nav.menu"));
    toggle.innerHTML = iconSvg(open ? "close" : "menu");
  };
  toggle.addEventListener("click", () => setOpen(!links.classList.contains("open")));
  links.addEventListener("click", (e) => {
    if (e.target.closest("a")) setOpen(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && links.classList.contains("open")) {
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia("(min-width: 961px)").addEventListener("change", (mq) => {
    if (mq.matches) setOpen(false);
  });
}

export function mountChrome() {
  const header = document.getElementById("site-header");
  const footer = document.getElementById("site-footer");
  const active = header ? header.getAttribute("data-active") : "";
  if (header) {
    header.classList.add("site-header");
    header.innerHTML = headerHTML(active);
  }
  if (footer) {
    footer.classList.add("site-footer", "invert");
    footer.innerHTML = footerHTML();
  }

  if (header && !header.hasAttribute("data-hide-mobile-cta") && !document.querySelector(".mobile-cta-bar")) {
    const bar = document.createElement("div");
    bar.className = "mobile-cta-bar";
    bar.innerHTML = mobileCtaHTML();
    document.body.appendChild(bar);
  }

  initMobileNav();
  initTheme();
  startClock();

  const scrollHeader = () => {
    if (header) header.classList.toggle("scrolled", window.scrollY > 8);
  };
  document.addEventListener("scroll", scrollHeader, { passive: true });
  scrollHeader();

  const renderAuth = (user, admin, logout) => {
    const html = authNavHTML(user, admin);
    ["navAuthDesktop", "navAuthMobile"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = html;
    });
    document.querySelectorAll(".navLogout").forEach((btn) =>
      btn.addEventListener("click", async () => {
        if (logout) await logout();
        window.location.href = "index.html";
      })
    );
    window.dispatchEvent(new Event("smkj:i18n-refresh"));
  };

  // Firebase loads lazily so the header, footer and translations still render
  // when the SDK is slow, offline or blocked; the nav starts signed-out.
  renderAuth(null, false);
  import("./auth.js?v=20260928")
    .then(({ watchAuth, isAdmin, logout }) =>
      watchAuth((user) => {
        const admin = isAdmin(user);
        renderAuth(user, admin, logout);
        document.dispatchEvent(new CustomEvent("smkj:auth", { detail: { user, admin } }));
      })
    )
    .catch(() => {
      /* auth unavailable — keep the signed-out navigation */
    });
}
