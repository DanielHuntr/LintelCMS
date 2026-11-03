import { describe, expect, it } from "vitest";
import type { DeliveredEntry } from "../delivery/delivery.schema.js";
import { choiceLabelsOf, entryAsItem } from "./bound-entries.js";

const service = {
  id: "e1",
  slug: "website-redesign",
  url: "/services/website-redesign",
  locale: "en-GB",
  status: "published",
  publishedAt: "2026-11-01T09:00:00.000Z",
  updatedAt: "2026-11-01T09:00:00.000Z",
  parentId: null,
  data: { title: "Website redesign", category: "web", channels: ["web", "print"], note: "web" },
} as unknown as DeliveredEntry;

// LINTEL-FUNC-013: a list bound to a select showed the stored "web", not the label "Web".
describe("entries as a list's items", () => {
  it("shows a choice field's labels, not its stored values", () => {
    const labels = choiceLabelsOf([
      {
        handle: "category",
        options: {
          choices: [
            { value: "web", label: "Web" },
            { value: "print", label: "Print" },
          ],
        },
      },
      {
        handle: "channels",
        options: {
          choices: [
            { value: "web", label: "Online" },
            { value: "print", label: "Paper" },
          ],
        },
      },
      { handle: "note", options: {} },
    ]);

    const item = entryAsItem(service, "/services/website-redesign", "en-GB", labels);

    expect(item.fields["data.category"]).toBe("Web");
    expect(item.fields["data.channels"]).toBe("Online, Paper");
    // A text field that happens to hold a choice's value is left as it is.
    expect(item.fields["data.note"]).toBe("web");
  });
});
