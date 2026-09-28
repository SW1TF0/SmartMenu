// ============================================================================
// Dot-matrix pictograms + the circular LED matrix used in the home hero.
//
// Every pictogram is a 15×15 bitmap: "#" = lit dot, "r" = lit red dot,
// anything else = unlit. mountDotIcons() renders [data-dot-icon="name"]
// elements as SVG; createGlyphMatrix() drives a <canvas> with a round
// 25×25 LED matrix that can morph between pictograms.
// ============================================================================

export const ICONS = {
  web: [
    "...............",
    "###############",
    "#.r.#.#.......#",
    "###############",
    "#.............#",
    "#.............#",
    "#...#...#.#...#",
    "#..#....#..#..#",
    "#.#....#....#.#",
    "#..#..#....#..#",
    "#...#.#...#...#",
    "#.............#",
    "#.............#",
    "###############",
    "...............",
  ],
  print3d: [
    "......###......",
    "....##...##....",
    "..##.......##..",
    "##.....r.....##",
    "#.##.......##.#",
    "#...##...##...#",
    "#.....###.....#",
    "#......#......#",
    "#......#......#",
    "#......#......#",
    "#......#......#",
    "##.....#.....##",
    "..##...#...##..",
    "....##.#.##....",
    "......###......",
  ],
  smarthome: [
    "...............",
    ".......#.......",
    "......#.#......",
    ".....#...#.....",
    "....#.....#....",
    "...#.......#...",
    "..#.........#..",
    ".#...........#.",
    "#.#.........#.#",
    "..#..#####..#..",
    "..#.#.....#.#..",
    "..#...###...#..",
    "..#.........#..",
    "..#....r....#..",
    "..###########..",
  ],
  cameras: [
    "...............",
    "...............",
    "...............",
    ".#########.....",
    "#.........#..##",
    "#.r.......#.#.#",
    "#.........##..#",
    "#.........#...#",
    "#.........##..#",
    "#.........#.#.#",
    "#.........#..##",
    ".#########.....",
    "...............",
    "...............",
    "...............",
  ],
  menu: [
    "#####.#.#.#####",
    "#...#..#..#...#",
    "#.#.#.#.#.#.#.#",
    "#...#.##..#...#",
    "#####.#.#.#####",
    ".......#.......",
    "#.##.#.#.##.#.#",
    "..#..##...#..#.",
    "##.#...#.#.##..",
    ".......#.#..#.#",
    "#####.##..#.#..",
    "#...#..#.##..##",
    "#.#.#.#...#.r..",
    "#...#..##.#.#.#",
    "#####.#..#..#.#",
  ],
  pc: [
    "...#########...",
    "...#.......#...",
    "...#.......#...",
    ".#############.",
    "#.............#",
    "#.........r...#",
    "#.............#",
    "#..#########..#",
    "#..#.......#..#",
    "####.......####",
    "...#.#####.#...",
    "...#.......#...",
    "...#.####..#...",
    "...#.......#...",
    "...#########...",
  ],
  answers: [
    "...............",
    "...............",
    ".#############.",
    "#.............#",
    "#..#########..#",
    "#.............#",
    "#..######.....#",
    "#.............#",
    ".######.######.",
    "......#.#......",
    ".......#.......",
    "...............",
    "...............",
    "...............",
    "...............",
  ],
  quotes: [
    "...............",
    ".........####..",
    "........####...",
    ".......####....",
    "......####.....",
    ".....####......",
    "....#########..",
    "...#########...",
    ".......####....",
    "......####.....",
    ".....####......",
    "....###........",
    "...##..........",
    "..#............",
    "...............",
  ],
  support: [
    ".....#####.....",
    "...##.....##...",
    "..#.........#..",
    ".#...........#.",
    ".#.........#.#.",
    "#.........#...#",
    "#........#....#",
    "#..#....#.....#",
    "#...#..#......#",
    "#....##.......#",
    ".#...........#.",
    ".#...........#.",
    "..#.........#..",
    "...##.....##...",
    ".....#####.....",
  ],
};

const SIZE = 15;
const DOT_R = 0.36;

function circlesPath(points) {
  return points
    .map(([x, y]) => `M${x + 0.5 - DOT_R} ${y + 0.5}a${DOT_R} ${DOT_R} 0 1 0 ${DOT_R * 2} 0a${DOT_R} ${DOT_R} 0 1 0 ${-DOT_R * 2} 0`)
    .join("");
}

export function dotIconSVG(name) {
  const rows = ICONS[name];
  if (!rows) return "";
  const on = [];
  const red = [];
  const off = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < SIZE; x++) {
      const c = row[x];
      if (c === "#") on.push([x, y]);
      else if (c === "r") red.push([x, y]);
      else off.push([x, y]);
    }
  });
  return `<svg viewBox="0 0 ${SIZE} ${SIZE}" aria-hidden="true" focusable="false"><path class="d-off" d="${circlesPath(off)}"/><path class="d-on" d="${circlesPath(on)}"/><path class="d-red" d="${circlesPath(red)}"/></svg>`;
}

export function mountDotIcons(root = document) {
  root.querySelectorAll("[data-dot-icon]").forEach((el) => {
    if (el.dataset.dotMounted) return;
    el.innerHTML = dotIconSVG(el.getAttribute("data-dot-icon"));
    el.dataset.dotMounted = "1";
  });
}

// ----------------------------------------------------------------------------
// Circular LED matrix
// ----------------------------------------------------------------------------
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function createGlyphMatrix(canvas, { grid = 25 } = {}) {
  const ctx = canvas.getContext("2d");
  const mid = (grid - 1) / 2;
  const radius = grid / 2 + 0.1;
  const offset = Math.floor((grid - SIZE) / 2);
  const cells = [];
  for (let y = 0; y < grid; y++) {
    for (let x = 0; x < grid; x++) {
      const dx = x - mid;
      const dy = y - mid;
      if (dx * dx + dy * dy <= radius * radius) {
        cells.push({ x, y, cur: 0, from: 0, target: 0, red: false, nextRed: false, t0: 0 });
      }
    }
  }

  let w = 0;
  let pitch = 0;
  let dpr = 1;
  let colors = { on: "#0b0b0b", off: "rgba(11,11,11,.08)", red: "#d71921", glow: false };
  let pointer = { x: -99, y: -99, active: false };
  let visible = true;
  let raf = 0;
  let animatingUntil = 0;
  const DUR = 260;

  function readColors() {
    const cs = getComputedStyle(canvas);
    const get = (name, fallback) => cs.getPropertyValue(name).trim() || fallback;
    colors = {
      on: get("--matrix-on", "#0b0b0b"),
      off: get("--matrix-off", "rgba(11,11,11,.08)"),
      red: get("--red", "#d71921"),
      glow: get("--matrix-glow", "0") === "1",
    };
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(w * dpr);
    pitch = w / grid;
    draw(performance.now());
  }

  function show(name, { instant = false } = {}) {
    const rows = ICONS[name];
    if (!rows) return;
    const now = performance.now();
    const quick = instant || reducedMotion();
    let latest = now;
    cells.forEach((c) => {
      const ix = c.x - offset;
      const iy = c.y - offset;
      const ch = ix >= 0 && iy >= 0 && ix < SIZE && iy < SIZE ? rows[iy][ix] : ".";
      const target = ch === "#" || ch === "r" ? 1 : 0;
      c.nextRed = ch === "r";
      if (quick) {
        c.cur = c.from = c.target = target;
        c.red = c.nextRed;
        c.t0 = now;
        return;
      }
      const dist = Math.hypot(c.x - mid, c.y - mid);
      c.from = c.cur;
      c.target = target;
      c.t0 = now + dist * 22 + Math.random() * 90;
      latest = Math.max(latest, c.t0 + DUR);
    });
    animatingUntil = quick ? 0 : latest;
    if (quick) draw(now);
    else loop();
  }

  function ease(p) {
    return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  }

  function draw(now) {
    if (!w) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, w);
    const r = pitch * 0.34;

    ctx.fillStyle = colors.off;
    ctx.beginPath();
    cells.forEach((c) => {
      ctx.moveTo(c.x * pitch + pitch / 2 + r, c.y * pitch + pitch / 2);
      ctx.arc(c.x * pitch + pitch / 2, c.y * pitch + pitch / 2, r, 0, Math.PI * 2);
    });
    ctx.fill();

    const pulse = reducedMotion() ? 1 : 0.72 + 0.28 * Math.sin(now / 420);
    cells.forEach((c) => {
      if (now >= c.t0) {
        const p = Math.min(1, (now - c.t0) / DUR);
        c.cur = c.from + (c.target - c.from) * ease(p);
        if (p >= 0.5) c.red = c.nextRed;
      }
      let b = c.cur;
      if (pointer.active) {
        const d = Math.hypot(c.x - pointer.x, c.y - pointer.y);
        b = Math.max(b, Math.max(0, 1 - d / 3.2) * 0.5);
      }
      if (b <= 0.01) return;
      const cx = c.x * pitch + pitch / 2;
      const cy = c.y * pitch + pitch / 2;
      const isRed = c.red && c.cur > 0.5;
      ctx.globalAlpha = Math.min(1, b) * (isRed ? pulse : 1);
      ctx.fillStyle = isRed ? colors.red : colors.on;
      if (colors.glow) {
        ctx.shadowColor = isRed ? colors.red : colors.on;
        ctx.shadowBlur = r * 1.6;
      }
      ctx.beginPath();
      ctx.arc(cx, cy, r * (0.82 + 0.18 * Math.min(1, b)), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  function needsFrames(now) {
    if (!visible) return false;
    if (now < animatingUntil || pointer.active) return true;
    return !reducedMotion() && cells.some((c) => c.red && c.cur > 0.5);
  }

  function loop() {
    if (raf) return;
    const tick = (now) => {
      raf = 0;
      draw(now);
      if (needsFrames(now)) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function pointerAt(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * grid - 0.5;
    pointer.y = ((e.clientY - rect.top) / rect.height) * grid - 0.5;
  }
  canvas.addEventListener("pointermove", (e) => {
    pointerAt(e);
    pointer.active = true;
    loop();
  });
  canvas.addEventListener("pointerleave", () => {
    pointer.active = false;
    loop();
  });

  readColors();
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas);
  else window.addEventListener("resize", resize);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible) loop();
    }).observe(canvas);
  }
  document.addEventListener("visibilitychange", () => {
    visible = !document.hidden;
    if (visible) loop();
  });
  document.addEventListener("smkj:theme", () => {
    readColors();
    draw(performance.now());
  });
  resize();

  return { show };
}
