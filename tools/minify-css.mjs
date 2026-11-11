// Minifies css/*.css in place for the deploy (the deploy workflow runs it on its
// own checkout; the files in the repo stay readable). Only safe steps: comments,
// indentation and line breaks, and the spaces next to { } ; — strings and url()
// are copied as they are, so the result renders exactly like the source.
//
//   node tools/minify-css.mjs            (only in .github/workflows/deploy.yml)
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const CSS = join(dirname(fileURLToPath(import.meta.url)), "..", "css");

export function minifyCss(src) {
  // One pass that skips strings and url(...): only whitespace and comments outside them change.
  let out = "";
  let i = 0;
  const n = src.length;
  const space = (c) => c === " " || c === "\n" || c === "\t" || c === "\r";
  while (i < n) {
    const c = src[i];
    if (c === "/" && src[i + 1] === "*") {
      const e = src.indexOf("*/", i + 2);
      if (e < 0) throw new Error("unclosed comment");
      i = e + 2;
      continue;
    }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && src[j] !== c) j += src[j] === "\\" ? 2 : 1;
      out += src.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    if (src.startsWith("url(", i)) {
      const e = src.indexOf(")", i);
      out += src.slice(i, e + 1);
      i = e + 1;
      continue;
    }
    if (space(c)) {
      let j = i;
      let newline = false;
      while (j < n && (space(src[j]) || (src[j] === "/" && src[j + 1] === "*"))) {
        if (src[j] === "/") { j = src.indexOf("*/", j + 2) + 2; continue; }
        if (src[j] === "\n") newline = true;
        j++;
      }
      const prev = out[out.length - 1];
      const next = src[j];
      // No space is needed after { } ; or before { } ; — anywhere else one stays.
      if (out && j < n && !"{};".includes(prev) && !"{};".includes(next)) out += newline ? "\n" : " ";
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return out.trim() + "\n";
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const f of readdirSync(CSS).filter((x) => x.endsWith(".css"))) {
    const path = join(CSS, f);
    const before = readFileSync(path, "utf8");
    const after = minifyCss(before);
    writeFileSync(path, after);
    console.log(`${f}: ${Math.round(before.length / 1024)} KB -> ${Math.round(after.length / 1024)} KB`);
  }
}
