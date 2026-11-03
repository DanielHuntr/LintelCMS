import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { sampleModels } from "@lintel/builder-model";

const sampleModelFiles = new Map<string, Buffer>();

/**
 * One of Lintel's sample 3D models by file name ("vase.glb"), or undefined. The website
 * serves them to pages, and the API to the builder, whose security policy only lets it fetch
 * from the API: a site can be on any address.
 */
export function readSampleModel(fileName: string): Buffer | undefined {
  if (!sampleModels.some((sample) => sample.file === fileName)) {
    return undefined;
  }
  const cached = sampleModelFiles.get(fileName);
  if (cached) {
    return cached;
  }
  try {
    const path = createRequire(import.meta.url).resolve(`@lintel/motion/sample-models/${fileName}`);
    const contents = readFileSync(path);
    sampleModelFiles.set(fileName, contents);
    return contents;
  } catch {
    return undefined;
  }
}
