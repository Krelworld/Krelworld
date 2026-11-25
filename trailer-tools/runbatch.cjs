// node runbatch.cjs batch.json [only1,only2]  -> runs cap.cjs for each {name: spec} sequentially
const fs = require("fs"); const { spawnSync } = require("child_process");
const B = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const only = process.argv[3] ? process.argv[3].split(",") : null;
for (const [name, spec] of Object.entries(B)) {
  if (only && !only.includes(name)) continue;
  const f = `${__dirname}/specs/${name}.json`; fs.mkdirSync(`${__dirname}/specs`, { recursive: true });
  fs.writeFileSync(f, JSON.stringify(spec));
  const t = Date.now();
  const r = spawnSync("node", [`${__dirname}/cap.cjs`, name, f], { encoding: "utf8", timeout: 120 * 60 * 1000 });
  console.log(`[${name}] ${((Date.now() - t) / 1000).toFixed(0)}s`, (r.stdout || "").trim().split("\n").slice(-6).join(" / "), (r.stderr || "").slice(-300));
}
