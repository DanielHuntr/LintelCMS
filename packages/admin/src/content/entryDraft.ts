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
  | { type: "entryReplaced"; entry: Entry };

export function draftFromEntry(entry: Entry): EntryDraft {
  return { data: entry.data, slug: entry.slug, parentId: entry.parentId };
}

export const emptyDraft: EntryDraft = { data: {}, slug: "", parentId: null };

/**
 * New entries follow the title. So does an entry that has never been published and whose
 * slug still matches its title: changing a live page's address would break links to it.
 */
export function initialDraftState(entry: Entry | undefined): EntryDraftState {
  const draft = entry ? draftFromEntry(entry) : emptyDraft;
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
