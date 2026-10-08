import { describe, expect, it, vi } from "vitest";
import { parseConfig, parseQuery } from "../src/core/config";
import { resolveTargets } from "../src/core/targets";
import { FUNCTIONS } from "../src/functions";

const base = parseConfig({
  allowlist: [
    { origin: "https://warroom.emmadvertising.com", frame: false },
    { origin: "https://status.example.com", frame: true },
    { origin: "https://grafana.example.com:3000", frame: true },
  ],
  functions: { emm: { enabled: true } },
  defaultTarget: { kind: "function", fn: "emm", layout: "warroom" },
});

describe("resolveTargets", () => {
  it("boots to the configured default", () => {
    const r = resolveTargets(parseQuery(""), base, FUNCTIONS);
    expect(r.targets).toEqual([{ kind: "function", fn: "emm", layout: "warroom" }]);
    expect(r.rotateSeconds).toBe(0);
  });

  it("shows an allowlisted ?target= and refuses anything else", () => {
    expect(resolveTargets(parseQuery("?target=https://status.example.com/board"), base, FUNCTIONS).targets[0]).toEqual({
      kind: "external",
      url: "https://status.example.com/board",
      frame: true,
    });
    expect(resolveTargets(parseQuery("?target=https://evil.example.com"), base, FUNCTIONS).targets[0]).toEqual({
      kind: "refused",
      url: "https://evil.example.com",
      reason: "not-allowlisted",
    });
    // Origin match is exact: scheme, host and port.
    expect(resolveTargets(parseQuery("?target=http://status.example.com"), base, FUNCTIONS).targets[0].kind).toBe("refused");
    expect(resolveTargets(parseQuery("?target=https://grafana.example.com"), base, FUNCTIONS).targets[0].kind).toBe("refused");
    expect(resolveTargets(parseQuery("?target=https://status.example.com.evil.io"), base, FUNCTIONS).targets[0].kind).toBe("refused");
    expect(resolveTargets(parseQuery("?target=javascript:alert(1)"), base, FUNCTIONS).targets[0]).toMatchObject({ kind: "refused", reason: "invalid-url" });
  });

  it("returns function-not-configured when the pack is disabled or unknown", () => {
    const off = parseConfig({ functions: { emm: { enabled: false } }, defaultTarget: { kind: "function", fn: "emm" } });
    expect(resolveTargets(parseQuery(""), off, FUNCTIONS).targets[0]).toEqual({ kind: "function-not-configured", fn: "emm" });
    expect(resolveTargets(parseQuery("?fn=emm"), off, FUNCTIONS).targets[0].kind).toBe("function-not-configured");
    expect(resolveTargets(parseQuery("?fn=nope"), base, FUNCTIONS).targets[0]).toEqual({ kind: "function-not-configured", fn: "nope" });
  });

  it("boots with no config at all", () => {
    expect(resolveTargets(parseQuery(""), parseConfig(undefined), FUNCTIONS).targets).toEqual([{ kind: "none" }]);
  });

  it("picks the layout from the query and falls back on an unknown one", () => {
    expect(resolveTargets(parseQuery("?fn=emm&layout=projects"), base, FUNCTIONS).targets[0]).toMatchObject({ layout: "projects" });
    expect(resolveTargets(parseQuery("?layout=goals"), base, FUNCTIONS).targets[0]).toMatchObject({ layout: "goals" });
    const r = resolveTargets(parseQuery("?fn=emm&layout=lobby"), base, FUNCTIONS);
    expect(r.targets[0]).toMatchObject({ layout: "warroom" });
    expect(r.warnings).toHaveLength(1);
  });

  it("rotates a pinned function's layouts when rotate is set", () => {
    const r = resolveTargets(parseQuery("?fn=emm&layout=projects&rotate=45"), base, FUNCTIONS);
    expect(r.rotateSeconds).toBe(45);
    expect(r.targets.map((t) => (t.kind === "function" ? t.layout : t.kind))).toEqual(["projects", "pulse", "goals", "warroom"]);
  });

  it("rotates configured targets, dropping frame:false externals with a warning", () => {
    const cfg = parseConfig({
      ...base,
      functions: { emm: { enabled: true } },
      targets: [
        { kind: "function", fn: "emm", layout: "warroom" },
        { kind: "external", url: "https://warroom.emmadvertising.com/" },
        { kind: "external", url: "https://status.example.com/" },
      ],
      rotateSeconds: 30,
    });
    const r = resolveTargets(parseQuery(""), cfg, FUNCTIONS);
    expect(r.targets).toEqual([
      { kind: "function", fn: "emm", layout: "warroom" },
      { kind: "external", url: "https://status.example.com/", frame: true },
    ]);
    expect(r.rotateSeconds).toBe(30);
    expect(r.warnings.join(" ")).toContain("warroom.emmadvertising.com");
  });

  it("does not rotate layouts when the list has an external target", () => {
    const cfg = parseConfig({
      ...base,
      functions: { emm: { enabled: true } },
      targets: [{ kind: "function", fn: "emm" }, { kind: "external", url: "https://status.example.com/" }],
      rotateSeconds: 30,
    });
    const r = resolveTargets(parseQuery(""), cfg, FUNCTIONS);
    expect(r.targets).toHaveLength(2);
  });

  it("pins a single target even with rotate set", () => {
    const r = resolveTargets(parseQuery("?target=https://status.example.com&rotate=10"), base, FUNCTIONS);
    expect(r.rotateSeconds).toBe(0);
  });

  it("never warns through console in pure resolution", () => {
    const spy = vi.spyOn(console, "warn");
    resolveTargets(parseQuery("?fn=emm&layout=nope"), base, FUNCTIONS);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
