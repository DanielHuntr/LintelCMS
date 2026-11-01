import { describe, expect, it } from "vitest";
import type { Blueprint } from "./blueprints.types.js";
import {
  blueprintDraftReducer,
  blueprintProblems,
  draftFromBlueprint,
  fieldsForSaving,
  problemsByKey,
  renameChoice,
  type BlueprintDraftAction,
  type BlueprintDraftState,
} from "./blueprintDraft.js";

const blueprint: Blueprint = {
  id: "b1",
  handle: "page",
  name: "Page",
  kind: "entry",
  version: 1,
  updatedAt: "2026-10-01T09:00:00.000Z",
  fields: [
    { handle: "title", label: "Title", type: "text", required: true, options: {} },
    {
      handle: "summary",
      label: "Summary",
      type: "textarea",
      required: false,
      options: { maxLength: 160 },
    },
    { handle: "body", label: "Body", type: "richText", required: false, options: {} },
  ],
};

function apply(...actions: BlueprintDraftAction[]): BlueprintDraftState {
  return actions.reduce(blueprintDraftReducer, draftFromBlueprint(blueprint));
}
const handles = (state: BlueprintDraftState) => state.fields.map((field) => field.handle);
const keyOf = (state: BlueprintDraftState, handle: string) =>
  state.fields.find((field) => field.handle === handle)?.key ?? "";
const start = draftFromBlueprint(blueprint);

describe("adding fields", () => {
  it("adds a field at the end with a handle made from its label", () => {
    const state = apply({
      type: "fieldAdded",
      key: "new-1",
      fieldType: "image",
      label: "Hero image",
    });

    expect(handles(state)).toEqual(["title", "summary", "body", "hero_image"]);
    expect(state.fields.at(-1)).toMatchObject({ type: "image", required: false, isSaved: false });
  });

  it("never gives two fields the same handle", () => {
    const state = apply(
      { type: "fieldAdded", key: "new-1", fieldType: "richText", label: "Body" },
      { type: "fieldAdded", key: "new-2", fieldType: "richText", label: "Body" },
    );

    expect(handles(state).slice(-2)).toEqual(["body_2", "body_3"]);
  });

  it("starts a choice field with an empty list of choices", () => {
    const state = apply({ type: "fieldAdded", key: "new-1", fieldType: "select", label: "Choice" });

    expect(state.fields.at(-1)?.options).toEqual({ choices: [], multiple: false });
  });
});

describe("handles", () => {
  it("follow the label of a new field until they're edited by hand", () => {
    const added = apply({ type: "fieldAdded", key: "new", fieldType: "text", label: "Text" });
    const relabelled = blueprintDraftReducer(added, {
      type: "fieldChanged",
      key: "new",
      changes: { label: "Author name" },
    });
    expect(relabelled.fields.at(-1)?.handle).toBe("author_name");

    const edited = [
      { type: "handleEdited", key: "new", handle: "byline" },
      { type: "fieldChanged", key: "new", changes: { label: "Written by" } },
    ].reduce<BlueprintDraftState>(
      (state, action) => blueprintDraftReducer(state, action as BlueprintDraftAction),
      relabelled,
    );
    expect(edited.fields.at(-1)?.handle).toBe("byline");
  });

  it("don't change on their own for saved fields, whose content is stored under them", () => {
    const state = apply({
      type: "fieldChanged",
      key: keyOf(start, "summary"),
      changes: { label: "Intro" },
    });

    expect(handles(state)).toContain("summary");
  });

  it("can't be changed for the title", () => {
    const state = apply({ type: "handleEdited", key: keyOf(start, "title"), handle: "heading" });

    expect(handles(state)[0]).toBe("title");
  });
});

describe("reordering", () => {
  it("moves a field up or down one place", () => {
    const state = apply({ type: "fieldMovedBy", key: keyOf(start, "body"), direction: -1 });

    expect(handles(state)).toEqual(["title", "body", "summary"]);
  });

  it("moves a field to where it's dropped", () => {
    const state = apply({
      type: "fieldMovedTo",
      key: keyOf(start, "summary"),
      targetKey: keyOf(start, "body"),
    });

    expect(handles(state)).toEqual(["title", "body", "summary"]);
  });

  it("keeps the title first, whatever is moved", () => {
    const pastTitle = apply({ type: "fieldMovedBy", key: keyOf(start, "summary"), direction: -1 });
    const titleDown = apply({ type: "fieldMovedBy", key: keyOf(start, "title"), direction: 1 });

    expect(handles(pastTitle)).toEqual(handles(start));
    expect(handles(titleDown)).toEqual(handles(start));
  });
});

describe("removing fields", () => {
  it("removes any field but the title", () => {
    const state = apply(
      { type: "fieldRemoved", key: keyOf(start, "summary") },
      { type: "fieldRemoved", key: keyOf(start, "title") },
    );

    expect(handles(state)).toEqual(["title", "body"]);
  });
});

describe("saving", () => {
  it("sends only the options that apply to each type, and the title as required", () => {
    const state = apply(
      { type: "fieldChanged", key: keyOf(start, "title"), changes: { required: false } },
      {
        type: "fieldOptionsChanged",
        key: keyOf(start, "body"),
        options: { maxLength: 10, includeTime: true },
      },
    );

    const [title, summary, body] = fieldsForSaving(state.fields);

    expect(title).toEqual({
      handle: "title",
      label: "Title",
      type: "text",
      required: true,
      options: {},
    });
    expect(summary?.options).toEqual({ maxLength: 160 });
    expect(body?.options).toEqual({});
  });

  it("lists what needs fixing before the API is asked", () => {
    const state = apply(
      { type: "renamed", name: " " },
      { type: "fieldAdded", key: "a", fieldType: "select", label: "Category" },
      { type: "fieldAdded", key: "b", fieldType: "text", label: "" },
      { type: "handleEdited", key: "b", handle: "body" },
    );

    expect(blueprintProblems(state)).toEqual({
      name: "Give it a name.",
      a: "Add at least one choice.",
      b: "Give this field a label.",
      [keyOf(state, "body")]: "Another field already uses this handle.",
    });
  });

  it("matches the API's problems, reported by handle, to the right rows", () => {
    expect(problemsByKey(start.fields, { summary: "Too long" })).toEqual({
      [keyOf(start, "summary")]: "Too long",
    });
  });
});

describe("renameChoice", () => {
  it("keeps the stored value in step with the label until it's set by hand", () => {
    expect(renameChoice({ label: "News", value: "news" }, "Latest news")).toEqual({
      label: "Latest news",
      value: "latest_news",
    });
    expect(renameChoice({ label: "News", value: "n" }, "Latest news").value).toBe("n");
  });
});
