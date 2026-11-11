// ============================================================================
// index.html page behaviour: the hero's service showcase (it cycles through
// the services shown to the current audience, in their order) and the
// animated stat counters.
// ============================================================================
import { initReveal, prefersReducedMotion } from "./site.js?v=20261111c";
import { createIconStage, mountIcons } from "./icons.js?v=20261111c";
import { getAudience, t } from "./i18n.js?v=20261111c";

initReveal();
mountIcons();

const INTERVAL = 3800;

const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="6" width="3.4" height="12" rx="1" fill="currentColor"/><rect x="13.6" y="6" width="3.4" height="12" rx="1" fill="currentColor"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 5.8v12.4L18.6 12z" fill="currentColor"/></svg>';

const stageEl = document.getElementById("iconStage");
const device = document.querySelector(".device");
const list = document.getElementById("deviceList");
const label = document.getElementById("glyphLabel");
const link = document.getElementById("glyphLink");
const count = document.getElementById("glyphCount");
const pauseBtn = document.getElementById("glyphPause");
const nextBtn = document.getElementById("glyphNext");

const stage = stageEl ? createIconStage(stageEl) : null;
const pad = (n) => String(n).padStart(2, "0");
let items = [];
let index = 0;
let timer = null;
let hovering = false;
let playing = !prefersReducedMotion();

// The list entries for the current audience, in their current order.
function visibleItems() {
  if (!list) return [];
  const audience = getAudience();
  return [...list.querySelectorAll("li[data-svc]")].filter((li) => {
    const only = li.getAttribute("data-for");
    return !only || only === audience;
  });
}

function render(i, { animate = true } = {}) {
  const item = items[i];
  if (!item) return;
  const svc = item.getAttribute("data-svc");
  if (stage) stage.show(svc, { instant: !animate });
  list.querySelectorAll("li[data-svc] button").forEach((btn) => btn.setAttribute("aria-current", btn.closest("li") === item ? "true" : "false"));
  if (label) {
    label.setAttribute("data-i18n", `svc.${svc}`);
    label.textContent = t(`svc.${svc}`);
  }
  if (link) link.setAttribute("href", `services.html#${svc}`);
  if (count) count.textContent = `${pad(i + 1)}/${pad(items.length)}`;
}

function go(step) {
  if (!items.length) return;
  index = (index + step + items.length) % items.length;
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

// Starts again from the first service (after the Home / Business switch).
function restart() {
  items = visibleItems();
  index = 0;
  render(0, { animate: false });
  schedule();
}

if (list) {
  list.addEventListener("click", (e) => {
    const item = e.target.closest("li[data-svc]");
    const at = items.indexOf(item);
    if (at < 0) return;
    index = at;
    render(index);
    schedule();
  });
}
if (stageEl) {
  stageEl.addEventListener("click", () => {
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
document.addEventListener("smkj:audience", restart);

restart();
syncPause();

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

// ------------------------------------------------------ FAQ rich results --
// Google can show the FAQ answers right in search results. The questions are
// read from the page itself, so every language gets its own copy.
const faq = document.querySelectorAll("#faq details");
if (faq.length) {
  const ld = document.createElement("script");
  ld.type = "application/ld+json";
  ld.textContent = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [...faq].map((d) => ({
      "@type": "Question",
      name: d.querySelector("summary").textContent.trim(),
      acceptedAnswer: { "@type": "Answer", text: d.querySelector("p").textContent.trim() },
    })),
  });
  document.head.appendChild(ld);
}
