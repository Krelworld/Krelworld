// Builds the 3D miniature feasibility test (vistest/) into vistest/dist: one page, one script, a handful of sprite sheets.
//   node tools/build-vistest.mjs
import { build } from "esbuild";
import { copyFileSync, mkdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "vistest"), out = join(src, "dist");
rmSync(out, { recursive: true, force: true });
mkdirSync(join(out, "art"), { recursive: true });

await build({
  entryPoints: [join(src, "src/main.ts")], bundle: true, minify: true, format: "iife", target: "es2020",
  outfile: join(out, "app.js"), logLevel: "error", legalComments: "none",
});
copyFileSync(join(src, "index.html"), join(out, "index.html"));

// The cast: the game's own sheets, copied next to the page so it is self-contained.
const SHEETS = {
  grozzhd: ["rot", "walk", "idle"], ronson: ["rot", "walk", "run"], fan: ["rot", "idle"], bigman: ["rot", "drink"],
  lad: ["rot", "chat"], woman: ["rot", "chat"], oldboy: ["rot", "walk"],
};
let bytes = 0;
for (const [base, names] of Object.entries(SHEETS)) for (const n of names) {
  const f = `${base}-${n}.png`;
  copyFileSync(join(root, "assets/art", f), join(out, "art", f));
  bytes += statSync(join(out, "art", f)).size;
}
console.log(`built vistest/dist  (app.js ${(statSync(join(out, "app.js")).size / 1024).toFixed(0)} kB, sprites ${(bytes / 1024).toFixed(0)} kB)`);
