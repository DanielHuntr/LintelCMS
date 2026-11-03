import { HttpError } from "../http/http-errors.js";

/** Openverse couldn't be reached, was too slow, or answered with something unexpected. */
export class FreePhotosUnavailableError extends HttpError {
  constructor() {
    super(
      502,
      "FREE_PHOTOS_UNAVAILABLE",
      "The free photo search isn't answering right now. Try again in a minute.",
    );
  }
}

/** Openverse limits how often one server may search without a key. */
export class FreePhotosBusyError extends HttpError {
  constructor() {
    super(
      429,
      "FREE_PHOTOS_BUSY",
      "This site has searched for free photos a lot today. Wait a little and try again.",
    );
  }
}

export class FreePhotoNotFoundError extends HttpError {
  constructor() {
    super(404, "FREE_PHOTO_NOT_FOUND", "That photo is no longer available. Choose another.");
  }
}

/** The photo's licence would need permission for a business website, so it isn't offered. */
export class FreePhotoLicenceNotAllowedError extends HttpError {
  constructor() {
    super(
      422,
      "FREE_PHOTO_LICENCE_NOT_ALLOWED",
      "That photo's licence doesn't allow use on a business website without asking. Choose another.",
    );
  }
}

/** The photo itself couldn't be downloaded; `reason` says why, in words. */
export class FreePhotoDownloadError extends HttpError {
  constructor(reason: string) {
    super(
      502,
      "FREE_PHOTO_DOWNLOAD_FAILED",
      `The photo couldn't be downloaded: ${reason}. Choose another.`,
    );
  }
}
