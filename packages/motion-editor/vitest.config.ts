import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ["development"] },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/testing/setup.ts"],
    exclude: ["src/browser-tests/**", "node_modules/**"],
  },
});
