import { testsScript } from "../experiments/tests-script.js";
import { readSampleModel } from "../media/sample-models.js";
import {
  EFFECTS_FOLDER,
  FONTS_FOLDER,
  ILLUSTRATIONS_FOLDER,
  readCookieNoticeScript,
  readEffectFile,
  readEffectModules,
  readElementsScript,
  readFontFile,
  readIllustration,
  readMotionRuntime,
  SAMPLE_MODELS_FOLDER,
} from "../website/site-assets.js";

/**
 * The website's own files that pages and the stylesheet link to under `/_lintel`: the
 * motion runtime, the elements script (sliders, forms, menus), the cookie notice, effect
 * modules, illustrations, sample 3D models and the fonts that come with Lintel. The live site serves them
 * from memory; an export copies each one a page or the stylesheet names.
 *
 * `/_lintel/api/...` isn't a file: it is Lintel answering (forms, the shop, visitor counts),
 * which a folder of files can't do. See static-capabilities.ts for what happens instead.
 */

const SITE_FILE_PATTERN = /\/_lintel\/(?!api\/)[A-Za-z0-9._/-]+\.(?:js|css|woff2|svg|glb)/g;

/** Every `/_lintel/...` file named in a page, a stylesheet or a script, once each. */
export function findSiteFiles(text: string): string[] {
  return [...new Set(text.match(SITE_FILE_PATTERN) ?? [])];
}

export interface SiteFile {
  content: string | Uint8Array;
  /**
   * Other files it needs that its text doesn't name: an effect module imports chunks by
   * relative address, so every effect file goes along with the first one.
   */
  alsoNeeds: string[];
}

/** One of the website's own files by its address, or null when it isn't one. */
export function readSiteFile(path: string): SiteFile | null {
  const script = [readMotionRuntime(), readElementsScript(), readCookieNoticeScript()].find(
    (candidate) => candidate?.path === path,
  );
  if (script) return { content: script.code, alsoNeeds: [] };
  // A/B tests need Lintel to count visitors, so exported pages never load their script.
  if (path === testsScript.path) return null;
  const name = path.split("/").at(-1) ?? "";
  if (path === `${EFFECTS_FOLDER}/${name}`) {
    const file = readEffectFile(name);
    if (file === undefined) return null;
    const every = [...(readEffectModules()?.files ?? [])].map(
      (moduleFile) => `${EFFECTS_FOLDER}/${moduleFile}`,
    );
    return { content: file.contents, alsoNeeds: every.filter((other) => other !== path) };
  }
  if (path === `${ILLUSTRATIONS_FOLDER}/${name}`) {
    const svg = readIllustration(name);
    return svg === undefined ? null : { content: svg, alsoNeeds: [] };
  }
  if (path === `${SAMPLE_MODELS_FOLDER}/${name}`) {
    const model = readSampleModel(name);
    return model === undefined ? null : { content: model, alsoNeeds: [] };
  }
  if (path === `${FONTS_FOLDER}/${name}`) {
    const font = readFontFile(name);
    return font === undefined ? null : { content: font, alsoNeeds: [] };
  }
  return null;
}
