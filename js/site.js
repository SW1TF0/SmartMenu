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

// Service shortcuts on the services page: the chip of the service on screen
// is marked as current, and on phones the row scrolls it into view.
export function initSectionNav(nav) {
  if (!nav || !("IntersectionObserver" in window)) return;
  const links = [...nav.querySelectorAll('a[href^="#"]')];
  const byId = new Map(links.map((a) => [a.getAttribute("href").slice(1), a]));
  const row = nav.querySelector(".chip-row");
  const setCurrent = (id) => {
    links.forEach((a) => a.removeAttribute("aria-current"));
    const a = byId.get(id);
    if (!a) return;
    a.setAttribute("aria-current", "true");
    if (row && row.scrollWidth > row.clientWidth) {
      row.scrollTo({ left: a.offsetLeft - row.clientWidth / 2 + a.offsetWidth / 2, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    }
  };
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) setCurrent(e.target.id);
      });
    },
    { rootMargin: "-45% 0px -50% 0px" }
  );
  byId.forEach((_, id) => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });
  // A thin line under the row once it is stuck under the header.
  const sentinel = document.createElement("div");
  sentinel.style.height = "1px";
  nav.before(sentinel);
  new IntersectionObserver(([e]) => nav.classList.toggle("is-stuck", !e.isIntersecting && e.boundingClientRect.top < 0)).observe(sentinel);
}
