/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Runtime config is never bundled and never copied into dist/.
 * In dev, /config.js is served from config.local.js (gitignored), falling back
 * to config.example.js. In production the host writes config.js beside index.html.
 */
function runtimeConfig(): Plugin {
  const serve = (_req: unknown, res: import("node:http").ServerResponse) => {
    const local = resolve(process.cwd(), "config.local.js");
    const file = existsSync(local) ? local : resolve(process.cwd(), "config.example.js");
    res.setHeader("Content-Type", "text/javascript; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache");
    res.end(readFileSync(file));
  };
  return {
    name: "beastdisplay-runtime-config",
    configureServer(server) {
      server.middlewares.use("/config.js", serve);
    },
    configurePreviewServer(server) {
      server.middlewares.use("/config.js", serve);
    },
  };
}

export default defineConfig({
  plugins: [react(), runtimeConfig()],
  build: { target: "es2022", sourcemap: false },
  // The browser checks run preview under the production CSP shape (deploy/nginx.conf).
  preview: process.env.BD_CSP ? { headers: { "Content-Security-Policy": process.env.BD_CSP } } : {},
  test: {
    environment: "jsdom",
    include: ["tests/**/*.test.{ts,tsx}", "nexus-display/**/*.test.mjs"],
  },
});
