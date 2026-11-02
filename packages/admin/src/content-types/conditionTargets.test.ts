import { describe, expect, it } from "vitest";
import type { Field } from "../fields/field.types.js";
import { conditionTargets, describeConditions, operatorsFor } from "./conditionTargets.js";

const field = (handle: string, type: Field["type"], extra: Partial<Field> = {}): Field => ({
  handle,
  label: handle.charAt(0).toUpperCase() + handle.slice(1),
  type,
  required: false,
  options: {},
  ...extra,
});

const layout = field("layout", "select", {
  options: {
    choices: [
      { value: "video", label: "Video" },
      { value: "image", label: "Image" },
    ],
  },
});

describe("conditionTargets", () => {
  it("offers the fields beside this one, but not itself or fields without a value", () => {
    const targets = conditionTargets(field("url", "text"), [
      layout,
      field("url", "text"),
      field("intro", "section"),
    ]);
    expect(targets.map((target) => target.reference)).toEqual(["layout"]);
  });

  it("offers the fields around a group and the entry's own, with $parent. and $root.", () => {
    const targets = conditionTargets(
      field("name", "text"),
      [field("kind", "radio", { options: { choices: [{ value: "a", label: "A" }] } })],
      [[field("speakers_title", "text")], [layout]],
    );
    expect(targets.map((target) => [target.reference, target.where])).toEqual([
      ["kind", "beside"],
      ["$parent.speakers_title", "outside"],
      ["$root.layout", "entry"],
    ]);
  });
});

describe("operatorsFor", () => {
  it("offers comparisons that suit the field", () => {
    expect(operatorsFor(field("on", "toggle"))).toEqual(["is"]);
    expect(operatorsFor(layout)).toContain("includesAny");
    expect(operatorsFor(field("price", "number"))).toContain("greaterThan");
    expect(operatorsFor(field("tags", "checkboxes"))).toContain("contains");
    expect(operatorsFor(field("name", "text"))).toContain("doesNotContain");
  });
});

describe("describeConditions", () => {
  // A rule with no value yet read "Shown when Layout is ."
  it("asks for the value of a rule that isn't finished", () => {
    const targets = conditionTargets(field("url", "text"), [layout]);
    expect(
      describeConditions({ match: "all", rules: [{ field: "layout", operator: "is" }] }, targets),
    ).toBe("Choose what Layout should be to finish this rule.");
  });

  it("says what the conditions do in one sentence, with choice labels", () => {
    const targets = conditionTargets(field("url", "text"), [layout, field("featured", "toggle")]);
    expect(
      describeConditions(
        {
          match: "all",
          rules: [
            { field: "layout", operator: "is", value: "video" },
            { field: "featured", operator: "is", value: true },
          ],
        },
        targets,
      ),
    ).toBe("Shown when Layout is Video and Featured is On.");
    expect(
      describeConditions(
        { action: "hide", match: "any", rules: [{ field: "layout", operator: "isEmpty" }] },
        targets,
      ),
    ).toBe("Hidden when Layout is empty.");
    expect(describeConditions(undefined, targets)).toBe("Always shown.");
  });
});
