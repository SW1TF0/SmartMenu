// ============================================================================
// EU/GDPR cookie consent banner. Only essential storage (language, theme,
// consent choice, auth session) is used until the visitor opts in to analytics.
// ============================================================================
const KEY = "smkj_consent"; // "all" | "essential" | null

function bannerHTML() {
  return `
  <p class="eyebrow" data-i18n="cookie.title">Cookies</p>
  <p data-i18n="cookie.text">We use essential cookies to run this site, and optional analytics cookies to understand traffic. You can change your choice anytime from the footer.</p>
  <div class="cookie-actions">
    <button type="button" class="btn btn-primary btn-sm" data-consent="all" data-i18n="cookie.accept">Accept all</button>
    <button type="button" class="btn btn-ghost btn-sm" data-consent="essential" data-i18n="cookie.reject">Essential only</button>
    <a href="privacy.html" class="btn btn-ghost btn-sm" data-i18n="cookie.learn">Learn more</a>
  </div>`;
}

export function getConsent() {
  try {
    return localStorage.getItem(KEY);
  } catch (e) {
    return null;
  }
}

export function initCookieBanner() {
  let el = document.getElementById("cookieBanner");
  if (!el) {
    el = document.createElement("div");
    el.id = "cookieBanner";
    el.className = "cookie-banner invert";
    el.setAttribute("role", "region");
    el.setAttribute("aria-label", "Cookies");
    document.body.appendChild(el);
  }
  el.innerHTML = bannerHTML();
  window.dispatchEvent(new Event("smkj:i18n-refresh"));

  const show = () => requestAnimationFrame(() => el.classList.add("show"));
  const hide = () => el.classList.remove("show");

  if (!getConsent()) show();

  el.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-consent]");
    if (!btn) return;
    try {
      localStorage.setItem(KEY, btn.getAttribute("data-consent"));
    } catch (err) {
      /* storage unavailable — hide for this page view */
    }
    hide();
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-cookie-settings]")) {
      e.preventDefault();
      show();
    }
  });
}
