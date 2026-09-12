// ============================================================================
// EU/GDPR cookie consent banner. Only essential storage (language, consent
// choice, auth session) is used until the visitor opts in to analytics.
// ============================================================================
const KEY = "smkj_consent"; // "all" | "essential" | null

function bannerHTML() {
  return `
  <p data-i18n="cookie.text">We use essential cookies to run this site, and optional analytics cookies to understand traffic. You can change your choice anytime from the footer.</p>
  <div class="cookie-actions">
    <button class="btn btn-primary btn-sm" data-consent="all" data-i18n="cookie.accept">Accept all</button>
    <button class="btn btn-ghost btn-sm" data-consent="essential" data-i18n="cookie.reject">Essential only</button>
    <a href="privacy.html" class="btn btn-ghost btn-sm" data-i18n="cookie.learn">Learn more</a>
  </div>`;
}

export function getConsent() {
  return localStorage.getItem(KEY);
}

export function initCookieBanner() {
  let el = document.getElementById("cookieBanner");
  if (!el) {
    el = document.createElement("div");
    el.id = "cookieBanner";
    el.className = "cookie-banner";
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
    localStorage.setItem(KEY, btn.getAttribute("data-consent"));
    hide();
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-cookie-settings]")) {
      e.preventDefault();
      show();
    }
  });
}
