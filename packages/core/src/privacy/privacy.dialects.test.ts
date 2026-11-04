import { expect, it } from "vitest";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import {
  findPrivacyPage,
  insertPrivacyRequest,
  listPrivacyRequests,
} from "./privacy.repository.js";

const TENANT = "default";

describeOnEveryDatabase("Privacy requests", (handle) => {
  it("keeps a record of requests", async () => {
    const { database } = handle;
    await insertPrivacyRequest(database, { kind: "export" as never, parts: [] });
    expect(await listPrivacyRequests(database, TENANT, 10)).toHaveLength(1);
  });

  it("finds the chosen privacy page, or one with privacy in its address", async () => {
    const { database } = handle;
    const chosen = await addTestEntry(database, { publishedData: { title: "Terms" } });
    const bySlug = await addTestEntry(database, {
      slug: "Our-Privacy-Policy",
      publishedData: { title: "Privacy" },
    });
    await addTestEntry(database, { slug: "privacy-draft" });
    expect((await findPrivacyPage(database, TENANT, chosen.id))?.id).toBe(chosen.id);
    const found = await findPrivacyPage(database, TENANT, null);
    expect(found).toMatchObject({ id: bySlug.id, publishedData: { title: "Privacy" } });
  });
});
