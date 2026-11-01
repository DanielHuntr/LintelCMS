import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { zipSync, type Zippable } from "fflate";
import { prepareBridgePublish } from "../bridge/bridge-publish.service.js";
import { exportStaticSite } from "../static-site/static-export.service.js";
import type { PublishingContext } from "./publishing-context.js";
import { NotAZipTargetError } from "./publishing.errors.js";
import { findPublishTargetRow, readSecrets } from "./publishing.service.js";

/**
 * "Download as ZIP": the website as one file to upload by hand, through a hosting
 * control panel's File Manager. The companion's private settings are in a separate folder
 * in the ZIP, with a note saying where they go.
 */

export const PRIVATE_FOLDER_IN_ZIP = "lintel-private";
export const WEBSITE_FOLDER_IN_ZIP = "website";

const readMe = [
  "Your website, from Lintel",
  "",
  '1. Upload everything inside the "website" folder to your hosting\'s web folder',
  "   (often called public_html, www or htdocs).",
  '2. If your website has forms or a shop, upload the "lintel-private" folder beside the web',
  "   folder, not inside it. If your host only lets you use the web folder, put it inside:",
  "   it protects itself.",
  "",
  "Never share the lintel-private folder: it holds the key that signs your forms and orders.",
  "",
].join("\r\n");

export async function buildZipDownload(
  context: PublishingContext,
  targetId: string,
): Promise<{ filename: string; content: Uint8Array }> {
  const target = await findPublishTargetRow(context.database, targetId);
  if (target.kind !== "zip") throw new NotAZipTargetError();
  const secrets = readSecrets(context.secretBox(), target);
  const bridge = await prepareBridgePublish(context.api, target, secrets, context.bridgeTesting);
  const folder = join(context.exportsFolder, target.id);
  const exported = await exportStaticSite({
    api: context.api,
    folder,
    formEndpoints: bridge.formEndpoints,
    siteAddress: target.options.siteAddress || null,
    extraFiles: bridge.extraFiles,
    extraPages: bridge.extraPages,
  });
  const entries: Zippable = { "READ ME.txt": new TextEncoder().encode(readMe) };
  for (const file of Object.keys(exported.files)) {
    entries[`${WEBSITE_FOLDER_IN_ZIP}/${file}`] = new Uint8Array(
      await readFile(join(folder, file)),
    );
  }
  for (const file of bridge.privateFiles) {
    entries[`${PRIVATE_FOLDER_IN_ZIP}/${file.path}`] =
      typeof file.content === "string" ? new TextEncoder().encode(file.content) : file.content;
  }
  return { filename: "website.zip", content: zipSync(entries, { level: 6 }) };
}
