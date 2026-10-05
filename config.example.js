// BeastDisplay runtime config. Copy to config.js on the display host (or to
// config.local.js for local dev). Never commit a real token.
// Served with Cache-Control: no-cache so a rotated token is live at the next reload.
window.BEASTDISPLAY_CONFIG = {
  displayId: "office-main",
  theme: "night",
  clock: { show: true, timeZone: "America/Chicago" },
  safeAreaPx: 48,
  reloadHours: 6,
  lobbyMode: false,
  defaultTarget: { kind: "function", fn: "emm", layout: "warroom" },
  // Exact origins. frame: true only when the operator confirmed the origin allows
  // being framed by this display host. frame: false opens by top-level navigation.
  allowlist: [{ origin: "https://display.emmadvertising.com", frame: false }],
  // Targets cycled when rotateSeconds > 0. Empty: rotate the pinned function's layouts.
  targets: [],
  rotateSeconds: 0,
  functions: {
    emm: {
      enabled: true,
      nexusUrl: "https://nexus.emmadvertising.com",
      token: "REPLACE_ON_HOST",
      pollSeconds: 15,
      timeoutMs: 8000,
      // Who gets a New Development lane, in order: first names or Nexus assignee ids.
      // Leave empty to give everyone with development work a lane.
      developers: ["Logan", "Michael"],
    },
  },
};
