/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";
import { contentSecurityPolicy, securityHeaders } from "./src/security/contentSecurityPolicy.js";
import { lintelPlugins } from "./vite-plugin-lintel.js";

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
    plugins: [react(), tailwindcss(), lintelPlugins(), contentSecurityPolicyTag(apiUrl)],
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
