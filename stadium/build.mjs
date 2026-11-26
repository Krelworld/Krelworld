import { build } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

writeFileSync("assets/world/eight.json", JSON.stringify(readdirSync("assets/world").filter((f) => f.endsWith("-8.png")).map((f) => f.replace("-8.png", ""))));
// Which extra animation sheets exist for each character base (fan-punch.png and so on).
{
  const extras = {};
  for (const f of readdirSync("assets/art")) {
    const m = f.match(/^([a-z]+)-([a-z]+)\.png$/);
    if (m && !f.startsWith("tiles")) (extras[m[1]] ??= []).push(m[2]);
  }
  writeFileSync("assets/art/extras.json", JSON.stringify(extras));
}
mkdirSync("dist/viewer", { recursive: true });
await build({
  entryPoints: ["src/view/main.ts"], bundle: true, minify: true, format: "iife",
  outfile: "dist/viewer/game.js", logLevel: "error",
});
copyFileSync("src/view/index.html", "dist/viewer/index.html");
// A complete page for opening locally (the published page gets its wrapper from the host).
writeFileSync(
  "dist/viewer/local.html",
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">' +
    readFileSync("src/view/index.html", "utf8") + "</body></html>",
);
console.log("built dist/viewer");

rmSync("dist/stadium", { recursive: true, force: true });
mkdirSync("dist/stadium", { recursive: true });
await build({
  entryPoints: ["src/view/stadium.ts"], bundle: true, minify: true, format: "iife",
  outfile: "dist/stadium/game.js", logLevel: "error",
});
copyFileSync("src/view/stadium.html", "dist/stadium/index.html");
writeFileSync(
  "dist/stadium/local.html",
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">' +
    readFileSync("src/view/stadium.html", "utf8") + "</body></html>",
);
import { cpSync } from "node:fs";
cpSync("assets/audio", "dist/stadium/audio", { recursive: true });
mkdirSync("dist/stadium/art", { recursive: true });
for (const f of readdirSync("assets/art")) if (/^[a-z]+-[a-z0-9]+\.png$/.test(f) && !f.startsWith("tiles")) copyFileSync(`assets/art/${f}`, `dist/stadium/art/${f}`);
for (const t of ["street", "pitch"]) copyFileSync(`assets/art/tiles-${t}.png`, `dist/stadium/art/tiles-${t}.png`);
mkdirSync("dist/stadium/icons", { recursive: true });
for (const f of readdirSync("assets/icons")) if (f.endsWith(".png")) copyFileSync(`assets/icons/${f}`, `dist/stadium/icons/${f}`);
mkdirSync("dist/stadium/world", { recursive: true });
for (const f of readdirSync("assets/world")) if (f.endsWith("-8.png") || f.startsWith("bld-") || f.startsWith("fx-")) copyFileSync(`assets/world/${f}`, `dist/stadium/world/${f}`);
writeFileSync("assets/world/eight.json", JSON.stringify(readdirSync("assets/world").filter((f) => f.endsWith("-8.png")).map((f) => f.replace("-8.png", ""))));
for (const d of ["kit", "tiles", "scenes"]) {
  mkdirSync(`dist/stadium/${d}`, { recursive: true });
  for (const f of readdirSync(`assets/${d}`)) if (f.endsWith(".png")) copyFileSync(`assets/${d}/${f}`, `dist/stadium/${d}/${f}`);
}
// Pack the assets into three bundles (art, audio, the rest) plus an index, so the published page
// is a handful of files rather than five hundred. The loose files stay for local development.
{
  const groups = { art: ["art"], audio: ["audio"], misc: ["icons", "kit", "tiles", "scenes", "world"] };
  const MIME = { ".png": "image/png", ".mp3": "audio/mpeg" };
  const index = { packs: {}, files: {} };
  mkdirSync("dist/stadium/packs", { recursive: true });
  for (const [name, dirs] of Object.entries(groups)) {
    const parts = [];
    let off = 0;
    for (const d of dirs) for (const f of readdirSync(`dist/stadium/${d}`).sort()) {
      const ext = f.slice(f.lastIndexOf("."));
      if (!MIME[ext]) continue;
      const b = readFileSync(`dist/stadium/${d}/${f}`);
      index.files[`${d}/${f}`] = [name, off, b.length, MIME[ext]];
      parts.push(b); off += b.length;
    }
    // Served as .mp3: the host only serves known types, and the game reads these as raw bytes anyway.
    writeFileSync(`dist/stadium/packs/${name}.pack.mp3`, Buffer.concat(parts));
    index.packs[name] = off;
  }
  // A version stamp: the page asks for game.js?v=..., and the packs by the same stamp, so a phone never
  // mixes a new game with old cached art (or the other way round).
  const { createHash } = await import("node:crypto");
  const ver = createHash("sha1").update(readFileSync("dist/stadium/game.js")).update(JSON.stringify(index)).digest("hex").slice(0, 10);
  index.v = ver;
  writeFileSync("dist/stadium/packs/index.json", JSON.stringify(index));
  for (const f of ["index.html", "local.html"]) writeFileSync(`dist/stadium/${f}`, readFileSync(`dist/stadium/${f}`, "utf8").replace('<script src="game.js"></script>', `<script src="game.js?v=${ver}"></script>`));
  console.log("packed", Object.keys(index.files).length, "files:", Object.entries(index.packs).map(([k, v]) => `${k} ${(v / 1e6).toFixed(1)}MB`).join(", "));
}
console.log("built dist/stadium");

mkdirSync("dist/arttest", { recursive: true });
await build({ entryPoints: ["src/view/arttest.ts"], bundle: true, minify: true, format: "iife", outfile: "dist/arttest/game.js", logLevel: "error" });
copyFileSync("src/view/arttest.html", "dist/arttest/index.html");
writeFileSync("dist/arttest/local.html", '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">' + readFileSync("src/view/arttest.html", "utf8") + "</body></html>");
cpSync("assets/audio", "dist/arttest/audio", { recursive: true });
cpSync("assets/art", "dist/arttest/art", { recursive: true });
console.log("built dist/arttest");
