/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { contentSecurityPolicy, securityHeaders } from "./src/security/contentSecurityPolicy.js";
import { lintelPlugins } from "./vite-plugin-lintel.js";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { canvasFrameScript } from "@lintel/builder/canvas-frame";

/**
 * The page builder's canvas scripts as files of their own beside the admin: /canvas-frame.js
 * and /canvas-motion.js (the animation runtime, for previews). The Content-Security-Policy
 * refuses inline scripts, and the canvas frame inherits it.
 */
function canvasFrameScriptFiles(): Plugin {
  const motionRuntime = () => {
    // Built with @lintel/motion; until then the canvas just can't preview animations.
    try {
      return readFileSync(
        createRequire(import.meta.url).resolve("@lintel/motion/site-runtime.js"),
        "utf8",
      );
    } catch {
      return "";
    }
  };
  const files: Record<string, () => string> = {
    "canvas-frame.js": canvasFrameScript,
    "canvas-motion.js": motionRuntime,
  };
  return {
    name: "lintel-canvas-frame-scripts",
    configureServer(server) {
      for (const [fileName, contents] of Object.entries(files)) {
        server.middlewares.use(`/${fileName}`, (_request, response) => {
          response.setHeader("content-type", "text/javascript; charset=utf-8");
          response.end(contents());
        });
      }
    },
    generateBundle() {
      for (const [fileName, contents] of Object.entries(files)) {
        this.emitFile({ type: "asset", fileName, source: contents() });
      }
    },
  };
}

/** Writes the Content-Security-Policy into the built index.html (see src/security). */
function contentSecurityPolicyTag(apiUrl: string): Plugin {
  return {
    name: "lintel-content-security-policy",
    apply: "build",
    transformIndexHtml: () => [
      {
        tag: "meta",
        attrs: { "http-equiv": "Content-Security-Policy", content: contentSecurityPolicy(apiUrl) },
        injectTo: "head-prepend",
      },
    ],
  };
}

export default defineConfig(({ command, mode }) => {
  const apiUrl = loadEnv(mode, process.cwd(), "VITE_").VITE_API_URL ?? "http://localhost:4000";
  return {
    // Built with relative paths, so the server can serve the admin under any path
    // (ADMIN_PATH); it adds a <base> tag saying which (see packages/core/src/production).
    base: command === "build" ? "./" : "/",
    plugins: [
      react(),
      tailwindcss(),
      lintelPlugins(),
      canvasFrameScriptFiles(),
      contentSecurityPolicyTag(apiUrl),
    ],
    // Plugin packages import React and the router themselves; they must share the admin's copy.
    resolve: { dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/react-router"] },
    server: { port: 5173 },
    preview: { headers: securityHeaders(apiUrl) },
    test: {
      environment: "jsdom",
      setupFiles: ["./src/test-setup.ts"],
    },
  };
});
