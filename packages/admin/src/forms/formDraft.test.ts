import { describe, expect, it } from "vitest";
import {
  addField,
  cleanChoices,
  findFieldProblems,
  moveFieldBy,
  moveFieldTo,
  newField,
  relabelField,
  removeField,
  stepsOf,
} from "./formDraft.js";
import type { FormField } from "./forms.types.js";

function fieldsNamed(...labels: string[]): FormField[] {
  return labels.reduce<FormField[]>(
    (fields, label) => [...fields, newField("shortText", label, fields)],
    [],
  );
}

const labelsOf = (fields: readonly FormField[]) => fields.map((field) => field.label);

describe("editing a form's fields", () => {
  it("gives new fields a handle from the label that no other field has", () => {
    const fields = fieldsNamed("Your name", "Your name");
    expect(fields.map((field) => field.handle)).toEqual(["your_name", "your_name_2"]);
    expect(newField("consent", "I agree", []).required).toBe(true);
    expect(newField("dropdown", "Size", []).options.choices).toHaveLength(2);
  });

  it("adds after a field, moves by one or by dragging, and removes", () => {
    const fields = fieldsNamed("A", "B", "C");
    const [a, b, c] = fields;
    const added = addField(fields, newField("email", "D", fields), a?.id);
    expect(labelsOf(added)).toEqual(["A", "D", "B", "C"]);

    expect(labelsOf(moveFieldBy(fields, c?.id ?? "", -1))).toEqual(["A", "C", "B"]);
    expect(labelsOf(moveFieldBy(fields, a?.id ?? "", -1))).toEqual(["A", "B", "C"]);
    expect(labelsOf(moveFieldTo(fields, a?.id ?? "", c?.id ?? ""))).toEqual(["B", "C", "A"]);
    expect(labelsOf(removeField(fields, b?.id ?? ""))).toEqual(["A", "C"]);
  });

  it("keeps the handle following the label until it's set by hand", () => {
    const fields = fieldsNamed("Name", "Email");
    const id = fields[0]?.id ?? "";
    expect(relabelField(fields, id, "Full name", true)[0]?.handle).toBe("full_name");
    expect(relabelField(fields, id, "Email", true)[0]?.handle).toBe("email_2");
    expect(relabelField(fields, id, "Full name", false)[0]?.handle).toBe("name");
  });

  it("finds problems before saving", () => {
    const fields = fieldsNamed("Name", "Other");
    const broken = [
      { ...fields[0], label: "" } as FormField,
      { ...fields[1], handle: "name" } as FormField,
      { ...newField("dropdown", "Pick", fields), options: { choices: [" "] } },
      newField("shortText", "Fine", fields),
    ];
    expect(Object.values(findFieldProblems(broken))).toEqual([
      "forms.problem.noLabel",
      "forms.problem.sameHandle",
      "forms.problem.noChoices",
    ]);
    expect(cleanChoices([" Small ", "", "Small", "Large"])).toEqual(["Small", "Large"]);
  });

  it("splits fields into steps", () => {
    const fields = [
      newField("step", "About you", []),
      ...fieldsNamed("Name"),
      newField("step", "Details", []),
    ];
    expect(stepsOf(fields).map((step) => step.title)).toEqual(["About you"]);
    expect(stepsOf([...fields, ...fieldsNamed("Notes")]).map((step) => step.title)).toEqual([
      "About you",
      "Details",
    ]);
  });
});
