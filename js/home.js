// ============================================================================
// index.html page behaviour: the hero's LED matrix + typewriter headline
// (kept in sync — each audience word shows the service built for it) and the
// animated stat counters.
// ============================================================================
import { initReveal, typeInto, prefersReducedMotion } from "./site.js";
import { createGlyphMatrix, mountDotIcons } from "./dots.js";
import { getLang, t } from "./i18n.js";

initReveal();
mountDotIcons();

const SEQUENCE = [
  { icon: "menu", svc: "menu", en: "restaurants.", bg: "ресторанти." },
  { icon: "smarthome", svc: "smarthome", en: "your home.", bg: "вашия дом." },
  { icon: "cameras", svc: "cameras", en: "your business.", bg: "вашия бизнес." },
  { icon: "pc", svc: "pc", en: "your office.", bg: "вашия офис." },
  { icon: "print3d", svc: "print3d", en: "your workshop.", bg: "вашето ателие." },
  { icon: "web", svc: "web", en: "your brand.", bg: "вашата марка." },
];
const INTERVAL = 3800;

const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="6" width="3.4" height="12" rx="1" fill="currentColor"/><rect x="13.6" y="6" width="3.4" height="12" rx="1" fill="currentColor"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.8v12.4L18.6 12z" fill="currentColor"/></svg>';

const rotator = document.getElementById("heroRotator");
const canvas = document.getElementById("glyphMatrix");
const device = document.querySelector(".device");
const label = document.getElementById("glyphLabel");
const link = document.getElementById("glyphLink");
const count = document.getElementById("glyphCount");
const pauseBtn = document.getElementById("glyphPause");
const nextBtn = document.getElementById("glyphNext");

const matrix = canvas ? createGlyphMatrix(canvas) : null;
const pad = (n) => String(n).padStart(2, "0");
let index = 0;
let timer = null;
let hovering = false;
let playing = !prefersReducedMotion();

function render(i, { animate = true } = {}) {
  const item = SEQUENCE[i];
  const word = item[getLang() === "bg" ? "bg" : "en"];
  if (matrix) matrix.show(item.icon, { instant: !animate });
  if (rotator) {
    if (animate) typeInto(rotator, word);
    else {
      rotator._typeToken = (rotator._typeToken || 0) + 1;
      rotator.textContent = word;
    }
  }
  if (label) {
    label.setAttribute("data-i18n", `svc.${item.svc}`);
    label.textContent = t(`svc.${item.svc}`);
  }
  if (link) link.setAttribute("href", `services.html#${item.svc}`);
  if (count) count.textContent = `${pad(i + 1)}/${pad(SEQUENCE.length)}`;
}

function go(step) {
  index = (index + step + SEQUENCE.length) % SEQUENCE.length;
  render(index);
}

function schedule() {
  clearInterval(timer);
  if (!playing) return;
  timer = setInterval(() => {
    if (!hovering && !document.hidden) go(1);
  }, INTERVAL);
}

function syncPause() {
  if (!pauseBtn) return;
  pauseBtn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY;
  pauseBtn.setAttribute("aria-label", t(playing ? "hero.matrix.pause" : "hero.matrix.play"));
}

if (canvas) {
  canvas.addEventListener("click", () => {
    go(1);
    schedule();
  });
}
if (device) {
  device.addEventListener("pointerenter", (e) => {
    if (e.pointerType === "mouse") hovering = true;
  });
  device.addEventListener("pointerleave", () => (hovering = false));
}
if (nextBtn) {
  nextBtn.addEventListener("click", () => {
    go(1);
    schedule();
  });
}
if (pauseBtn) {
  pauseBtn.addEventListener("click", () => {
    playing = !playing;
    syncPause();
    schedule();
  });
}
document.addEventListener("smkj:lang", () => {
  render(index, { animate: false });
  syncPause();
});

render(0, { animate: false });
syncPause();
schedule();

// ---------------------------------------------------------- stat counters --
function animateCount(el) {
  const target = parseFloat(el.getAttribute("data-count"));
  const suffix = el.getAttribute("data-suffix") || "";
  if (prefersReducedMotion()) {
    el.textContent = target + suffix;
    return;
  }
  const dur = 1400;
  const start = performance.now();
  function step(now) {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const counters = document.querySelectorAll("[data-count]");
if (counters.length && "IntersectionObserver" in window && !prefersReducedMotion()) {
  counters.forEach((c) => (c.textContent = "0" + (c.getAttribute("data-suffix") || "")));
  const io = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          animateCount(entry.target);
          obs.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.4 }
  );
  counters.forEach((c) => io.observe(c));
}
