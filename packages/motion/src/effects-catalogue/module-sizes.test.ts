import { describe, expect, it } from "vitest";
// @ts-expect-error The build script is plain JavaScript without types.
import { buildEffectModules, effectPlayerSizes } from "../../scripts/effect-modules.mjs";
import { gzipSync } from "node:zlib";
import { standardEffects } from "./catalogue/index.js";
import { lottiePlayerEffectId, rivePlayerEffectId } from "./catalogue/creative-effects.js";
import { effectModuleBytes, effectPlayerBytes } from "./module-sizes.js";
import { measurePageWeight } from "./page-weight.js";

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

  it("count the Lottie and Rive players, so the meter tells the truth about them", async () => {
    const { beside } = (await buildEffectModules()) as { beside: unknown };
    const sizes = (
      effectPlayerSizes as (files: unknown, gzip: typeof gzipSync) => Record<string, number>
    )(beside, gzipSync);
    for (const [name, bytes] of Object.entries(effectPlayerBytes)) {
      expect(Math.abs((sizes[name] ?? 0) - bytes) / bytes, name).toBeLessThan(0.1);
    }
    const weightOf = (id: string) =>
      measurePageWeight(standardEffects.filter((effect) => effect.id === id));
    expect(weightOf(lottiePlayerEffectId).bytes).toBeGreaterThan(45 * 1024);
    expect(weightOf(rivePlayerEffectId).bytes).toBeGreaterThan(350 * 1024);
    expect(weightOf(rivePlayerEffectId).warnings).toContain("heavyDownload");
  }, 30_000);
});
