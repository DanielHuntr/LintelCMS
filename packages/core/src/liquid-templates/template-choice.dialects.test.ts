import { expect, it } from "vitest";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import { TEMPLATE_CHOICE_KEY } from "./template-choice.js";
import { findStoredTemplateChoice } from "./template-choice.repository.js";

describeOnEveryDatabase("Template choice", (handle) => {
  it("reads the choice from the copy asked for", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database, {
      data: { [TEMPLATE_CHOICE_KEY]: "draft-template" },
      publishedData: { [TEMPLATE_CHOICE_KEY]: "live-template" },
    });
    expect(await findStoredTemplateChoice(database, entry.id, "draft")).toBe("draft-template");
    expect(await findStoredTemplateChoice(database, entry.id, "published")).toBe("live-template");
  });

  it("gives nothing when no template was chosen", async () => {
    const { database } = handle;
    const entry = await addTestEntry(database);
    expect(await findStoredTemplateChoice(database, entry.id, "draft")).toBeUndefined();
    expect(await findStoredTemplateChoice(database, entry.id, "published")).toBeUndefined();
  });
});
