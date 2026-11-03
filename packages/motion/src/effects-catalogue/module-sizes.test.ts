import { describe, expect, it } from "vitest";
// @ts-expect-error The build script is plain JavaScript without types.
import { buildEffectModules } from "../../scripts/effect-modules.mjs";
import { effectModuleBytes } from "./module-sizes.js";

/** The page weight meter shows these numbers, so they must stay true. */
describe("the effect modules' sizes", () => {
  it("match the modules as they are built today, and each stays small", async () => {
    const { modules } = (await buildEffectModules()) as {
      modules: Record<string, { gzipBytes: number }>;
    };
    for (const [name, bytes] of Object.entries(effectModuleBytes)) {
      const actual = modules[name]?.gzipBytes ?? 0;
      expect(
        Math.abs(actual - bytes) / bytes,
        `${name}: run pnpm --filter @lintel/motion measure:effects`,
      ).toBeLessThan(0.1);
      expect(actual, name).toBeLessThan(8 * 1024);
    }
  }, 30_000);
});
