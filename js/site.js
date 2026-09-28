// ============================================================================
// Small shared page behaviours: scroll-reveal and a typewriter text swap.
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

// Deletes the current text character by character, then types the new text.
// A newer call on the same element cancels an older one mid-way.
export function typeInto(el, text, { erase = 22, type = 52 } = {}) {
  if (!el) return Promise.resolve();
  const token = (el._typeToken = (el._typeToken || 0) + 1);
  if (prefersReducedMotion()) {
    el.textContent = text;
    return Promise.resolve();
  }
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  return (async () => {
    const current = el.textContent;
    for (let i = current.length; i >= 0; i--) {
      if (el._typeToken !== token) return;
      el.textContent = current.slice(0, i);
      await wait(erase);
    }
    for (let i = 1; i <= text.length; i++) {
      if (el._typeToken !== token) return;
      el.textContent = text.slice(0, i);
      await wait(type);
    }
  })();
}
