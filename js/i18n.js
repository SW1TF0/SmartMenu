// ============================================================================
// Lightweight EN / BG translation engine.
// Usage per page:
//   <script type="module">
//     import { registerDict, applyI18n, initLangSwitch } from "./js/i18n.js";
//     registerDict({ en: {...}, bg: {...} });
//     applyI18n();
//     initLangSwitch();
//   </script>
// Elements: data-i18n="key" (textContent), data-i18n-html="key" (innerHTML),
// data-i18n-ph="key" (placeholder), data-i18n-aria="key" (aria-label).
// ============================================================================

const STORAGE_KEY = "smkj_lang";
let dict = { en: {}, bg: {} };

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
    "footer.tagline": "One team for every piece of technology your home, restaurant or business needs — built and installed in Kardzhali and across Bulgaria.",
    "footer.services": "Services",
    "footer.company": "Company",
    "footer.legal": "Legal",
    "footer.about": "About us",
    "footer.portfolio": "Our work",
    "footer.contact": "Contact",
    "footer.login": "Log in / Register",
    "footer.privacy": "Privacy & Cookies",
    "footer.terms": "Terms of Service",
    "footer.rights": "All rights reserved.",
    "svc.web": "Web Development",
    "svc.print3d": "3D Printing",
    "svc.smarthome": "Smart Home & Business",
    "svc.cameras": "Camera & Security Systems",
    "svc.menu": "Digital Smart Menus",
    "svc.pc": "PC & Printer Service",
    "cookie.text": "We use essential cookies to run this site, and optional analytics cookies to understand traffic. You can change your choice anytime from the footer.",
    "cookie.accept": "Accept all",
    "cookie.reject": "Essential only",
    "cookie.learn": "Learn more",
    "contact.form.name": "Full name",
    "contact.form.email": "Email",
    "ctaband.cta1": "Start a project",
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
    "footer.tagline": "Един екип за всяка технология, от която се нуждае вашият дом, ресторант или бизнес — изградена и инсталирана в Кърджали и в цяла България.",
    "footer.services": "Услуги",
    "footer.company": "Компания",
    "footer.legal": "Правно",
    "footer.about": "За нас",
    "footer.portfolio": "Нашите проекти",
    "footer.contact": "Контакти",
    "footer.login": "Вход / Регистрация",
    "footer.privacy": "Поверителност и бисквитки",
    "footer.terms": "Общи условия",
    "footer.rights": "Всички права запазени.",
    "svc.web": "Уеб разработка",
    "svc.print3d": "3D Печат",
    "svc.smarthome": "Умен дом и бизнес",
    "svc.cameras": "Камери и сигурност",
    "svc.menu": "Дигитални умни менюта",
    "svc.pc": "Сервиз на PC и принтери",
    "cookie.text": "Използваме съществени бисквитки за работата на сайта и незадължителни аналитични бисквитки, за да разберем трафика. Можете да промените избора си по всяко време от долния колонтитул.",
    "cookie.accept": "Приемам всички",
    "cookie.reject": "Само съществени",
    "cookie.learn": "Научи повече",
    "contact.form.name": "Име",
    "contact.form.email": "Имейл",
    "ctaband.cta1": "Започни проект",
  },
};

export function registerDict(pageDict) {
  dict = {
    en: { ...COMMON.en, ...(pageDict.en || {}) },
    bg: { ...COMMON.bg, ...(pageDict.bg || {}) },
  };
}

export function getLang() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "en" || saved === "bg") return saved;
  return navigator.language && navigator.language.toLowerCase().startsWith("bg") ? "bg" : "en";
}

export function t(key) {
  const lang = getLang();
  return (dict[lang] && dict[lang][key]) || (dict.en && dict.en[key]) || key;
}

export function applyI18n(root = document) {
  const lang = getLang();
  root.documentElement ? (root.documentElement.lang = lang) : (document.documentElement.lang = lang);
  root.querySelectorAll("[data-i18n]").forEach((el) => (el.textContent = t(el.getAttribute("data-i18n"))));
  root.querySelectorAll("[data-i18n-html]").forEach((el) => (el.innerHTML = t(el.getAttribute("data-i18n-html"))));
  root.querySelectorAll("[data-i18n-ph]").forEach((el) => el.setAttribute("placeholder", t(el.getAttribute("data-i18n-ph"))));
  root.querySelectorAll("[data-i18n-aria]").forEach((el) => el.setAttribute("aria-label", t(el.getAttribute("data-i18n-aria"))));
  document.querySelectorAll("[data-lang-btn]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-lang-btn") === lang);
  });
  document.dispatchEvent(new CustomEvent("smkj:lang", { detail: { lang } }));
}

export function setLang(lang) {
  localStorage.setItem(STORAGE_KEY, lang);
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
