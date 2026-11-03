import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

/** The runtime ships on every published page, so its size is part of its contract. */
describe("the runtime bundle", () => {
  it("stays small and leaves the schema library out", async () => {
    const result = await build({
      entryPoints: [fileURLToPath(new URL("../index.ts", import.meta.url))],
      bundle: true,
      minify: true,
      format: "esm",
      write: false,
    });
    const code = result.outputFiles[0]?.text ?? "";
    expect(code).not.toMatch(/ZodError|zod/);
    // Smooth scrolling and the site cursor's colours load with their own modules.
    expect(code).not.toContain("data-lintel-smooth-scroll");
    expect(code).not.toContain("--lintel-color-brand");
    expect(gzipSync(code).byteLength).toBeLessThan(10 * 1024);
  });
});
