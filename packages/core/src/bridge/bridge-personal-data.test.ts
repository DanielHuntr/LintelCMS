import { describe, expect, it } from "vitest";
import type { DatabaseOrTransaction } from "../database/client.js";
import { bridgePersonalDataSource } from "./bridge-personal-data.js";

const website = { id: "t1", name: "My hosting", siteAddress: "https://bakery.test", secret: "s" };
const down = { id: "t2", name: "Old hosting", siteAddress: "https://gone.test", secret: "s" };
const record = {
  id: "hold:abc",
  summary: "Checkout that wasn't paid",
  email: "erin@example.com",
  date: "2026-11-04T00:00:00Z",
  data: { email: "erin@example.com" },
};

/** Details kept on a published website, reached through the companion. */
describe("details kept on a published website", () => {
  const sent: Array<{ url: string; body: string }> = [];
  const fetcher = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    sent.push({ url, body: String(init?.body) });
    if (url.includes("gone.test")) throw new Error("connection refused");
    if (url.includes("action=privacy-erase")) return Response.json({ erased: 1 });
    return Response.json({ records: [record] });
  }) as typeof fetch;

  const context = (only?: ReadonlySet<string>) => ({
    database: {} as DatabaseOrTransaction,
    tenantId: "default",
    person: { email: "erin@example.com", name: null },
    ...(only && { only }),
  });
  const source = bridgePersonalDataSource(async () => [website, down], fetcher);

  it("lists what each website holds, and says when one can't be reached", async () => {
    const items = await source.hooks?.find(context());
    expect(items?.[0]).toMatchObject({
      id: "t1:hold:abc",
      email: "erin@example.com",
      summary: "Checkout that wasn't paid, on My hosting",
    });
    expect(items?.[1]?.summary).toContain("Old hosting");
    expect(items?.[1]?.summary).toContain("couldn't be reached");
  });

  it("hands over what it found", async () => {
    const rows = await source.hooks?.export(context());
    expect(rows?.[0]).toMatchObject({ website: "My hosting", email: "erin@example.com" });
  });

  it("erases only what was ticked, and doesn't claim a website it couldn't reach", async () => {
    sent.length = 0;
    const outcome = await source.hooks?.erase(context(new Set(["t1:hold:abc"])));
    expect(outcome).toMatchObject({ deleted: 0, anonymised: 1, kept: 0 });
    expect(sent.some((call) => call.url.includes("gone.test"))).toBe(false);
    const erasing = sent.find((call) => call.url.includes("action=privacy-erase"));
    expect(JSON.parse(erasing?.body ?? "{}")).toEqual({ ids: ["hold:abc"] });

    const everything = await source.hooks?.erase(context());
    expect(everything).toMatchObject({ anonymised: 1, kept: 1 });
    expect(everything?.explanation).toContain("Old hosting");
  });
});
