import { describe, expect, it } from "vitest";
import {
  entryDraftReducer,
  hasUnsavedChanges,
  initialDraftState,
  type EntryDraftAction,
  type EntryDraftState,
} from "./entryDraft.js";
import { samplePost } from "./testEntries.js";

function apply(state: EntryDraftState, ...actions: EntryDraftAction[]): EntryDraftState {
  return actions.reduce(entryDraftReducer, state);
}

const typeTitle = (title: string): EntryDraftAction => ({
  type: "fieldChanged",
  handle: "title",
  value: title,
});

describe("unsaved changes", () => {
  it("starts saved, and has unsaved changes after an edit", () => {
    const opened = initialDraftState(samplePost());

    expect(hasUnsavedChanges(opened)).toBe(false);
    expect(hasUnsavedChanges(apply(opened, typeTitle("Hello, world")))).toBe(true);
  });

  it("is saved again once the API accepts what was sent", () => {
    const edited = apply(initialDraftState(samplePost()), typeTitle("Hello, world"));

    const saved = apply(
      edited,
      { type: "saveStarted" },
      { type: "saveSucceeded", sent: edited.current, entry: samplePost({ slug: "hello-world" }) },
    );

    expect(hasUnsavedChanges(saved)).toBe(false);
    expect(saved.saveStatus).toBe("saved");
  });

  it("keeps typing that happened while a save was on its way as unsaved", () => {
    const edited = apply(initialDraftState(samplePost()), typeTitle("Hello"));
    const sent = edited.current;

    const afterSave = apply(edited, { type: "saveStarted" }, typeTitle("Hello again"), {
      type: "saveSucceeded",
      sent,
      entry: samplePost(),
    });

    expect(hasUnsavedChanges(afterSave)).toBe(true);
    expect(afterSave.current.data.title).toBe("Hello again");
  });

  it("isn't changed by putting a field back the way it was", () => {
    const opened = initialDraftState(samplePost());

    const undone = apply(opened, typeTitle("Something else"), typeTitle("Hello world"));

    expect(hasUnsavedChanges(undone)).toBe(false);
  });

  it("takes everything from a restored revision and starts the fields afresh", () => {
    const edited = apply(initialDraftState(samplePost()), typeTitle("Draft title"));

    const restored = apply(edited, {
      type: "entryReplaced",
      entry: samplePost({ data: { title: "Older title" } }),
    });

    expect(hasUnsavedChanges(restored)).toBe(false);
    expect(restored.current.data.title).toBe("Older title");
    expect(restored.formVersion).toBe(edited.formVersion + 1);
  });
});

describe("the slug", () => {
  it("follows the title of a new entry", () => {
    const state = apply(initialDraftState(undefined), typeTitle("My First Post!"));

    expect(state.current.slug).toBe("my-first-post");
  });

  it("stops following once it's edited, and follows again when cleared", () => {
    const edited = apply(
      initialDraftState(undefined),
      typeTitle("My first post"),
      { type: "slugChanged", slug: "first" },
      typeTitle("My first post, revised"),
    );
    expect(edited.current.slug).toBe("first");

    const cleared = apply(edited, { type: "slugChanged", slug: "" }, typeTitle("Back to auto"));
    expect(cleared.current.slug).toBe("back-to-auto");
  });

  it("never changes on its own for a published entry, so links keep working", () => {
    const published = initialDraftState(
      samplePost({ status: "published", publishedAt: "2026-10-01T09:00:00.000Z" }),
    );

    const retitled = apply(published, typeTitle("A new title"));

    expect(retitled.current.slug).toBe("hello-world");
  });

  it("takes the unique slug the API chose, unless it was edited meanwhile", () => {
    const edited = apply(initialDraftState(undefined), typeTitle("Hello world"));

    const saved = apply(edited, {
      type: "saveSucceeded",
      sent: edited.current,
      entry: samplePost({ slug: "hello-world-2" }),
    });

    expect(saved.current.slug).toBe("hello-world-2");
    expect(hasUnsavedChanges(saved)).toBe(false);
  });
});

describe("field errors", () => {
  it("are kept from a failed save and cleared from a field when it's edited", () => {
    const failed = apply(initialDraftState(samplePost()), {
      type: "saveFailed",
      message: "Some fields need attention.",
      fieldErrors: { excerpt: "Add an excerpt.", category: "Choose a category." },
    });
    expect(failed.saveStatus).toBe("failed");

    const fixing = apply(failed, {
      type: "fieldChanged",
      handle: "excerpt",
      value: "Now there is one.",
    });

    expect(fixing.fieldErrors).toEqual({ category: "Choose a category." });
  });
});
