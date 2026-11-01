// Fetches the font catalogue's files from the `@fontsource/*` packages on npm and copies the
// Latin WOFF2 files and each family's licence into ../fonts. Run it by hand when the
// catalogue changes (src/fonts/font-catalogue.ts lists the same families and weights):
//
//   node packages/builder-model/scripts/fetch-fonts.mjs
//
// The files are committed, so building and running Lintel never needs the network.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const families = [
  ["inter", [400, 700], [400]],
  ["dm-sans", [400, 700], [400]],
  ["space-grotesk", [400, 500, 700], []],
  ["manrope", [400, 700], []],
  ["work-sans", [400, 700], [400]],
  ["archivo", [400, 700, 900], [400]],
  ["syne", [400, 700, 800], []],
  ["unbounded", [400, 700], []],
  ["bebas-neue", [400], []],
  ["anton", [400], []],
  ["oswald", [400, 700], []],
  ["big-shoulders-display", [700, 900], []],
  ["archivo-black", [400], []],
  ["playfair-display", [400, 700], [400]],
  ["dm-serif-display", [400], [400]],
  ["fraunces", [400, 700], [400]],
  ["instrument-serif", [400], [400]],
  ["lora", [400, 700], [400]],
  ["yellowtail", [400], []],
  ["pacifico", [400], []],
  ["kaushan-script", [400], []],
  ["caveat", [400, 700], []],
  ["space-mono", [400, 700], [400]],
];

const fontsFolder = join(dirname(fileURLToPath(import.meta.url)), "..", "fonts");
mkdirSync(join(fontsFolder, "licences"), { recursive: true });
const work = mkdtempSync(join(tmpdir(), "lintel-fonts-"));

try {
  for (const [id, weights, italicWeights] of families) {
    execFileSync("npm", ["pack", `@fontsource/${id}`, "--silent"], { cwd: work });
    const packed = execFileSync("sh", ["-c", `ls fontsource-${id}-*.tgz`], { cwd: work })
      .toString()
      .trim();
    const unpacked = join(work, id);
    mkdirSync(unpacked);
    execFileSync("tar", ["xzf", join(work, packed), "-C", unpacked]);
    const files = [
      ...weights.map((weight) => `${id}-latin-${weight}-normal.woff2`),
      ...italicWeights.map((weight) => `${id}-latin-${weight}-italic.woff2`),
    ];
    for (const file of files) {
      copyFileSync(join(unpacked, "package", "files", file), join(fontsFolder, file));
    }
    const metadata = JSON.parse(readFileSync(join(unpacked, "package", "metadata.json"), "utf8"));
    const licence = readFileSync(join(unpacked, "package", "LICENSE"), "utf8");
    writeFileSync(
      join(fontsFolder, "licences", `${id}.txt`),
      `${metadata.family} (${metadata.license.type})\n${metadata.license.attribution}\n\n${licence}`,
    );
    process.stdout.write(`${metadata.family}: ${files.length} files\n`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
