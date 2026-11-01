import { HttpError } from "../http/http-errors.js";

export class LocaleNotFoundError extends HttpError {
  constructor(code: string) {
    super(404, "NOT_FOUND", `This site isn't set up for the language “${code}”.`);
  }
}

export class LocaleAlreadyAddedError extends HttpError {
  constructor(name: string) {
    super(409, "LOCALE_EXISTS", `${name} is already one of this site's languages.`);
  }
}

export class DefaultLocaleRemovalError extends HttpError {
  constructor(name: string) {
    super(409, "DEFAULT_LOCALE", `${name} is the site's main language, so it can't be removed.`);
  }
}

export class LocaleInUseError extends HttpError {
  constructor(name: string, entryCount: number) {
    const entries = entryCount === 1 ? "1 entry is" : `${entryCount} entries are`;
    super(
      409,
      "LOCALE_IN_USE",
      `${entries} written in ${name}. Delete them first, so nothing is lost by accident.`,
      { entryCount },
    );
  }
}
