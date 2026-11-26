import { build } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

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
for (const f of readdirSync("assets/art")) if (/^[a-z]+-[a-z]+\.png$/.test(f) && !f.startsWith("tiles")) copyFileSync(`assets/art/${f}`, `dist/stadium/art/${f}`);
for (const t of ["street", "pitch"]) copyFileSync(`assets/art/tiles-${t}.png`, `dist/stadium/art/tiles-${t}.png`);
mkdirSync("dist/stadium/icons", { recursive: true });
for (const f of readdirSync("assets/icons")) if (f.endsWith(".png")) copyFileSync(`assets/icons/${f}`, `dist/stadium/icons/${f}`);
mkdirSync("dist/stadium/world", { recursive: true });
for (const f of readdirSync("assets/world")) if (f.endsWith("-8.png")) copyFileSync(`assets/world/${f}`, `dist/stadium/world/${f}`);
writeFileSync("assets/world/eight.json", JSON.stringify(readdirSync("assets/world").filter((f) => f.endsWith("-8.png")).map((f) => f.replace("-8.png", ""))));
for (const d of ["kit", "tiles", "scenes"]) {
  mkdirSync(`dist/stadium/${d}`, { recursive: true });
  for (const f of readdirSync(`assets/${d}`)) if (f.endsWith(".png")) copyFileSync(`assets/${d}/${f}`, `dist/stadium/${d}/${f}`);
}
console.log("built dist/stadium");

mkdirSync("dist/arttest", { recursive: true });
await build({ entryPoints: ["src/view/arttest.ts"], bundle: true, minify: true, format: "iife", outfile: "dist/arttest/game.js", logLevel: "error" });
copyFileSync("src/view/arttest.html", "dist/arttest/index.html");
writeFileSync("dist/arttest/local.html", '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">' + readFileSync("src/view/arttest.html", "utf8") + "</body></html>");
cpSync("assets/audio", "dist/arttest/audio", { recursive: true });
cpSync("assets/art", "dist/arttest/art", { recursive: true });
console.log("built dist/arttest");
