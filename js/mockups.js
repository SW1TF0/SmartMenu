// ============================================================================
// Mini screens for project tiles (home "Selected work" and portfolio.html).
//
// Each .work-screen / .proj-thumb holding a service icon gets a small,
// wordless illustration of that kind of job: a phone with a QR menu, a
// website, a four-camera view, smart-home controls, a 3D print, an office
// network. They are drawings, not screenshots of client work, so they carry
// no text. Styles: css/style.css ("Mini screens"). On phones the plain icon
// is shown instead (the tiles are too small there).
// ============================================================================

const bars = (n, cls = "") => Array.from({ length: n }, () => `<i class="mk-line ${cls}"></i>`).join("");

// A 9×9 QR-like pattern: three finder squares in the corners, a few dots.
const QR = [
  "111101111",
  "101000101",
  "111010111",
  "000101000",
  "101011010",
  "010100101",
  "111010010",
  "101001101",
  "111010110",
].join("").split("").map((c) => c === "1");

const MOCKS = {
  menu: () => `
    <div class="mk-phone">
      <i class="mk-notch"></i>
      <i class="mk-line w60 strong"></i>
      ${[1, 2, 3, 4].map(() => `<div class="mk-row"><i class="mk-thumb"></i><div class="mk-col">${bars(1, "w70")}${bars(1, "w40 faint")}</div><i class="mk-price"></i></div>`).join("")}
    </div>
    <div class="mk-qr">${QR.map((on) => `<i class="${on ? "on" : ""}"></i>`).join("")}</div>`,
  web: () => `
    <div class="mk-browser">
      <div class="mk-nav"><i class="mk-dot"></i>${bars(3, "w12 faint")}<i class="mk-pill"></i></div>
      <div class="mk-hero">${bars(1, "w55 big")}${bars(1, "w40 faint")}<i class="mk-btn"></i></div>
      <div class="mk-cards"><i></i><i></i><i></i></div>
    </div>`,
  cameras: () => `
    <div class="mk-cams">
      ${[1, 2, 3, 4].map((n) => `<div class="mk-cam mk-cam${n}"><i class="mk-rec"></i><i class="mk-time"></i></div>`).join("")}
    </div>`,
  smarthome: () => `
    <div class="mk-home">
      <div class="mk-dial"><b>21°</b></div>
      <div class="mk-tiles">
        <div class="mk-tile on"><i class="mk-ic"></i><i class="mk-switch"></i></div>
        <div class="mk-tile"><i class="mk-ic"></i><i class="mk-switch"></i></div>
        <div class="mk-tile"><i class="mk-ic"></i><i class="mk-switch"></i></div>
        <div class="mk-tile on"><i class="mk-ic"></i><i class="mk-switch"></i></div>
      </div>
    </div>`,
  print3d: () => `
    <div class="mk-print">
      <div class="mk-gantry"><i class="mk-head"></i></div>
      <div class="mk-part">${Array.from({ length: 9 }, () => "<i></i>").join("")}</div>
      <div class="mk-bed"></div>
      <div class="mk-progress"><i></i></div>
    </div>`,
  pc: () => `
    <div class="mk-net">
      <div class="mk-hub"></div>
      ${[1, 2, 3, 4, 5].map((n) => `<div class="mk-node mk-n${n}"><i class="mk-ok"></i></div>`).join("")}
      <svg class="mk-wires" viewBox="0 0 100 60" preserveAspectRatio="none" aria-hidden="true"><path d="M50 30 L14 14 M50 30 L14 46 M50 30 L86 14 M50 30 L86 46 M50 30 L50 6"/></svg>
    </div>`,
};

export function mountMockups(root = document) {
  root.querySelectorAll(".work-screen, .proj-thumb").forEach((screen) => {
    if (screen.querySelector(".mk")) return;
    const icon = screen.querySelector("[data-icon]");
    const name = icon && icon.getAttribute("data-icon");
    if (!MOCKS[name]) return;
    const mk = document.createElement("div");
    mk.className = `mk mk-${name}`;
    mk.setAttribute("aria-hidden", "true");
    mk.innerHTML = MOCKS[name]();
    screen.appendChild(mk);
    screen.classList.add("has-mock");
  });
}
