// ============================================================================
// Lightweight EN / BG / TR translation engine, plus the Home / Business
// audience switch.
// Usage per page:
//   <script type="module">
//     import { registerDict, applyI18n, initLangSwitch } from "./js/i18n.js?v=20261101";
//     registerDict({ en: {...}, bg: {...}, tr: {...} });
//     applyI18n();
//     initLangSwitch();
//   </script>
// Elements: data-i18n="key" (textContent), data-i18n-html="key" (innerHTML —
// only for site-authored strings that contain links/markup), data-i18n-ph="key"
// (placeholder), data-i18n-aria="key" (aria-label).
//
// Audiences — the site shows a "For home" (personal) or "For business"
// version; business is the default and is what the static HTML contains:
//   "key@personal": "…"   a dictionary entry used instead of "key" for
//                         home visitors (falls back to "key" when absent)
//   data-for="business" / data-for="personal"
//                         element shown to that audience only (css/style.css)
//   data-reorder          on a container: its children are re-sorted by their
//                         data-order-personal numbers for home visitors (no
//                         number = after the numbered ones) and put back in
//                         the HTML order for business visitors
// The choice is kept in localStorage (smkj_audience) and can be preset with
// ?for=personal / ?for=business. The inline <head> script sets
// <html data-audience> before the page paints, so there is no flash.
// ============================================================================

const STORAGE_KEY = "smkj_lang";
export const LANGS = ["en", "bg", "tr"];
let sessionLang = null;
const isLang = (v) => LANGS.includes(v);

// Public pages exist once per language: /page.html (English), /bg/page.html
// (Bulgarian) and /tr/page.html (Turkish), built by tools/build-langs.mjs so
// search engines index every language. On those pages the URL decides the
// language and the switch moves between the twins; other pages (login,
// account, admin) still translate in place.
const altLinks = {};
document.querySelectorAll('link[rel="alternate"][hreflang]').forEach((l) => (altLinks[l.hreflang] = l.href));
const pageLangAttr = document.documentElement.getAttribute("lang");
const PAGE_LANG = altLinks.bg ? (isLang(pageLangAttr) ? pageLangAttr : "en") : null;

// The language a first-time visitor gets: Bulgarian, except for Turkish
// browsers, which get Turkish. English is only shown when picked.
function defaultLang() {
  return (navigator.language || "").toLowerCase().startsWith("tr") ? "tr" : "bg";
}

function twinUrl(lang) {
  const url = new URL(altLinks[lang], location.href);
  return url.pathname + location.search + location.hash;
}

function savedLang() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return isLang(saved) ? saved : null;
  } catch (e) {
    return null; /* storage unavailable (private mode / blocked) */
  }
}

// The redirect to the visitor's language (the site opens in Bulgarian, or
// Turkish for Turkish browsers) runs in the inline <head> script of every
// page, before the stylesheet loads, so a first visit doesn't download the
// English page's assets first. Search engine crawlers are not redirected.

export const COMMON = {
  en: {
    "nav.home": "Home",
    "nav.services": "Services",
    "nav.portfolio": "Work",
    "nav.about": "About",
    "nav.contact": "Contact",
    "nav.login": "Log in",
    "nav.quote": "Get a Quote",
    "nav.account": "Account",
    "nav.admin": "Admin",
    "nav.logout": "Sign out",
    "nav.menu": "Open menu",
    "nav.close": "Close menu",
    "brand.home": "SmartMenuKJ — home",
    "a11y.skip": "Skip to content",
    "theme.toDark": "Switch to dark mode",
    "theme.toLight": "Switch to light mode",
    "footer.tagline": "One team for every piece of technology your home, restaurant or business needs — built and installed in Kardzhali and across Bulgaria.",
    "footer.services": "Services",
    "footer.company": "Company",
    "footer.legal": "Legal",
    "footer.divisions": "Divisions",
    "footer.divisions.all": "All divisions",
    "footer.about": "About us",
    "footer.portfolio": "Our work",
    "footer.contact": "Contact",
    "footer.login": "Log in / Register",
    "footer.privacy": "Privacy & Cookies",
    "footer.terms": "Terms of Service",
    "footer.cookies": "Cookie settings",
    "footer.rights": "All rights reserved.",
    "footer.localtime": "Kardzhali, local time",
    "svc.web": "Web Development",
    "svc.print3d": "3D Printing",
    "svc.smarthome": "Smart Home & Business",
    "svc.cameras": "Camera & Security Systems",
    "svc.menu": "Digital Smart Menus",
    "svc.pc": "PC & Printer Service",
    "cookie.title": "Cookies",
    "cookie.text": "We use essential cookies to run this site, and optional analytics cookies to understand traffic. You can change your choice anytime from the footer.",
    "cookie.accept": "Accept all",
    "cookie.reject": "Essential only",
    "cookie.learn": "Learn more",
    "contact.form.name": "Full name",
    "contact.form.email": "Email",
    "ctaband.cta1": "Start a project",
    "mobilecta.call": "Call",
    "aud.aria": "Show services for",
    "aud.personal": "For home",
    "aud.business": "For business",
    "ctaband.cta1@personal": "Get a free quote",
    // Devices we install (img/products/) — home page and services page.
    "prod.outdoorcam": "Outdoor camera",
    "prod.solarcam": "Solar 4G camera",
    "prod.keypad": "Access keypad",
    "prod.reader": "Card & PIN reader",
    "prod.siren": "Alarm siren",
    "prod.switchmod": "Switch module",
    "prod.hub": "Smart hub",
    "prod.bulb": "Smart bulb",
    "prod.plug": "Smart plug",
    "prod.thermo": "Radiator thermostats",
    "prod.indoorcam": "Indoor camera",
    "prod.sensor": "Door & window sensor",
    "prod.vacuum": "Robot vacuum",
  },
  bg: {
    "nav.home": "Начало",
    "nav.services": "Услуги",
    "nav.portfolio": "Проекти",
    "nav.about": "За нас",
    "nav.contact": "Контакти",
    "nav.login": "Вход",
    "nav.quote": "Получи оферта",
    "nav.account": "Профил",
    "nav.admin": "Админ",
    "nav.logout": "Изход",
    "nav.menu": "Отвори менюто",
    "nav.close": "Затвори менюто",
    "brand.home": "SmartMenuKJ — начало",
    "a11y.skip": "Към съдържанието",
    "theme.toDark": "Превключи към тъмен режим",
    "theme.toLight": "Превключи към светъл режим",
    "footer.tagline": "Един екип за всяка технология, от която се нуждае вашият дом, ресторант или бизнес — изградена и инсталирана в Кърджали и в цяла България.",
    "footer.services": "Услуги",
    "footer.company": "Компания",
    "footer.legal": "Правно",
    "footer.divisions": "Подразделения",
    "footer.divisions.all": "Всички подразделения",
    "footer.about": "За нас",
    "footer.portfolio": "Нашите проекти",
    "footer.contact": "Контакти",
    "footer.login": "Вход / Регистрация",
    "footer.privacy": "Поверителност и бисквитки",
    "footer.terms": "Общи условия",
    "footer.cookies": "Настройки за бисквитки",
    "footer.rights": "Всички права запазени.",
    "footer.localtime": "Кърджали, местно време",
    "svc.web": "Уеб разработка",
    "svc.print3d": "3D Печат",
    "svc.smarthome": "Умен дом и бизнес",
    "svc.cameras": "Камери и сигурност",
    "svc.menu": "Дигитални умни менюта",
    "svc.pc": "Сервиз на PC и принтери",
    "cookie.title": "Бисквитки",
    "cookie.text": "Използваме съществени бисквитки за работата на сайта и незадължителни аналитични бисквитки, за да разберем трафика. Можете да промените избора си по всяко време от долния колонтитул.",
    "cookie.accept": "Приемам всички",
    "cookie.reject": "Само съществени",
    "cookie.learn": "Научи повече",
    "contact.form.name": "Име",
    "contact.form.email": "Имейл",
    "ctaband.cta1": "Започни проект",
    "mobilecta.call": "Обади се",
    "aud.aria": "Покажи услугите за",
    "aud.personal": "За дома",
    "aud.business": "За бизнеса",
    "ctaband.cta1@personal": "Безплатна оферта",
    // Devices we install (img/products/) — home page and services page.
    "prod.outdoorcam": "Външна камера",
    "prod.solarcam": "Соларна 4G камера",
    "prod.keypad": "Клавиатура за достъп",
    "prod.reader": "Четец за карти и ПИН",
    "prod.siren": "Алармена сирена",
    "prod.switchmod": "Смарт реле за ключ",
    "prod.hub": "Хъб за умен дом",
    "prod.bulb": "Умна крушка",
    "prod.plug": "Умен контакт",
    "prod.thermo": "Умни термоглави",
    "prod.indoorcam": "Вътрешна камера",
    "prod.sensor": "Сензор за врата и прозорец",
    "prod.vacuum": "Робот прахосмукачка",
  },
  tr: {
    "nav.home": "Ana Sayfa",
    "nav.services": "Hizmetler",
    "nav.portfolio": "Projeler",
    "nav.about": "Hakkımızda",
    "nav.contact": "İletişim",
    "nav.login": "Giriş yap",
    "nav.quote": "Teklif Al",
    "nav.account": "Hesabım",
    "nav.admin": "Yönetim",
    "nav.logout": "Çıkış yap",
    "nav.menu": "Menüyü aç",
    "nav.close": "Menüyü kapat",
    "brand.home": "SmartMenuKJ — ana sayfa",
    "a11y.skip": "İçeriğe geç",
    "theme.toDark": "Koyu moda geç",
    "theme.toLight": "Açık moda geç",
    "footer.tagline": "Evinizin, restoranınızın veya işletmenizin ihtiyaç duyduğu her teknoloji için tek ekip — Kırcaali'de ve tüm Bulgaristan'da kurulum.",
    "footer.services": "Hizmetler",
    "footer.company": "Şirket",
    "footer.legal": "Yasal",
    "footer.divisions": "Bölümler",
    "footer.divisions.all": "Tüm bölümler",
    "footer.about": "Hakkımızda",
    "footer.portfolio": "Projelerimiz",
    "footer.contact": "İletişim",
    "footer.login": "Giriş / Kayıt",
    "footer.privacy": "Gizlilik ve Çerezler",
    "footer.terms": "Hizmet Şartları",
    "footer.cookies": "Çerez ayarları",
    "footer.rights": "Tüm hakları saklıdır.",
    "footer.localtime": "Kırcaali, yerel saat",
    "svc.web": "Web Geliştirme",
    "svc.print3d": "3D Baskı",
    "svc.smarthome": "Akıllı Ev ve İşletme",
    "svc.cameras": "Kamera ve Güvenlik Sistemleri",
    "svc.menu": "Dijital Akıllı Menüler",
    "svc.pc": "Bilgisayar ve Yazıcı Servisi",
    "cookie.title": "Çerezler",
    "cookie.text": "Sitenin çalışması için zorunlu çerezler, trafiği anlamak için ise isteğe bağlı analiz çerezleri kullanıyoruz. Seçiminizi istediğiniz zaman alt bilgiden değiştirebilirsiniz.",
    "cookie.accept": "Tümünü kabul et",
    "cookie.reject": "Yalnızca zorunlu",
    "cookie.learn": "Daha fazla bilgi",
    "contact.form.name": "Ad soyad",
    "contact.form.email": "E-posta",
    "ctaband.cta1": "Proje başlat",
    "mobilecta.call": "Ara",
    "aud.aria": "Hizmetleri göster",
    "aud.personal": "Ev için",
    "aud.business": "İşletmeler için",
    "ctaband.cta1@personal": "Ücretsiz teklif al",
    // Devices we install (img/products/) — home page and services page.
    "prod.outdoorcam": "Dış mekân kamerası",
    "prod.solarcam": "Güneş enerjili 4G kamera",
    "prod.keypad": "Erişim tuş takımı",
    "prod.reader": "Kart ve şifre okuyucu",
    "prod.siren": "Alarm sireni",
    "prod.switchmod": "Akıllı anahtar modülü",
    "prod.hub": "Akıllı ev merkezi",
    "prod.bulb": "Akıllı ampul",
    "prod.plug": "Akıllı priz",
    "prod.thermo": "Radyatör termostatları",
    "prod.indoorcam": "İç mekân kamerası",
    "prod.sensor": "Kapı ve pencere sensörü",
    "prod.vacuum": "Robot süpürge",
  },
};

export function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

let dict = COMMON;

export function registerDict(pageDict) {
  dict = Object.fromEntries(LANGS.map((l) => [l, { ...COMMON[l], ...(pageDict[l] || {}) }]));
}

export function getLang() {
  if (PAGE_LANG) return PAGE_LANG;
  if (sessionLang) return sessionLang;
  const saved = savedLang();
  if (saved) return saved;
  return defaultLang();
}

// ------------------------------------------------------------ audience --
const AUDIENCE_KEY = "smkj_audience";

export function getAudience() {
  return document.documentElement.getAttribute("data-audience") === "personal" ? "personal" : "business";
}

// Shows the page for `audience` ("personal" or "business"). `store: false`
// changes this page view only (used when a link points at business-only
// content while the visitor has "For home" selected).
export function setAudience(audience, { store = true } = {}) {
  const aud = audience === "personal" ? "personal" : "business";
  document.documentElement.setAttribute("data-audience", aud);
  if (store) {
    try {
      localStorage.setItem(AUDIENCE_KEY, aud);
    } catch (e) {
      /* storage unavailable — the choice lasts for this page view only */
    }
  }
  applyI18n();
  document.dispatchEvent(new CustomEvent("smkj:audience", { detail: { audience: aud } }));
}

// The string for `key` in the current language and audience. Home visitors
// get "key@personal" where one exists. Falls back to English, then the key.
export function t(key, { lang = getLang(), audience = getAudience() } = {}) {
  const variant = audience === "personal" ? `${key}@personal` : null;
  for (const table of [dict[lang], dict.en, COMMON.en]) {
    if (!table) continue;
    if (variant && table[variant] != null) return table[variant];
    if (table[key] != null) return table[key];
  }
  return key;
}

// Puts the children of every [data-reorder] container in the order for the
// current audience. Returns true if anything moved.
function reorder(root) {
  const personal = getAudience() === "personal";
  let moved = false;
  root.querySelectorAll("[data-reorder]").forEach((box) => {
    const kids = [...box.children];
    kids.forEach((el, i) => {
      if (!el.hasAttribute("data-order-business")) el.setAttribute("data-order-business", String(i));
    });
    const base = (el) => Number(el.getAttribute("data-order-business"));
    const rank = (el) => {
      const n = personal ? el.getAttribute("data-order-personal") : null;
      return n == null ? 1000 + base(el) : Number(n);
    };
    const sorted = kids.slice().sort((a, b) => rank(a) - rank(b));
    if (sorted.every((el, i) => el === kids[i])) return;
    sorted.forEach((el) => box.appendChild(el));
    moved = true;
  });
  return moved;
}

let firstApply = true;

export function applyI18n(root = document) {
  const lang = getLang();
  const audience = getAudience();
  document.documentElement.lang = lang;
  // A key with no string keeps the element's built-in text rather than
  // showing the raw key.
  const each = (attr, apply) =>
    root.querySelectorAll(`[${attr}]`).forEach((el) => {
      const key = el.getAttribute(attr);
      const value = t(key, { lang, audience });
      if (value !== key) apply(el, value);
    });
  each("data-i18n", (el, v) => {
    if (el.textContent !== v) el.textContent = v;
  });
  each("data-i18n-html", (el, v) => {
    if (el.innerHTML !== v) el.innerHTML = v;
  });
  each("data-i18n-ph", (el, v) => el.setAttribute("placeholder", v));
  each("data-i18n-aria", (el, v) => el.setAttribute("aria-label", v));
  const moved = reorder(root);

  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    const on = btn.getAttribute("data-lang-btn") === lang;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  });
  document.querySelectorAll("[data-audience-btn]").forEach((btn) => {
    btn.setAttribute("aria-pressed", btn.getAttribute("data-audience-btn") === audience ? "true" : "false");
  });
  document.documentElement.classList.remove("aud-pending");

  // The browser scrolled to a #hash before the home version re-sorted the
  // page, so on first load scroll to it again.
  if (firstApply && root === document) {
    firstApply = false;
    const target = moved && location.hash.length > 1 ? document.getElementById(decodeURIComponent(location.hash.slice(1))) : null;
    if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: "instant", block: "start" }));
  }
  document.dispatchEvent(new CustomEvent("smkj:lang", { detail: { lang } }));
}

export function setLang(lang) {
  sessionLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch (e) {
    /* storage unavailable — the choice lasts for this page view only */
  }
  if (PAGE_LANG && lang !== PAGE_LANG && altLinks[lang]) {
    location.href = twinUrl(lang);
    return;
  }
  applyI18n();
}

export function initLangSwitch() {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lang-btn]");
    if (!btn) return;
    setLang(btn.getAttribute("data-lang-btn"));
  });
}

// Re-translate whenever chrome.js injects new nav markup (e.g. after auth state changes).
window.addEventListener("smkj:i18n-refresh", () => applyI18n());
