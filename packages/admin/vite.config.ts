/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { contentSecurityPolicy, securityHeaders } from "./src/security/contentSecurityPolicy.js";
import { lintelPlugins } from "./vite-plugin-lintel.js";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { canvasFrameScript } from "@lintel/builder/canvas-frame";

/**
 * The page builder's canvas scripts as files of their own beside the admin: /canvas-frame.js,
 * /canvas-motion.js (the animation runtime, for previews) and /canvas-effects/ (the effect
 * modules and their manifest.json, which the canvas and the Effects gallery import). The Content-Security-Policy
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
  // The effect modules and their manifest, imported by the canvas and the Effects gallery.
  const effectsFolder = () => {
    try {
      return dirname(
        createRequire(import.meta.url).resolve("@lintel/motion/effect-modules/manifest.json"),
      );
    } catch {
      return null;
    }
  };
  const effectFiles = () => {
    const folder = effectsFolder();
    return folder && existsSync(folder) ? readdirSync(folder) : [];
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
      server.middlewares.use("/canvas-effects/", (request, response, next) => {
        const fileName = (request.url ?? "").replace(/^\//, "").split("?")[0] ?? "";
        const folder = effectsFolder();
        if (!folder || !effectFiles().includes(fileName)) return next();
        // The canvas frame has no origin of its own, and module imports need this header.
        response.setHeader("access-control-allow-origin", "*");
        response.setHeader(
          "content-type",
          fileName.endsWith(".json") ? "application/json" : "text/javascript; charset=utf-8",
        );
        response.end(readFileSync(join(folder, fileName), "utf8"));
      });
    },
    generateBundle() {
      for (const [fileName, contents] of Object.entries(files)) {
        this.emitFile({ type: "asset", fileName, source: contents() });
      }
      const folder = effectsFolder();
      for (const fileName of effectFiles()) {
        this.emitFile({
          type: "asset",
          fileName: `canvas-effects/${fileName}`,
          source: readFileSync(join(folder ?? "", fileName), "utf8"),
        });
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
