/**
 * Shapes Nexus records into the section 7 contract. If Nexus stores other field
 * names, map them here. Do not rename live Nexus records.
 */

const list = (v) => (Array.isArray(v) ? v : []);

export function buildBoard({ projects, events, goals, pulse, now = new Date(), staleAfterSeconds = 60 } = {}) {
  const p = pulse ?? { tiles: [], ticker: [], sourceStatus: "unconfigured" };
  return {
    generatedAt: new Date(now).toISOString().replace(/\.\d{3}Z$/, "Z"),
    timezone: "America/Chicago",
    staleAfterSeconds,
    pulse: {
      tiles: list(p.tiles),
      ticker: list(p.ticker),
      sourceStatus: p.sourceStatus ?? (list(p.tiles).length > 0 ? "live" : "unconfigured"),
    },
    projects: list(projects),
    events: list(events),
    goals: list(goals),
  };
}
