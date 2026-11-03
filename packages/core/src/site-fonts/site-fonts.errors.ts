import { HttpError } from "../http/http-errors.js";

const serviceNames = { google: "Google Fonts", adobe: "Adobe Fonts" } as const;

/**
 * Another font service couldn't be reached, was too slow, or answered with something
 * unexpected. Usually the server is offline; the fonts that come with Lintel still work.
 */
export class FontServiceUnreachableError extends HttpError {
  constructor(service: keyof typeof serviceNames) {
    super(
      503,
      "FONT_SERVICE_UNREACHABLE",
      `Lintel couldn't reach ${serviceNames[service]} just now. Check this server is online and try again. The fonts that come with Lintel still work.`,
      { service },
    );
  }
}

export class SiteFontNotFoundError extends HttpError {
  constructor() {
    super(404, "SITE_FONT_NOT_FOUND", "That font isn't on this site any more.");
  }
}

export class GoogleFontNotFoundError extends HttpError {
  constructor() {
    super(404, "GOOGLE_FONT_NOT_FOUND", "Google Fonts doesn't have that family. Choose another.");
  }
}

/** Two fonts on one site can't share a name, or pages couldn't tell them apart. */
export class SiteFontNameTakenError extends HttpError {
  constructor(family: string) {
    super(
      409,
      "SITE_FONT_NAME_TAKEN",
      `This site already has a font called ${family}. Remove it first, or give this one another name.`,
    );
  }
}

/** A site can only have so many fonts; each one is more for every visitor to download. */
export class TooManySiteFontsError extends HttpError {
  constructor(max: number) {
    super(
      409,
      "TOO_MANY_SITE_FONTS",
      `A site can have up to ${max} fonts. Remove one you don't use, then add this one.`,
    );
  }
}

export class FontFileNotUsableError extends HttpError {
  constructor(filename: string) {
    super(
      422,
      "FONT_FILE_NOT_USABLE",
      `${filename} isn't a font file. Use WOFF2, TTF or OTF files.`,
    );
  }
}

export class AdobeProjectNotFoundError extends HttpError {
  constructor() {
    super(
      404,
      "ADOBE_PROJECT_NOT_FOUND",
      "Adobe Fonts doesn't know that project ID. Copy it again from Web projects in Adobe Fonts.",
    );
  }
}

export class AdobeProjectEmptyError extends HttpError {
  constructor() {
    super(
      422,
      "ADOBE_PROJECT_EMPTY",
      "That Adobe Fonts project has no fonts yet. Add some to it in Adobe Fonts, then connect it again.",
    );
  }
}
