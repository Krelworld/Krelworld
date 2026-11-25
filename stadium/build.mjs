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
