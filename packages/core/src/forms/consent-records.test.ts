import { describe, expect, it } from "vitest";
import { recordConsents } from "./consent-records.js";
import type { FormField } from "./form-fields.schema.js";

const field = (
  type: FormField["type"],
  handle: string,
  label: string,
  helpText = "",
): FormField => ({
  id: handle,
  type,
  handle,
  label,
  helpText,
  placeholder: "",
  required: false,
  options: {},
});

describe("consent records", () => {
  it("keeps the exact words of each ticked box, with the time and page", () => {
    const fields = [
      field("shortText", "name", "Your name"),
      field("consent", "reply", "Keep my details to reply to me"),
      field("consent", "news", "Send me the newsletter", "Once a month. Unsubscribe any time."),
      field("consent", "offers", "Send me offers"),
    ];
    const now = new Date("2026-11-03T10:00:00Z");

    expect(
      recordConsents(
        fields,
        { name: "Grace", reply: true, news: true },
        "https://bakery.test/",
        now,
      ),
    ).toEqual([
      {
        field: "reply",
        wording: "Keep my details to reply to me",
        givenAt: "2026-11-03T10:00:00.000Z",
        page: "https://bakery.test/",
      },
      {
        field: "news",
        wording: "Send me the newsletter\nOnce a month. Unsubscribe any time.",
        givenAt: "2026-11-03T10:00:00.000Z",
        page: "https://bakery.test/",
      },
    ]);
  });
});
