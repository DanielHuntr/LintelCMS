import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";

/** Published pages load this file, so its size is part of its contract. */
describe("the site runtime's file", () => {
  it("bundles into one small file without the schema library", async () => {
    const result = await build({
      entryPoints: [fileURLToPath(new URL("./site-runtime-entry.ts", import.meta.url))],
      bundle: true,
      minify: true,
      format: "iife",
      write: false,
    });
    const code = result.outputFiles[0]?.text ?? "";
    expect(code).not.toMatch(/ZodError|zod/);
    expect(gzipSync(code).byteLength).toBeLessThan(10 * 1024);
  });
});
