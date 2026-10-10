// ============================================================================
// Partners shown on the home page ("Trusted by" section).
//
// PLACEHOLDERS: every entry below with `placeholder: true` is a stand-in until
// the real partner list is confirmed. To add a real partner, replace an entry:
//   name   — the partner's name, shown as written (not translated)
//   type   — an i18n key for the small label under the name; add new keys to
//            the "partners.type.*" entries in index.html (EN + BG)
//   logo   — optional path to a logo, e.g. "img/partners/acme.svg". SVG or a
//            transparent PNG works best; it is shown in monochrome and gets
//            its own colours back on hover. Without a logo, the initials are
//            drawn in the dot-matrix font instead.
//   url    — optional link to the partner's site (opens in a new tab)
// Delete the `placeholder` flag once an entry is real. Placeholder tiles get a
// dashed outline so they're easy to spot in a preview.
// ============================================================================

import { escapeHtml } from "./i18n.js";

export const PARTNERS = [
  { name: "Partner One", type: "partners.type.restaurant", logo: "", url: "", placeholder: true },
  { name: "Partner Two", type: "partners.type.supplier", logo: "", url: "", placeholder: true },
  { name: "Partner Three", type: "partners.type.business", logo: "", url: "", placeholder: true },
  { name: "Partner Four", type: "partners.type.restaurant", logo: "", url: "", placeholder: true },
  { name: "Partner Five", type: "partners.type.supplier", logo: "", url: "", placeholder: true },
  { name: "Partner Six", type: "partners.type.business", logo: "", url: "", placeholder: true },
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
        <div class="partner-mark">${mark}</div>
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
