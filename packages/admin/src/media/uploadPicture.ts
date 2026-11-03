import { t } from "../i18n/strings.js";
import { type Asset, uploadAsset } from "./media.api.js";
import { withUsableName } from "./pastedFiles.js";
import { findUploadProblem } from "./upload-rules.js";
import { describeUploadError } from "./useUploadQueue.js";

/**
 * Uploads one picture to the media library with the library's own checks, for places that
 * take a picture without the upload tray, such as the page builder's canvas. Rejects with an
 * Error whose message says in plain words what went wrong, ready to show as it is.
 */
export async function uploadPicture(
  file: File,
  upload: typeof uploadAsset = uploadAsset,
): Promise<Asset> {
  const named = withUsableName(file);
  const problem = findUploadProblem(named, { imagesOnly: true });
  if (problem) {
    throw new Error(
      named.type.startsWith("image/")
        ? problem
        : t("media.quickUpload.notPicture", { name: named.name }),
    );
  }
  try {
    return await upload(named, () => undefined);
  } catch (error) {
    throw new Error(describeUploadError(error), { cause: error });
  }
}
