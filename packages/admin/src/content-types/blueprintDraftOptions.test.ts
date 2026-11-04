import { describe, expect, it } from "vitest";
import {
  blueprintDraftReducer,
  blueprintProblems,
  draftFromFields,
  optionsForType,
} from "./blueprintDraft.js";

describe("options for the newer fieldtypes", () => {
  it("keeps only the options each type uses", () => {
    const everything = {
      maxLength: 10,
      maxItems: 3,
      swatches: ["#ff0000"],
      taxonomy: "tags",
      collections: ["posts"],
      choices: [{ value: "a", label: "A" }],
    };

    expect(optionsForType("markdown", everything)).toEqual({ maxLength: 10 });
    expect(optionsForType("list", everything)).toEqual({ maxItems: 3 });
    expect(optionsForType("colour", everything)).toEqual({ swatches: ["#ff0000"] });
    expect(optionsForType("terms", everything)).toEqual({ taxonomy: "tags", maxItems: 3 });
    expect(optionsForType("entries", everything)).toEqual({ collections: ["posts"], maxItems: 3 });
    expect(optionsForType("email", everything)).toEqual({});
  });

  it("asks for a taxonomy before a terms field can be saved", () => {
    const added = blueprintDraftReducer(draftFromFields("Banner", []), {
      type: "fieldAdded",
      key: "k1",
      fieldType: "terms",
      label: "Tags",
    });

    expect(blueprintProblems(added)).toEqual({ k1: "Choose a group to pick terms from." });
    const chosen = blueprintDraftReducer(added, {
      type: "fieldOptionsChanged",
      key: "k1",
      options: { taxonomy: "tags" },
    });
    expect(blueprintProblems(chosen)).toEqual({});
  });
});
