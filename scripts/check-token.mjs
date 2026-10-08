/**
 * Phase 11 check: the display token never reaches the built JS.
 * - dist/config.js must not exist (config is written on the host, never shipped)
 * - no file in dist/ contains the placeholder token or the token from config.local.js
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
if (!existsSync(dist)) {
  console.log("FAIL: dist/ missing. Run npm run build first.");
  process.exit(1);
}
const needles = ["REPLACE_ON_HOST"];
if (existsSync("config.local.js")) {
  const m = /token:\s*["']([^"']+)["']|"token":\s*"([^"]+)"/.exec(readFileSync("config.local.js", "utf8"));
  if (m) needles.push(m[1] ?? m[2]);
}
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : files.push(join(d, f))));
walk(dist);
const hits = files.filter((f) => /\.(js|html|css|json|map)$/.test(f)).flatMap((f) => {
  const body = readFileSync(f, "utf8");
  return needles.filter((n) => body.includes(n)).map((n) => `${f} contains ${n === "REPLACE_ON_HOST" ? n : "the token"}`);
});
if (existsSync(join(dist, "config.js"))) hits.push("dist/config.js exists");
if (hits.length) {
  console.log(`FAIL: ${hits.join("; ")}`);
  process.exit(1);
}
console.log(`PASS: ${files.length} files in dist/, no token, no config.js`);
