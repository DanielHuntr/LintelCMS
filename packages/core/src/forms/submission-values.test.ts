import { describe, expect, it } from "vitest";
import { formFieldListSchema } from "./form-fields.schema.js";
import { splitIntoSteps } from "./public-forms.service.js";
import { checkFormToken, issueFormToken } from "./spam-protection.js";
import { csvCell } from "./submissions-csv.js";
import { checkSubmissionValues, findSubmitterEmail } from "./submission-values.js";

const fields = formFieldListSchema.parse([
  { id: "1", type: "shortText", handle: "name", label: "Name", options: { minLength: 2 } },
  { id: "2", type: "email", handle: "email", label: "Email" },
  { id: "3", type: "phone", handle: "phone", label: "Phone" },
  { id: "4", type: "number", handle: "age", label: "Age", options: { min: 18, wholeNumber: true } },
  {
    id: "5",
    type: "checkboxes",
    handle: "days",
    label: "Days",
    options: { choices: ["Mon", "Tue", "Wed"] },
  },
  { id: "6", type: "date", handle: "start", label: "Start", options: { earliest: "2026-01-01" } },
  { id: "7", type: "consent", handle: "ok", label: "I agree", required: true },
  { id: "8", type: "hidden", handle: "source", label: "Source", options: { defaultValue: "site" } },
]);

describe("checking answers", () => {
  it("accepts text from an HTML form post and stores proper values", () => {
    const { values, messages } = checkSubmissionValues(fields, {
      name: "  Ana  ",
      email: "ana@example.com",
      phone: "+44 (0)20 7946 0958",
      age: "21",
      days: ["Wed", "Mon", "Mon"],
      start: "2026-03-01",
      ok: "on",
      ignored: "anything",
    });

    expect(messages).toEqual({});
    expect(values).toEqual({
      name: "Ana",
      email: "ana@example.com",
      phone: "+44 (0)20 7946 0958",
      age: 21,
      days: ["Mon", "Wed"],
      start: "2026-03-01",
      ok: true,
      source: "site",
    });
    expect(findSubmitterEmail(fields, values)).toBe("ana@example.com");
  });

  it("says what is wrong in words the visitor understands", () => {
    const { messages } = checkSubmissionValues(fields, {
      name: "A",
      email: "ana@",
      phone: "call me",
      age: "17.5",
      start: "2026-02-30",
    });

    expect(messages).toEqual({
      name: "Name needs at least 2 characters",
      email: "Email doesn't look like an email address",
      phone: "Phone doesn't look like a phone number",
      age: "Age should be a whole number",
      start: "Start should be a date, like 2026-12-31",
      ok: "Please tick this box to continue",
    });
  });

  it("splits a form into steps at each step break", () => {
    const stepped = formFieldListSchema.parse([
      { id: "a", type: "shortText", handle: "a", label: "A" },
      { id: "s", type: "step", handle: "second", label: "Second" },
      { id: "b", type: "shortText", handle: "b", label: "B" },
    ]);
    expect(splitIntoSteps(stepped)).toEqual([
      { title: null, fields: ["a"] },
      { title: "Second", fields: ["b"] },
    ]);
    expect(splitIntoSteps([])).toEqual([{ title: null, fields: [] }]);
  });
});

describe("form tokens", () => {
  const secret = "s".repeat(64);
  const openedAt = new Date("2026-11-01T09:00:00Z");

  it("tells a person from a script by how long the form was open", () => {
    const token = issueFormToken(secret, "form-1", openedAt);
    const after = (seconds: number) => new Date(openedAt.getTime() + seconds * 1000);

    expect(checkFormToken(secret, "form-1", token, after(1))).toBe("tooFast");
    expect(checkFormToken(secret, "form-1", token, after(20))).toBe("fine");
    expect(checkFormToken(secret, "form-1", token, after(25 * 60 * 60))).toBe("expired");
    expect(checkFormToken(secret, "form-2", token, after(20))).toBe("invalid");
    expect(checkFormToken(secret, "form-1", "123.abc", after(20))).toBe("invalid");
    expect(checkFormToken(secret, "form-1", undefined, after(20))).toBe("invalid");
  });
});

describe("spreadsheet cells", () => {
  it("quotes where needed and defuses formulas", () => {
    expect(csvCell("plain")).toBe("plain");
    expect(csvCell('say "hi", please')).toBe('"say ""hi"", please"');
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("-5")).toBe("'-5");
  });
});
