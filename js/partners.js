// ============================================================================
// Partners shown on the home page (Partners section).
//
// To add or change a partner, edit an entry:
//   name   — the partner's name, shown as written (not translated)
//   type   — an i18n key for the small label under the name; add new keys to
//            the "partners.type.*" entries in index.html (EN + BG)
//   logo   — optional path to a logo in img/partners/. It sits on a white
//            plate in both themes, so a white-background JPG/PNG is fine.
//            Without a logo, the initials are drawn in the dot-matrix font.
//   url    — optional link to the partner's site (opens in a new tab)
// Add `placeholder: true` to a stand-in entry to give it a dashed outline.
// ============================================================================

import { escapeHtml } from "./i18n.js";

export const PARTNERS = [
  { name: "Great Wall Motors Kardzhali", type: "partners.type.auto", logo: "img/partners/gwm.png", url: "" },
  { name: "TechnoLux", type: "partners.type.tech", logo: "img/partners/technolux.png", url: "" },
  { name: "GlobalNet", type: "partners.type.isp", logo: "img/partners/globalnet.png", url: "" },
  { name: "Remela Service", type: "partners.type.service", logo: "img/partners/remela.png", url: "" },
];

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

// Renders PARTNERS into `el`. Call before applyI18n() so the type labels are
// translated, and before initReveal() so the tiles animate in.
export function renderPartners(el, partners = PARTNERS) {
  if (!el) return;
  el.innerHTML = partners
    .map((p) => {
      const mark = p.logo
        ? `<img src="${escapeHtml(p.logo)}" alt="" loading="lazy" decoding="async" />`
        : `<span class="partner-initials" aria-hidden="true">${escapeHtml(initials(p.name))}</span>`;
      const inner = `
        <div class="partner-mark${p.logo ? " has-logo" : ""}">${mark}</div>
        <div class="partner-meta">
          <span class="partner-name">${escapeHtml(p.name)}</span>
          <span class="partner-type" data-i18n="${escapeHtml(p.type)}"></span>
        </div>`;
      const cls = `card partner reveal${p.placeholder ? " is-placeholder" : ""}`;
      return p.url
        ? `<li><a class="${cls}" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${inner}</a></li>`
        : `<li><div class="${cls}">${inner}</div></li>`;
    })
    .join("");
}
