import { describe, expect, it } from "vitest";
import { applyQuery, DEFAULTS, parseConfig, parseQuery } from "../src/core/config";
import { registryEntries } from "../src/core/registry";
import { FUNCTIONS } from "../src/functions";

describe("config", () => {
  it("falls back to defaults for missing or bad values and never throws", () => {
    expect(parseConfig(undefined)).toEqual(DEFAULTS);
    expect(parseConfig("nope")).toEqual(DEFAULTS);
    const c = parseConfig({ safeAreaPx: -4, theme: "neon", reloadHours: "6", allowlist: [{ origin: "not a url" }, { origin: "https://a.example/path", frame: "yes" }] });
    expect(c.safeAreaPx).toBe(48);
    expect(c.theme).toBe("night");
    expect(c.reloadHours).toBe(6);
    expect(c.allowlist).toEqual([{ origin: "https://a.example", frame: false }]);
  });

  it("applies query over config over defaults", () => {
    const c = parseConfig({ theme: "night", rotateSeconds: 0 });
    const q = parseQuery("?theme=day&rotate=45&target=https://x.example");
    expect(q).toEqual({ theme: "day", rotate: 45, target: "https://x.example" });
    expect(applyQuery(c, q)).toMatchObject({ theme: "day", rotateSeconds: 45 });
    expect(parseQuery("?rotate=abc&theme=x")).toEqual({});
  });

  it("only enables a function when config says enabled: true", () => {
    expect(registryEntries(FUNCTIONS, parseConfig({ functions: { emm: { enabled: "true" } } }))).toEqual([
      { id: "emm", title: "EMM board", enabled: false },
    ]);
    expect(registryEntries(FUNCTIONS, parseConfig({ functions: { emm: { enabled: true } } }))[0].enabled).toBe(true);
  });
});
