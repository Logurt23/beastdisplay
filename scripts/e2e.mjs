/**
 * Browser checks for Phases 2, 3, 5, 6, 10, 11 and 12, against the built app
 * (vite preview) and the local fixture Nexus. Writes screenshots to artifacts/.
 *
 *   npm run build && npm run check:e2e
 *
 * Chromium: CHROMIUM_PATH, else Playwright's bundled browser.
 */
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { chromium } from "playwright-core";

const APP = "http://127.0.0.1:4173";
const NEXUS = "http://127.0.0.1:8787";
const OUT = "artifacts";
mkdirSync(OUT, { recursive: true });

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const hadLocal = existsSync("config.local.js");
const savedLocal = hadLocal ? readFileSync("config.local.js", "utf8") : null;
function writeConfig(over = {}, emm = {}) {
  const cfg = {
    displayId: "office-main",
    theme: "night",
    clock: { show: true, timeZone: "America/Chicago" },
    safeAreaPx: 48,
    reloadHours: 6,
    lobbyMode: false,
    defaultTarget: { kind: "function", fn: "emm", layout: "warroom" },
    allowlist: [
      { origin: NEXUS, frame: true },
      { origin: "http://localhost:8787", frame: false },
    ],
    targets: [],
    rotateSeconds: 0,
    functions: { emm: { enabled: true, nexusUrl: NEXUS, token: "dev-token", pollSeconds: 2, timeoutMs: 1500, developers: ["Logan", "Michael"], intro: false, ...emm } },
    ...over,
  };
  writeFileSync("config.local.js", `window.BEASTDISPLAY_CONFIG = ${JSON.stringify(cfg, null, 2)};\n`);
}

const procs = [];
function start(cmd, args, env = {}) {
  const p = spawn(cmd, args, { env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"] });
  procs.push(p);
  return p;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function waitFor(url) {
  for (let i = 0; i < 100; i++) {
    try {
      await fetch(url);
      return;
    } catch {
      await sleep(100);
    }
  }
  throw new Error(`timeout waiting for ${url}`);
}
const mode = (m) => fetch(`${NEXUS}/__dev/mode?m=${m}`, { method: "POST" });

async function main() {
  writeConfig();
  start("node", ["nexus-display/dev-server.mjs"], { RATE_LIMIT: "10000", QUIET: "1", ALLOWED_ORIGINS: APP });
  // Production CSP shape, with the local Nexus in place of nexus.emmadvertising.com.
  const csp = `default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self' ${NEXUS}; frame-src 'self' ${NEXUS}; base-uri 'none'; form-action 'none'`;
  start("npx", ["vite", "preview", "--host", "127.0.0.1", "--port", "4173", "--strictPort"], { BD_CSP: csp });
  await waitFor(`${NEXUS}/__nope`);
  await waitFor(`${APP}/`);

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
  });

  async function openPage(viewport, url = "/", opts = {}) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ...opts });
    const page = await context.newPage();
    const errors = [];
    const hosts = new Set();
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("request", (r) => hosts.add(new URL(r.url()).host));
    await page.goto(`${APP}${url}`);
    return { context, page, errors, hosts };
  }

  const noScroll = (page) =>
    page.evaluate(() => {
      const el = document.scrollingElement;
      return el.scrollHeight <= window.innerHeight && el.scrollWidth <= window.innerWidth;
    });

  // Phase 5: EMM board at 1080p and 4K, no console errors, no document scroll.
  for (const [name, viewport] of [
    ["1080p", { width: 1920, height: 1080 }],
    ["4k", { width: 3840, height: 2160 }],
  ]) {
    const { context, page, errors, hosts } = await openPage(viewport);
    await page.getByText("Projects today").waitFor({ timeout: 10_000 });
    await page.getByText("Live", { exact: true }).waitFor({ timeout: 10_000 });
    await page.evaluate(() => document.fonts.ready);
    await sleep(600);
    await page.screenshot({ path: `${OUT}/warroom-${name}.png` });
    check(`warroom ${name}: no console errors`, errors.length === 0, errors.join(" | "));
    check(`warroom ${name}: no document scroll`, await noScroll(page));
    check(`warroom ${name}: fixture banner shown`, await page.getByText("Fixture data, not live").isVisible());
    check(`warroom ${name}: Chicago clock running`, /\d{2}:\d{2}:\d{2}/.test(await page.getByLabel("Clock").innerText()));
    const titleSize = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('[class*="laneTitle"]')).fontSize));
    const expected = name === "4k" ? 44 : 22;
    check(`warroom ${name}: project title ${expected}px`, Math.abs(titleSize - expected) < 0.6, `${titleSize}px`);
    if (name === "1080p") {
      const first = () => page.evaluate(() => document.querySelector('[data-lane] [data-looping] [class*="loopCell"]')?.textContent ?? null);
      const before = await first();
      await page.waitForTimeout(5_200);
      const after = await first();
      check("warroom 1080p: overflowing lane loops instead of '+N more'", before !== null && after !== null && before !== after, `${before} -> ${after}`);
      check("warroom 1080p: no '+N more' text", !(await page.getByText(/\+\d+ more/).count()));
    }
    const unexpectedHosts = [...hosts].filter((h) => h !== "127.0.0.1:4173" && h !== "127.0.0.1:8787");
    check(`warroom ${name}: no third-party requests`, unexpectedHosts.length === 0, unexpectedHosts.join(", "));
    await context.close();
  }

  // Other layouts at 1080p.
  for (const layout of ["projects", "pulse", "goals"]) {
    const { context, page, errors } = await openPage({ width: 1920, height: 1080 }, `/?fn=emm&layout=${layout}`);
    await page.getByText("Live", { exact: true }).waitFor({ timeout: 10_000 });
    await page.evaluate(() => document.fonts.ready);
    await sleep(500);
    await page.screenshot({ path: `${OUT}/${layout}-1080p.png` });
    check(`layout ${layout}: renders without errors or scroll`, errors.length === 0 && (await noScroll(page)), errors.join(" | "));
    await context.close();
  }

  // Phase 2 / 6: network pull keeps the frame; badge goes offline and comes back.
  {
    const { context, page, errors } = await openPage({ width: 1920, height: 1080 });
    await page.getByText("Live", { exact: true }).waitFor({ timeout: 10_000 });
    await context.setOffline(true);
    await page.getByText("Offline", { exact: true }).waitFor({ timeout: 10_000 });
    const stillThere = await page.getByLabel("Pulse").isVisible();
    await page.screenshot({ path: `${OUT}/offline-1080p.png` });
    check("network pull: badge offline, board stays on screen", stillThere);
    await context.setOffline(false);
    await page.getByText("Live", { exact: true }).waitFor({ timeout: 15_000 });
    check("network back: badge returns to live", true);
    const realErrors = errors.filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch|net::/.test(e));
    check("network pull: no app errors", realErrors.length === 0, realErrors.join(" | "));
    await context.close();
  }

  // Nexus unreachable: badge goes stale then offline after 4 failed polls; last data stays.
  {
    const { context, page } = await openPage({ width: 1920, height: 1080 });
    await page.getByText("Live", { exact: true }).waitFor({ timeout: 10_000 });
    await mode("drop");
    await page.getByText("Nexus unreachable").waitFor({ timeout: 10_000 });
    await page.getByText("Offline", { exact: true }).waitFor({ timeout: 60_000 });
    check("Nexus down: reason shown, offline after 4 failed polls, data kept", await page.getByLabel("Pulse").isVisible());

    // Boot while Nexus is down: last good payload from localStorage paints with a stale or offline badge.
    await page.reload();
    await page.getByLabel("Pulse").waitFor({ timeout: 10_000 });
    const badge = await page.getByRole("status").first().innerText();
    check("boot with Nexus down: last good payload painted", /Stale|Offline/i.test(badge), badge.replace(/\s+/g, " "));
    await page.screenshot({ path: `${OUT}/boot-nexus-down-1080p.png` });
    await mode("ok");
    await page.getByText("Live", { exact: true }).waitFor({ timeout: 40_000 });
    check("Nexus back: badge live again", true);
    await context.close();
  }

  // Phase 10: unconfigured Mothership says so, never zeros.
  {
    await mode("unconfigured");
    const { context, page } = await openPage({ width: 1920, height: 1080 }, "/?fn=emm&layout=pulse");
    await page.getByText("Mothership not connected").waitFor({ timeout: 10_000 });
    check("Mothership unconfigured: honest empty pulse", (await page.locator('[data-stat="leads_today"]').count()) === 0);
    await page.screenshot({ path: `${OUT}/pulse-unconfigured-1080p.png` });
    await context.close();
    await mode("ok");
  }

  // Changed payload: only the changed tile animates.
  {
    const { context, page } = await openPage({ width: 1920, height: 1080 }, "/?fn=emm&layout=pulse");
    await page.getByText("Live", { exact: true }).waitFor({ timeout: 10_000 });
    await mode("changed");
    await page.locator('[data-stat="leads_today"]', { hasText: "15" }).waitFor({ timeout: 10_000 });
    check("changed payload: leads tile updates to 15", true);
    await mode("ok");
    await context.close();
  }

  // Wrong token: stale with a reason, not offline.
  {
    writeConfig({}, { token: "wrong-token" });
    const { context, page } = await openPage({ width: 1920, height: 1080 });
    await page.getByText("Display token rejected").first().waitFor({ timeout: 10_000 });
    check("wrong token: 'Display token rejected' shown", true);
    await context.close();
    writeConfig();
  }

  // War Room intro: plays once per tab for 15 s, branded EMM and War Room, never BeastDisplay.
  {
    writeConfig({}, { intro: true });
    const { context, page, errors } = await openPage({ width: 1920, height: 1080 });
    const intro = page.locator("[data-intro]");
    await intro.waitFor({ state: "visible", timeout: 5_000 });
    const text = (await intro.textContent()) ?? "";
    // Screenshots are slow next to the timeline, so the finale is measured in the page itself:
    // once WAR ROOM has finished sliding to the middle.
    await page.evaluate(() => {
      const el = document.querySelector("[data-intro]");
      window.__finale = new Promise((done) => {
        const measure = () => {
          const t = el.querySelector("[class*='_title_']")?.getBoundingClientRect();
          const logo = el.querySelector("img");
          done({ mid: t ? Math.round(t.left + t.width / 2) : null, logo: logo ? Number(getComputedStyle(logo).opacity) : null });
        };
        const watch = new MutationObserver(() => {
          if (el.className.includes("onCenter")) {
            watch.disconnect();
            const wrap = el.querySelector("[class*='_titleWrap_']");
            const fallback = setTimeout(measure, 4_000);
            wrap?.addEventListener("transitionend", (e) => {
              if (e.propertyName !== "transform") return;
              clearTimeout(fallback);
              measure();
            });
          }
        });
        watch.observe(el, { attributes: true, attributeFilter: ["class"] });
      });
    });
    await page.waitForTimeout(5_500);
    check("intro: still playing after the board loads", await intro.isVisible());
    await page.screenshot({ path: `${OUT}/intro-1080p-title.png` });
    await page.waitForTimeout(3_000);
    await page.screenshot({ path: `${OUT}/intro-1080p-status.png` });
    const finale = await page.evaluate(() => window.__finale);
    check("intro: EMM logo fades out at the end, not burned", finale.logo !== null && finale.logo < 0.05, JSON.stringify(finale));
    check("intro: War Room slides to the middle", finale.mid !== null && Math.abs(finale.mid - 960) < 24, JSON.stringify(finale));
    check("intro: shows War Room, not BeastDisplay", /war room/i.test(text) && !/beastdisplay/i.test(text), text.replace(/\s+/g, " "));
    await intro.waitFor({ state: "detached", timeout: 6_000 });
    check("intro: gone after about 15 s, board underneath", await page.getByLabel("Pulse").isVisible());
    check("intro: no console errors", errors.length === 0, errors.join(" | "));
    await page.reload();
    await page.getByLabel("Pulse").waitFor({ timeout: 10_000 });
    check("intro: does not replay in the same tab", (await page.locator("[data-intro]").count()) === 0);
    check("branded board: no BeastDisplay mark on screen", !(await page.getByText("BeastDisplay", { exact: true }).count()));
    check("branded board: tab title", (await page.title()) === "War Room · EMM Advertising", await page.title());
    await context.close();
    writeConfig();
  }

  // Phase 3: pack off, core still boots.
  {
    writeConfig({}, { enabled: false });
    const { context, page, errors } = await openPage({ width: 1920, height: 1080 });
    await page.getByText("Function not configured").waitFor({ timeout: 5_000 });
    check("emm disabled: core boots to 'Function not configured'", errors.length === 0, errors.join(" | "));
    await page.screenshot({ path: `${OUT}/emm-disabled-1080p.png` });
    await context.close();
    writeConfig();
  }

  // Phase 2: external targets.
  {
    const { context, page } = await openPage({ width: 1920, height: 1080 }, `/?target=${encodeURIComponent("https://example.com/")}`);
    await page.getByText("Not on the allowlist").waitFor({ timeout: 5_000 });
    check("non-allowlisted target refused with URL shown", await page.getByText("https://example.com/").isVisible());
    await page.screenshot({ path: `${OUT}/refused-1080p.png` });
    await context.close();
  }
  {
    const { context, page } = await openPage({ width: 1920, height: 1080 }, `/?target=${encodeURIComponent(`${NEXUS}/framed`)}`);
    const frame = page.locator("iframe");
    await frame.waitFor({ timeout: 5_000 });
    const box = await frame.boundingBox();
    check("allowlisted frame:true target fills the stage", box && box.width > 1700 && box.height > 850, box ? `${box.width}x${box.height}` : "");
    await context.close();
  }
  {
    const { context, page } = await openPage({ width: 1920, height: 1080 }, `/?target=${encodeURIComponent("http://localhost:8787/top")}`);
    await page.waitForURL("http://localhost:8787/top", { timeout: 5_000 });
    check("allowlisted frame:false target opens by top-level navigation", true);
    await context.close();
  }

  // Phase 11: token never in the build.
  {
    const { execSync } = await import("node:child_process");
    const out = execSync("node scripts/check-token.mjs", { encoding: "utf8" });
    check("build: no token or config.js in dist/", /PASS/.test(out), out.trim());
  }

  await browser.close();
}

main()
  .catch((e) => {
    console.error(e);
    results.push({ name: "e2e run", ok: false, detail: String(e) });
  })
  .finally(() => {
    for (const p of procs) p.kill();
    if (savedLocal !== null) writeFileSync("config.local.js", savedLocal);
    else rmSync("config.local.js", { force: true });
    writeFileSync(`${OUT}/e2e-results.json`, JSON.stringify(results, null, 2));
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    process.exit(failed.length ? 1 : 0);
  });
