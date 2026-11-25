import { build } from "esbuild";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

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
for (const k of ["fan", "steward", "england", "portugal", "referee"]) for (const sh of ["rot", "walk"]) copyFileSync(`assets/art/${k}-${sh}.png`, `dist/stadium/art/${k}-${sh}.png`);
for (const t of ["street", "pitch"]) copyFileSync(`assets/art/tiles-${t}.png`, `dist/stadium/art/tiles-${t}.png`);
console.log("built dist/stadium");

mkdirSync("dist/arttest", { recursive: true });
await build({ entryPoints: ["src/view/arttest.ts"], bundle: true, minify: true, format: "iife", outfile: "dist/arttest/game.js", logLevel: "error" });
copyFileSync("src/view/arttest.html", "dist/arttest/index.html");
writeFileSync("dist/arttest/local.html", '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body style="margin:0">' + readFileSync("src/view/arttest.html", "utf8") + "</body></html>");
cpSync("assets/audio", "dist/arttest/audio", { recursive: true });
cpSync("assets/art", "dist/arttest/art", { recursive: true });
console.log("built dist/arttest");
