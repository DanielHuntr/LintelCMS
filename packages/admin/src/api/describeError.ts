import { t } from "../i18n/strings.js";
import { ApiError } from "./client.js";

/**
 * Turns any failure into a sentence an editor can act on. The API already writes plain
 * messages for the errors it knows about; this covers the ones it can't, such as being offline.
 */
export function describeError(error: unknown): string {
  if (!(error instanceof ApiError)) {
    // fetch rejects with a TypeError when the server can't be reached at all.
    return t("error.unreachable");
  }
  if (error.status === 401) return t("error.signedOut");
  if (error.status === 403) return t("error.permissionDenied");
  if (error.status === 404) return t("error.notFound");
  if (error.status >= 500) return t("error.server");
  return error.message || t("error.generic");
}
