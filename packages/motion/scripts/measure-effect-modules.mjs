// Updates src/effects-catalogue/module-sizes.ts with what each effect module weighs now.
// Run after changing a module: pnpm --filter @lintel/motion measure:effects
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { fileURLToPath } from "node:url";
import { buildEffectModules, effectPlayerSizes } from "./effect-modules.mjs";

const { modules, beside } = await buildEffectModules();
const lines = Object.entries(modules)
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([name, module]) => `  "${name}": ${module.gzipBytes},`);
const players = Object.entries(effectPlayerSizes(beside, gzipSync)).map(
  ([name, bytes]) => `  "${name}": ${bytes},`,
);
writeFileSync(
  fileURLToPath(new URL("../src/effects-catalogue/module-sizes.ts", import.meta.url)),
  `import type { EffectModuleName } from "../effects/effect-types.js";

/**
 * What each effect module costs a page that uses it, gzipped, with the shared code it
 * imports. Measured by scripts/measure-effect-modules.mjs; a test checks it stays current.
 */
export const effectModuleBytes: Record<EffectModuleName, number> = {
${lines.join("\n")}
};

/**
 * What a page also downloads, gzipped, once such an element nears the screen: the player
 * and, for Rive, its WebAssembly. Kept apart from the modules, which stay small.
 */
export const effectPlayerBytes: Partial<Record<EffectModuleName, number>> = {
${players.join("\n")}
};
`,
);
