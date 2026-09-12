// ============================================================================
// Small shared page behaviours: scroll-reveal, hero word rotator.
// ============================================================================

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

export function initRotator(el, wordsByLang) {
  if (!el) return;
  let i = 0;
  let timer = null;
  const render = () => {
    const lang = document.documentElement.lang === "bg" ? "bg" : "en";
    const words = wordsByLang[lang] || wordsByLang.en;
    el.textContent = words[i % words.length];
  };
  const tick = () => {
    i += 1;
    render();
  };
  render();
  clearInterval(timer);
  timer = setInterval(tick, 2600);
  window.addEventListener("smkj:i18n-refresh", render);
  document.addEventListener("smkj:lang", render);
}
