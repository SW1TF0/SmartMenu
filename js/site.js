// ============================================================================
// Small shared page behaviours: scroll-reveal.
// ============================================================================

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;

  // Once a tile has arrived it drops its reveal classes, so its own hover
  // transition (the lift on cards) works again.
  const settle = (el) => {
    setTimeout(() => {
      el.classList.remove("reveal", "in");
      el.style.transitionDelay = "";
    }, 1100);
  };
  const show = (el, delay = 0) => {
    if (el.classList.contains("in") || !el.classList.contains("reveal")) return;
    if (delay) el.style.transitionDelay = `${delay}ms`;
    el.classList.add("in");
    settle(el);
  };

  if (!("IntersectionObserver" in window)) {
    els.forEach((el) => show(el));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      // Tiles that come into view together arrive one after another.
      let i = 0;
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          show(entry.target, prefersReducedMotion() ? 0 : Math.min(i++, 5) * 70);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.05, rootMargin: "0px 0px -8% 0px" }
  );
  els.forEach((el) => io.observe(el));

  // Safety net: anything already above the bottom of the screen (fast
  // scrolling, an observer quirk, a hidden tile) is shown regardless, so
  // content can never end up stuck invisible. Tiles further down still wait
  // for the visitor to scroll to them.
  const sweep = () => {
    const h = window.innerHeight;
    els.forEach((el) => {
      if (el.getBoundingClientRect().top < h) show(el);
    });
  };
  setTimeout(sweep, 1500);
  let t = 0;
  window.addEventListener(
    "scroll",
    () => {
      clearTimeout(t);
      t = setTimeout(sweep, 250);
    },
    { passive: true }
  );
}
