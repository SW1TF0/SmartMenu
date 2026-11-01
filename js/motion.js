// ============================================================================
// Page-wide transitions:
//   themeTransition(update, {x, y}) — the light/dark switch. The new theme
//     grows out of the toggle as a circle (View Transitions API); browsers
//     without it get a short colour fade.
//   swapTransition(update) — the Home / Business switch. The page content
//     cross-fades to the other version while the switch's pill slides.
// Both apply the change instantly when the visitor prefers reduced motion.
// The CSS half lives in css/style.css ("Transitions").
// ============================================================================

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const canTransition = () => typeof document.startViewTransition === "function";

function run(update) {
  try {
    update();
  } catch (err) {
    console.error(err);
  }
}

let themeRun = 0;

export function themeTransition(update, { x, y } = {}) {
  const root = document.documentElement;
  if (reducedMotion()) return run(update);
  const id = ++themeRun;

  if (!canTransition()) {
    root.classList.add("theme-fade");
    run(update);
    setTimeout(() => {
      if (id === themeRun) root.classList.remove("theme-fade");
    }, 450);
    return;
  }

  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = Number.isFinite(x) ? x : w / 2;
  const cy = Number.isFinite(y) ? y : 0;
  const radius = Math.hypot(Math.max(cx, w - cx), Math.max(cy, h - cy));

  root.classList.add("vt-theme");
  const vt = document.startViewTransition(() => run(update));
  vt.ready
    .then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${cx}px ${cy}px)`, `circle(${radius}px at ${cx}px ${cy}px)`] },
        { duration: 620, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    })
    .catch(() => {});
  vt.finished
    .catch(() => {})
    .finally(() => {
      if (id === themeRun) root.classList.remove("vt-theme");
    });
}

let swapRun = 0;

export function swapTransition(update) {
  const root = document.documentElement;
  if (reducedMotion()) return run(update);
  const id = ++swapRun;

  if (canTransition()) {
    root.classList.add("vt-swap");
    const vt = document.startViewTransition(() => run(update));
    vt.finished
      .catch(() => {})
      .finally(() => {
        if (id === swapRun) root.classList.remove("vt-swap");
      });
    return;
  }

  const main = document.querySelector("main");
  if (!main) return run(update);
  main.classList.add("is-swapping");
  setTimeout(() => {
    run(update);
    requestAnimationFrame(() => {
      if (id === swapRun) main.classList.remove("is-swapping");
    });
  }, 160);
}
