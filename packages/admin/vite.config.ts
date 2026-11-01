/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { lintelPlugins } from "./vite-plugin-lintel.js";

export default defineConfig({
  plugins: [react(), tailwindcss(), lintelPlugins()],
  // Plugin packages import React and the router themselves; they must share the admin's copy.
  resolve: { dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/react-router"] },
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
  },
});
