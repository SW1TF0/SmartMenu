// ============================================================================
// Small shared page behaviours: scroll-reveal.
// ============================================================================

export const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!els.length) return;
  const show = (el) => el.classList.add("in");

  if (!("IntersectionObserver" in window)) {
    els.forEach(show);
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          show(entry.target);
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.05, rootMargin: "0px 0px -8% 0px" }
  );
  els.forEach((el) => io.observe(el));

  // Safety net: whatever hasn't revealed itself yet (fast scrolling, an
  // observer quirk, etc.) gets shown after a short delay regardless, so
  // content can never end up permanently invisible.
  setTimeout(() => els.forEach(show), 1500);
}
