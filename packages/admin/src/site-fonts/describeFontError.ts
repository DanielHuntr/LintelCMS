import { ApiError } from "../api/client.js";
import { describeError } from "../api/describeError.js";

const fontErrorCodes = /^(FONT_|GOOGLE_FONT_|ADOBE_PROJECT_|SITE_FONT_)/;

/**
 * The font services' own explanations ("Lintel couldn't reach Google Fonts just now…",
 * "Adobe Fonts doesn't know that project ID…") say what to do, so they are shown as they
 * are, even for a 503 or a 404; anything else is described as usual.
 */
export function describeFontError(error: unknown): string {
  return error instanceof ApiError && fontErrorCodes.test(error.code) && error.message
    ? error.message
    : describeError(error);
}
