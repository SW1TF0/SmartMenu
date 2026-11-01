// ============================================================================
// Stamps every local stylesheet, module script and relative import with the
// same ?v=VERSION, so after a deploy browsers fetch the new CSS/JS instead of
// mixing cached old files with the new HTML (GitHub Pages lets browsers reuse
// files for 10 minutes).
//
// Run after changing anything in css/ or js/:
//   node tools/stamp-version.mjs            (VERSION = today, e.g. 20261101)
//   node tools/stamp-version.mjs 20261101b  (or pick one)
//   node tools/build-langs.mjs              (copies it into bg/ and tr/)
//
// Every reference must carry the same version: a module imported under two
// different URLs loads twice (Firebase would initialise twice).
// tools/build-langs.mjs refuses to build when they don't match.
// ============================================================================
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// href="css/style.css", src="js/home.js", from "./js/chrome.js",
// from "./i18n.js", import("./auth.js") — with or without an old ?v=.
export const ASSET_REF = /((?:\s(?:href|src)=|\bfrom\s+|\bimport\(\s*)")((?:\.\.?\/)*(?:(?:css|js)\/)?[\w-]+\.(?:css|js))(\?v=[^"]*)?"/g;

export function sourceFiles() {
  return [
    ...readdirSync(ROOT).filter((f) => f.endsWith(".html")),
    ...readdirSync(join(ROOT, "js"))
      .filter((f) => f.endsWith(".js"))
      .map((f) => `js/${f}`),
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = process.argv[2] || new Date().toISOString().slice(0, 10).replace(/-/g, "");
  if (!/^[\w.-]+$/.test(version)) {
    console.error(`Not a usable version: ${version}`);
    process.exit(1);
  }
  let changed = 0;
  for (const file of sourceFiles()) {
    const path = join(ROOT, file);
    const before = readFileSync(path, "utf8");
    const after = before.replace(ASSET_REF, (_, lead, url) => `${lead}${url}?v=${version}"`);
    if (after !== before) {
      writeFileSync(path, after);
      changed++;
    }
  }
  console.log(`Stamped ?v=${version} in ${changed} files. Now run: node tools/build-langs.mjs`);
}
