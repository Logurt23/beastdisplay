// Production config for display.emmadvertising.com. Copy to config.js on the
// display host and set the token there. Never commit the real token.
window.BEASTDISPLAY_CONFIG = {
  displayId: "office-main",
  theme: "night",
  clock: { show: true, timeZone: "America/Chicago" },
  safeAreaPx: 48,
  reloadHours: 6,
  lobbyMode: false,
  defaultTarget: { kind: "function", fn: "emm", layout: "warroom" },
  allowlist: [{ origin: "https://display.emmadvertising.com", frame: false }],
  targets: [],
  rotateSeconds: 0,
  functions: {
    emm: {
      enabled: true,
      nexusUrl: "https://nexus.emmadvertising.com",
      token: "SET_ON_HOST",
      pollSeconds: 15,
      timeoutMs: 8000,
      // Who gets a New Development lane, in order: first names or Nexus assignee ids.
      // Leave empty to give everyone with development work a lane.
      developers: ["Logan", "Michael"],
    },
  },
};
