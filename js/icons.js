// ============================================================================
// App-style service icons + the cycling icon stage in the home hero.
//
// Every icon is a 24×24 line pictogram on a near-black rounded square
// (colours come from css/style.css, so dark mode inverts them). mountIcons() renders [data-icon="name"] elements;
// createIconStage() shows one large icon at a time and cross-fades between
// them.
// ============================================================================

export const ICONS = {
  web: {
    path: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 9h18M6.5 6.8h.01M9 6.8h.01M10 13l-2 2 2 2M14 13l2 2-2 2"/>',
  },
  print3d: {
    path: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  },
  smarthome: {
    path: '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.3 14.6a3.8 3.8 0 0 1 5.4 0M12 17.4h.01"/>',
  },
  cameras: {
    path: '<rect x="2.5" y="6" width="13" height="12" rx="2.5"/><path d="M15.5 10.5l6-3.5v10l-6-3.5"/><circle cx="9" cy="12" r="2.2"/>',
  },
  menu: {
    path: '<rect x="3.5" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="14" y="3.5" width="6.5" height="6.5" rx="1.5"/><rect x="3.5" y="14" width="6.5" height="6.5" rx="1.5"/><path d="M14 14h2.5v2.5H14zM20.5 14v.01M18 20.5h2.5M20.5 17.5v3"/>',
  },
  pc: {
    path: '<rect x="2.5" y="4" width="19" height="12.5" rx="2"/><path d="M8.5 20.5h7M12 16.5v4"/>',
  },
  answers: {
    path: '<path d="M4 5.5h16v10.5H9.5L5 20v-4H4z"/><path d="M8 9.5h8M8 12.5h5"/>',
  },
  quotes: {
    path: '<path d="M6 3h8.5L19 7.5V21H6z"/><path d="M14 3v5h5M9 12.5h7M9 16h5"/>',
  },
  support: {
    path: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/><path d="M6 6l3.5 3.5M14.5 14.5L18 18M18 6l-3.5 3.5M9.5 14.5L6 18"/>',
  },
};

export function iconSVG(name) {
  const icon = ICONS[name];
  if (!icon) return "";
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icon.path}</svg>`;
}

// Turns an element into the badge for `name`.
export function paintIcon(el, name) {
  if (!ICONS[name]) return;
  el.classList.add("icon-badge");
  el.innerHTML = iconSVG(name);
}

export function mountIcons(root = document) {
  root.querySelectorAll("[data-icon]").forEach((el) => {
    if (el.dataset.iconMounted) return;
    paintIcon(el, el.getAttribute("data-icon"));
    el.dataset.iconMounted = "1";
  });
}

// ----------------------------------------------------------------------------
// Icon stage: one large icon, cross-fading to the next on show().
// ----------------------------------------------------------------------------
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createIconStage(el) {
  let current = null;

  function show(name, { instant = false } = {}) {
    if (!ICONS[name]) return;
    const next = document.createElement("span");
    paintIcon(next, name);
    const quick = instant || reducedMotion() || !current;
    if (!quick) next.classList.add("is-in");
    el.appendChild(next);
    const old = current;
    current = next;
    if (old) {
      if (quick) old.remove();
      else {
        old.classList.add("is-out");
        setTimeout(() => old.remove(), 600);
      }
    }
    if (!quick) requestAnimationFrame(() => requestAnimationFrame(() => next.classList.remove("is-in")));
  }

  return { show };
}
