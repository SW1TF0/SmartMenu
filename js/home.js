// ============================================================================
// index.html page behaviour: hero word rotator + animated stat counters.
// ============================================================================
import { initReveal, initRotator } from "./site.js";

initReveal();
initRotator(document.getElementById("heroRotator"), {
  en: ["restaurants.", "your home.", "your business.", "your office.", "your workshop."],
  bg: ["ресторанти.", "вашия дом.", "вашия бизнес.", "вашия офис.", "вашето ателие."],
});

function animateCount(el) {
  const target = parseFloat(el.getAttribute("data-count"));
  const suffix = el.getAttribute("data-suffix") || "";
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
if (counters.length) {
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
