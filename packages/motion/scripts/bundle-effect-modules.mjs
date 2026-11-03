// Writes dist/effect-modules: the effect modules, their shared chunks and manifest.json.
import { rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildEffectModules } from "./effect-modules.mjs";

const outdir = fileURLToPath(new URL("../dist/effect-modules/", import.meta.url));
rmSync(outdir, { recursive: true, force: true });
// Gzipped sizes are measured on the in-memory build, then the same build is written.
const measured = await buildEffectModules();
const written = await buildEffectModules({ outdir });
const modules = Object.fromEntries(
  Object.entries(written.modules).map(([name, module]) => [
    name,
    { ...module, gzipBytes: measured.modules[name]?.gzipBytes ?? 0 },
  ]),
);
for (const { file, contents } of written.beside) writeFileSync(`${outdir}${file}`, contents);
writeFileSync(
  `${outdir}manifest.json`,
  `${JSON.stringify({ modules, files: written.files }, null, 2)}\n`,
);
