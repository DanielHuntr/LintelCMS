/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  // Built with relative paths, so the server can serve the admin under any path
  // (ADMIN_PATH); it adds a <base> tag saying which (see packages/core/src/production).
  base: command === "build" ? "./" : "/",
  plugins: [react(), tailwindcss()],
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
}));
