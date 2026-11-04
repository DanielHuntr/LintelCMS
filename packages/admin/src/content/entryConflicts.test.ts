import { describe, expect, it } from "vitest";
import {
  entryDraftReducer,
  type EntryDraft,
  findDraftClashes,
  initialDraftState,
  rebaseDraft,
} from "./entryDraft.js";
import { samplePost } from "./testEntries.js";

const saved: EntryDraft = {
  data: { title: "Home", summary: "Fresh bread", phone: "123" },
  slug: "home",
  parentId: null,
};

const theirs = (data: Record<string, unknown>, rest: Partial<EntryDraft> = {}) =>
  samplePost({ data: { ...saved.data, ...data }, slug: saved.slug, parentId: null, ...rest });

describe("someone else saved while this person was editing", () => {
  it("takes their change to a field this person left alone", () => {
    const mine = { ...saved, data: { ...saved.data, title: "Welcome" } };
    const rebased = rebaseDraft(saved, mine, theirs({ summary: "Sourdough" }));
    expect(rebased.data).toEqual({ title: "Welcome", summary: "Sourdough", phone: "123" });
  });

  it("does not call that a clash", () => {
    const mine = { ...saved, data: { ...saved.data, title: "Welcome" } };
    expect(findDraftClashes(saved, mine, theirs({ summary: "Sourdough" }))).toEqual([]);
  });

  it("finds the same field changed to two things", () => {
    const mine = { ...saved, data: { ...saved.data, title: "Welcome" } };
    expect(findDraftClashes(saved, mine, theirs({ title: "Hello" }))).toEqual(["title"]);
  });

  it("does not call it a clash when both typed the same", () => {
    const mine = { ...saved, data: { ...saved.data, title: "Welcome" } };
    expect(findDraftClashes(saved, mine, theirs({ title: "Welcome" }))).toEqual([]);
  });

  it("finds the address changed twice", () => {
    const mine = { ...saved, slug: "mine" };
    expect(findDraftClashes(saved, mine, theirs({}, { slug: "theirs" }))).toEqual(["slug"]);
  });

  it("keeps this person's value unless they choose the other", () => {
    const mine = { ...saved, data: { ...saved.data, title: "Mine", phone: "456" } };
    const latest = theirs({ title: "Theirs" });
    expect(rebaseDraft(saved, mine, latest).data.title).toBe("Mine");
    const chosen = rebaseDraft(saved, mine, latest, ["title"]);
    expect(chosen.data.title).toBe("Theirs");
    expect(chosen.data.phone).toBe("456");
  });

  it("leaves the field editors alone when nobody asked for it", () => {
    const state = initialDraftState(samplePost({ data: saved.data }));
    const next = entryDraftReducer(state, { type: "rebased", entry: theirs({ summary: "New" }) });
    expect(next.formVersion).toBe(state.formVersion);
    expect(next.current.data.summary).toBe("New");
    expect(next.saved.data.summary).toBe("New");
  });

  it("starts field editors afresh after a choice", () => {
    const state = initialDraftState(samplePost({ data: saved.data }));
    const next = entryDraftReducer(state, {
      type: "rebased",
      entry: theirs({ title: "Theirs" }),
      useTheirs: ["title"],
      redraw: true,
    });
    expect(next.formVersion).toBe(state.formVersion + 1);
  });
});
