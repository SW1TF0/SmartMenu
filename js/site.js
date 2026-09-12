// ============================================================================
// Small shared page behaviours: scroll-reveal, hero word rotator.
// ============================================================================

export function initReveal() {
  const els = document.querySelectorAll(".reveal");
  if (!("IntersectionObserver" in window) || !els.length) {
    els.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          io.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );
  els.forEach((el) => io.observe(el));
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
