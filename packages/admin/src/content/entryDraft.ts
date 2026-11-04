import type { FieldMessages } from "../api/client.js";
import { titleFieldHandle, type EntryData, type FieldValue } from "../fields/field.types.js";
import type { Entry } from "./content.types.js";
import { isSameValue } from "./sameValue.js";
import { cleanTypedSlug, slugFromTitle } from "./slug.js";

/**
 * The entry editor's state, as a reducer so the rules are plain functions that tests can call.
 *
 * `saved` is what the API last accepted; `current` is what is on screen. The entry has unsaved
 * changes exactly when the two differ. Saves record what was *sent* as saved, so typing that
 * happens while a save is on its way still counts as unsaved.
 */

export interface EntryDraft {
  data: EntryData;
  slug: string;
  parentId: string | null;
}

export type SaveStatus = "idle" | "saving" | "saved" | "failed";

export interface EntryDraftState {
  saved: EntryDraft;
  current: EntryDraft;
  /** While true, editing the title rewrites the slug. Editing the slug turns it off. */
  slugFollowsTitle: boolean;
  saveStatus: SaveStatus;
  /** The API's message for each field it rejected, keyed by handle ("slug" for the slug). */
  fieldErrors: FieldMessages;
  /** The API's message when a save failed, for the save indicator. */
  saveError: string | null;
  /** Goes up when the draft is replaced wholesale (a restore), so field editors start afresh. */
  formVersion: number;
}

export type EntryDraftAction =
  | { type: "fieldChanged"; handle: string; value: FieldValue }
  | { type: "slugChanged"; slug: string }
  | { type: "parentChanged"; parentId: string | null }
  | { type: "saveStarted" }
  | { type: "saveSucceeded"; sent: EntryDraft; entry: Entry }
  | { type: "saveFailed"; fieldErrors: FieldMessages; message: string }
  /** Publishing or scheduling was refused because fields need filling in; the draft is saved. */
  | { type: "publishBlocked"; fieldErrors: FieldMessages }
  | { type: "entryReplaced"; entry: Entry }
  /**
   * Someone else saved this entry. Their values come in, except where this person has edits
   * of their own. `useTheirs` lists fields where they chose the other person's. `redraw` starts
   * field editors afresh; it is left off when nobody asked for this, so typing isn't interrupted.
   */
  | { type: "rebased"; entry: Entry; useTheirs?: readonly string[]; redraw?: boolean };

export function draftFromEntry(entry: Entry): EntryDraft {
  return { data: entry.data, slug: entry.slug, parentId: entry.parentId };
}

export const emptyDraft: EntryDraft = { data: {}, slug: "", parentId: null };

/**
 * What changed in the editor since its last save: the fields, slug and parent that differ.
 * Saving sends only these, so someone else's saved changes to anything else are kept.
 */
export function changesSince(
  saved: EntryDraft,
  current: EntryDraft,
): { data: EntryData; slug?: string; parentId?: string | null } {
  const data: EntryData = {};
  for (const [handle, value] of Object.entries(current.data)) {
    if (!isSameValue(value, saved.data[handle])) data[handle] = value;
  }
  return {
    data,
    ...(current.slug !== saved.slug ? { slug: current.slug } : {}),
    ...(current.parentId !== saved.parentId ? { parentId: current.parentId } : {}),
  };
}

/**
 * This person's draft on top of someone else's save: fields they haven't touched take the
 * saved values, and fields they have keep their edits, except any listed in `useTheirs`.
 */
export function rebaseDraft(
  saved: EntryDraft,
  current: EntryDraft,
  latest: Entry,
  useTheirs: readonly string[] = [],
): EntryDraft {
  const theirs = draftFromEntry(latest);
  const mine = changesSince(saved, current);
  const keep = (handle: string) => !useTheirs.includes(handle);
  return {
    data: {
      ...theirs.data,
      ...Object.fromEntries(Object.entries(mine.data).filter(([handle]) => keep(handle))),
    },
    slug: mine.slug !== undefined && keep("slug") ? mine.slug : theirs.slug,
    parentId: mine.parentId !== undefined && keep("parentId") ? mine.parentId : theirs.parentId,
  };
}

/** Where this person and someone else's save both changed the same thing, differently. */
export function findDraftClashes(saved: EntryDraft, current: EntryDraft, latest: Entry): string[] {
  const theirs = draftFromEntry(latest);
  const mine = changesSince(saved, current);
  const clashes = Object.keys(mine.data).filter(
    (handle) =>
      !isSameValue(theirs.data[handle], saved.data[handle]) &&
      !isSameValue(theirs.data[handle], mine.data[handle]),
  );
  if (mine.slug !== undefined && theirs.slug !== saved.slug && theirs.slug !== mine.slug) {
    clashes.push("slug");
  }
  if (
    mine.parentId !== undefined &&
    theirs.parentId !== saved.parentId &&
    theirs.parentId !== mine.parentId
  ) {
    clashes.push("parentId");
  }
  return clashes;
}

/**
 * New entries follow the title. So does an entry that has never been published and whose
 * slug still matches its title: changing a live page's address would break links to it.
 */
export function initialDraftState(
  entry: Entry | undefined,
  /** What a new entry starts with: each field's default value. */
  startingData: EntryData = {},
): EntryDraftState {
  const draft = entry ? draftFromEntry(entry) : { ...emptyDraft, data: startingData };
  const title =
    typeof draft.data[titleFieldHandle] === "string" ? draft.data[titleFieldHandle] : "";
  const slugFollowsTitle =
    !entry || (entry.publishedAt === null && entry.slug === slugFromTitle(title));

  return {
    saved: draft,
    current: draft,
    slugFollowsTitle,
    saveStatus: "idle",
    fieldErrors: {},
    saveError: null,
    formVersion: 0,
  };
}

export function hasUnsavedChanges(state: EntryDraftState): boolean {
  return !isSameValue(state.saved, state.current);
}

export function entryDraftReducer(
  state: EntryDraftState,
  action: EntryDraftAction,
): EntryDraftState {
  switch (action.type) {
    case "fieldChanged": {
      const data = { ...state.current.data, [action.handle]: action.value };
      const followsTitle = state.slugFollowsTitle && action.handle === titleFieldHandle;
      const slug = followsTitle ? slugFromTitle(String(action.value ?? "")) : state.current.slug;
      return {
        ...state,
        current: { ...state.current, data, slug },
        fieldErrors: withoutKey(state.fieldErrors, action.handle),
      };
    }

    case "slugChanged": {
      const slug = cleanTypedSlug(action.slug);
      return {
        ...state,
        current: { ...state.current, slug },
        // Clearing the slug hands it back to the title.
        slugFollowsTitle: slug === "",
        fieldErrors: withoutKey(state.fieldErrors, "slug"),
      };
    }

    case "parentChanged":
      return { ...state, current: { ...state.current, parentId: action.parentId } };

    case "saveStarted":
      return { ...state, saveStatus: "saving" };

    case "saveSucceeded": {
      // The API may adjust the slug to make it unique. Take its version unless the slug
      // was edited again while the save was on its way.
      const slugIsUnchanged = state.current.slug === action.sent.slug;
      const savedSlug = action.entry.slug;
      return {
        ...state,
        saved: { ...action.sent, slug: slugIsUnchanged ? savedSlug : action.sent.slug },
        current: slugIsUnchanged ? { ...state.current, slug: savedSlug } : state.current,
        saveStatus: "saved",
        fieldErrors: {},
        saveError: null,
      };
    }

    case "saveFailed":
      return {
        ...state,
        saveStatus: "failed",
        fieldErrors: action.fieldErrors,
        saveError: action.message,
      };

    case "publishBlocked":
      return { ...state, fieldErrors: action.fieldErrors };

    case "rebased":
      return {
        ...state,
        saved: draftFromEntry(action.entry),
        current: rebaseDraft(state.saved, state.current, action.entry, action.useTheirs),
        formVersion: action.redraw ? state.formVersion + 1 : state.formVersion,
      };

    case "entryReplaced": {
      const draft = draftFromEntry(action.entry);
      return {
        ...state,
        saved: draft,
        current: draft,
        saveStatus: "saved",
        fieldErrors: {},
        saveError: null,
        formVersion: state.formVersion + 1,
      };
    }
  }
}

function withoutKey(messages: FieldMessages, key: string): FieldMessages {
  if (!(key in messages)) return messages;
  const rest = { ...messages };
  delete rest[key];
  return rest;
}
