import { describe, expect, it } from "vitest";
import { fieldConditionsSchema, type FieldConditionsInput } from "./conditions.schema.js";
import {
  innerScope,
  isFieldVisible,
  referencedFields,
  referenceStart,
  resolveFieldReference,
  ruleMatches,
  topScope,
} from "./evaluate-conditions.js";

const entry = topScope({
  layout: "video",
  title: "Summer Fair",
  tags: ["news", "events"],
  price: 12,
  featured: true,
  date: "2026-07-01",
  empty_text: "  ",
  address: { country: "uk", city: "Leeds" },
});

const show = (rules: FieldConditionsInput["rules"], match: "all" | "any" = "all") =>
  isFieldVisible({ action: "show", match, rules }, entry);

describe("operators", () => {
  it("is and is not compare text, numbers and switches as text", () => {
    expect(ruleMatches({ field: "layout", operator: "is", value: "video" }, entry)).toBe(true);
    expect(ruleMatches({ field: "layout", operator: "is", value: "image" }, entry)).toBe(false);
    expect(ruleMatches({ field: "price", operator: "is", value: "12" }, entry)).toBe(true);
    expect(ruleMatches({ field: "featured", operator: "is", value: true }, entry)).toBe(true);
    expect(ruleMatches({ field: "layout", operator: "isNot", value: "image" }, entry)).toBe(true);
    expect(ruleMatches({ field: "missing", operator: "isNot", value: "x" }, entry)).toBe(true);
  });

  it("treats a field holding several values as 'is' any one of them", () => {
    expect(ruleMatches({ field: "tags", operator: "is", value: "news" }, entry)).toBe(true);
    expect(ruleMatches({ field: "tags", operator: "is", value: ["events", "news"] }, entry)).toBe(
      true,
    );
    expect(ruleMatches({ field: "tags", operator: "is", value: ["news"] }, entry)).toBe(false);
  });

  it("counts an untouched toggle as off", () => {
    expect(ruleMatches({ field: "missing", operator: "is", value: false }, entry)).toBe(true);
  });

  it("contains and doesn't contain look inside text and lists", () => {
    expect(ruleMatches({ field: "title", operator: "contains", value: "fair" }, entry)).toBe(true);
    expect(ruleMatches({ field: "tags", operator: "contains", value: "events" }, entry)).toBe(true);
    expect(ruleMatches({ field: "tags", operator: "doesNotContain", value: "sport" }, entry)).toBe(
      true,
    );
    expect(ruleMatches({ field: "price", operator: "contains", value: "1" }, entry)).toBe(false);
  });

  it("is empty and is not empty", () => {
    expect(ruleMatches({ field: "empty_text", operator: "isEmpty" }, entry)).toBe(true);
    expect(ruleMatches({ field: "missing", operator: "isEmpty" }, entry)).toBe(true);
    expect(ruleMatches({ field: "tags", operator: "isNotEmpty" }, entry)).toBe(true);
    expect(ruleMatches({ field: "featured", operator: "isNotEmpty" }, entry)).toBe(true);
  });

  it("greater than and less than compare numbers, dates and list lengths", () => {
    expect(ruleMatches({ field: "price", operator: "greaterThan", value: 10 }, entry)).toBe(true);
    expect(ruleMatches({ field: "price", operator: "lessThan", value: "10" }, entry)).toBe(false);
    expect(ruleMatches({ field: "date", operator: "lessThan", value: "2026-12-25" }, entry)).toBe(
      true,
    );
    expect(ruleMatches({ field: "tags", operator: "greaterThan", value: 1 }, entry)).toBe(true);
    expect(ruleMatches({ field: "missing", operator: "greaterThan", value: 1 }, entry)).toBe(false);
    expect(ruleMatches({ field: "missing", operator: "lessThan", value: 1 }, entry)).toBe(false);
  });

  it("includes any matches one shared value", () => {
    expect(
      ruleMatches({ field: "tags", operator: "includesAny", value: ["sport", "news"] }, entry),
    ).toBe(true);
    expect(
      ruleMatches({ field: "layout", operator: "includesAny", value: ["video", "audio"] }, entry),
    ).toBe(true);
    expect(ruleMatches({ field: "tags", operator: "includesAny", value: ["sport"] }, entry)).toBe(
      false,
    );
  });
});

describe("all, any, show and hide", () => {
  const matching = { field: "layout", operator: "is", value: "video" } as const;
  const failing = { field: "price", operator: "greaterThan", value: 100 } as const;

  it("shows when all rules match, or any one with match: any", () => {
    expect(show([matching])).toBe(true);
    expect(show([matching, failing])).toBe(false);
    expect(show([matching, failing], "any")).toBe(true);
    expect(show([failing], "any")).toBe(false);
  });

  it("hides instead with action: hide", () => {
    expect(isFieldVisible({ action: "hide", rules: [matching] }, entry)).toBe(false);
    expect(isFieldVisible({ action: "hide", rules: [failing] }, entry)).toBe(true);
  });

  it("shows a field without conditions", () => {
    expect(isFieldVisible(undefined, entry)).toBe(true);
    expect(isFieldVisible(null, entry)).toBe(true);
  });
});

describe("references across groups, repeaters and blocks", () => {
  const row = innerScope({ kind: "speaker", name: "Ada" }, entry);
  const nested = innerScope({ detail: "long" }, row);

  it("looks beside the field first", () => {
    expect(resolveFieldReference("kind", row)).toBe("speaker");
    expect(resolveFieldReference("layout", row)).toBeUndefined();
  });

  it("reads into a group's values with a dot", () => {
    expect(resolveFieldReference("address.country", entry)).toBe("uk");
    expect(resolveFieldReference("address.country.code", entry)).toBeUndefined();
  });

  it("looks out a level with $parent. and to the entry with $root.", () => {
    expect(resolveFieldReference("$parent.layout", row)).toBe("video");
    expect(resolveFieldReference("$parent.kind", nested)).toBe("speaker");
    expect(resolveFieldReference("$parent.$parent.layout", nested)).toBe("video");
    expect(resolveFieldReference("$root.layout", nested)).toBe("video");
    expect(resolveFieldReference("$parent.layout", entry)).toBeUndefined();
  });

  it("evaluates a rule inside a row against its parent", () => {
    expect(
      isFieldVisible(
        {
          match: "all",
          rules: [
            { field: "kind", operator: "is", value: "speaker" },
            { field: "$root.layout", operator: "is", value: "video" },
          ],
        },
        row,
      ),
    ).toBe(true);
  });

  it("describes where a reference starts", () => {
    expect(referenceStart("layout")).toEqual({ levelsUp: 0, path: ["layout"] });
    expect(referenceStart("$parent.$parent.a.b")).toEqual({ levelsUp: 2, path: ["a", "b"] });
    expect(referenceStart("$root.layout")).toEqual({ levelsUp: "root", path: ["layout"] });
  });
});

describe("the stored format", () => {
  it("fills in show, all and clearing hidden values", () => {
    const parsed = fieldConditionsSchema.parse({
      rules: [{ field: "layout", operator: "is", value: "video" }],
    });
    expect(parsed).toEqual({
      action: "show",
      match: "all",
      keepHiddenValues: false,
      rules: [{ field: "layout", operator: "is", value: "video" }],
    });
    expect(referencedFields(parsed)).toEqual(["layout"]);
  });

  it("explains rules that can't work", () => {
    const problem = (conditions: unknown) =>
      fieldConditionsSchema.safeParse(conditions).error?.issues[0]?.message;
    expect(problem({ rules: [] })).toBe("Conditions need at least one rule");
    expect(problem({ rules: [{ field: "layout", operator: "is" }] })).toBe(
      'The rule on "layout" needs a value to compare with',
    );
    expect(problem({ rules: [{ field: "tags", operator: "includesAny", value: "x" }] })).toBe(
      'The rule on "tags" needs a list of values for "includes any"',
    );
    expect(problem({ rules: [{ field: "Bad Name", operator: "isEmpty" }] })).toContain(
      "should be a handle",
    );
    expect(problem({ rules: [{ field: "a", operator: "equals", value: "x" }] })).toContain(
      "operator should be one of",
    );
    expect(problem({ rules: [{ field: "a", operator: "isEmpty" }] })).toBeUndefined();
  });
});
