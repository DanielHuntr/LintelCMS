import { HttpError } from "../http/http-errors.js";

export class BlockNotFoundError extends HttpError {
  constructor(handle: string) {
    super(404, "NOT_FOUND", `There is no block called "${handle}".`);
  }
}

export class BlockHandleTakenError extends HttpError {
  constructor(handle: string) {
    super(
      409,
      "BLOCK_HANDLE_TAKEN",
      `There is already a block called "${handle}". Pick another name.`,
    );
  }
}

/** Code blocks are changed in their file, and plugins' blocks by the plugin. */
export class BlockNotEditableError extends HttpError {
  constructor(name: string, source: "code" | "plugin") {
    super(
      409,
      "BLOCK_NOT_EDITABLE",
      source === "code"
        ? `${name} is defined in code. Change it in its file in content-model/blocks/.`
        : `${name} comes from a feature that is switched on. It can't be changed here.`,
    );
  }
}

export interface BlockPageUse {
  entryId: string;
  title: string;
  collection: string;
}

/** Deleting a block pages still use, without saying what should happen to them. */
export class BlockInUseError extends HttpError {
  constructor(name: string, pages: readonly BlockPageUse[]) {
    super(
      409,
      "BLOCK_IN_USE",
      `${name} is used on ${describePages(pages)}. Turn its instances into plain elements to delete it.`,
      { pages },
    );
  }
}

/** Removing properties that pages have filled in, without confirming it. */
export class BlockChangeNeedsConfirmationError extends HttpError {
  constructor(removedProperties: readonly string[], pages: readonly BlockPageUse[]) {
    super(
      409,
      "BLOCK_CHANGE_NEEDS_CONFIRMATION",
      `Removing ${removedProperties.join(", ")} takes what was filled in out of ${describePages(pages)}.`,
      { removedProperties, pages },
    );
  }
}

function describePages(pages: readonly BlockPageUse[]): string {
  const names = pages.slice(0, 3).map((page) => `“${page.title}”`);
  const more = pages.length - names.length;
  return more > 0 ? `${names.join(", ")} and ${more} more` : names.join(" and ");
}
