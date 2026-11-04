import { expect, it } from "vitest";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { addTestEntry, describeOnEveryDatabase } from "../testing/every-database.js";
import { searchEntries } from "./search.repository.js";
import { searchWords } from "./search-terms.js";
import { documentHasWords } from "./word-starts.js";

/**
 * The same searches on every database, so word matching can't drift apart. `body` is the text
 * of an entry's field, `search` what was typed, and `finds` whether Postgres finds it.
 */
const CASES = [
  // The start of a word, and never the inside of one.
  { body: "We offer support all day", search: "port", finds: false },
  { body: "We offer support all day", search: "sup", finds: true },
  { body: "We offer support all day", search: "support", finds: true },
  { body: "Sailing from the port at dawn", search: "port", finds: true },
  { body: "A portrait of the harbour", search: "port", finds: true },
  { body: "Fresh bread daily", search: "fresh dai", finds: true },
  { body: "Fresh bread daily", search: "fresh cake", finds: false },
  { body: "Fresh bread daily", search: "read", finds: false },
  // Case and accents.
  { body: "SHOUTING ABOUT BREAD", search: "bread", finds: true },
  { body: "L'ÉCOLE d'été", search: "école", finds: true },
  { body: "Café crème", search: "cafe", finds: false },
  { body: "Cafe creme", search: "café", finds: false },
  { body: "Straße der Freiheit", search: "straße", finds: true },
  { body: "Привет мир", search: "мир", finds: true },
  { body: "日本語 テキスト", search: "テキ", finds: true },
  // What separates words.
  { body: "port—harbour", search: "harbour", finds: true },
  { body: "(port), “harbour”; pier.", search: "pier", finds: true },
  { body: "well_known fact", search: "known", finds: true },
  { body: "a support-port tool", search: "port", finds: true },
  { body: "non-port-thing", search: "thing", finds: true },
  { body: "don't stop", search: "t", finds: true },
  { body: "Rock&Roll", search: "roll", finds: true },
  { body: "#hashtag @handle", search: "handle", finds: true },
  { body: "line one\nline two\ttabbed", search: "tabbed", finds: true },
  // Things Postgres keeps whole.
  { body: "Write to ada@example.com today", search: "example", finds: false },
  { body: "Write to ada@example.com today", search: "ada", finds: true },
  { body: "See example.com for more", search: "example", finds: true },
  { body: "See example.com for more", search: "com", finds: false },
  { body: "See https://www.example.com/a?b=1 for more", search: "www", finds: true },
  { body: "See https://www.example.com/a?b=1 for more", search: "https", finds: false },
  { body: "Open report.pdf first", search: "pdf", finds: false },
  { body: "Open a/b first", search: "b", finds: false },
  { body: "Pi is 3.14 or so", search: "14", finds: false },
  { body: "Version 1.2.3 is out", search: "2", finds: false },
  { body: "Version 1.2.3 is out", search: "1", finds: true },
  // Numbers.
  { body: "Open 2026-11-04 only", search: "11", finds: false },
  { body: "Open 2026-11-04 only", search: "2026", finds: true },
  { body: "Sold 1,000 loaves", search: "000", finds: true },
  { body: "Room abc123 upstairs", search: "abc", finds: true },
  { body: "Room abc123 upstairs", search: "123", finds: false },
  { body: "At 12:30 sharp", search: "30", finds: true },
  // HTML in a value.
  { body: "<p class='port'>Harbour</p>", search: "port", finds: false },
  { body: "<b>bold</b> text", search: "bold", finds: true },
  { body: "foo&amp;bar", search: "amp", finds: false },
];

describeOnEveryDatabase("Word matching in search", (handle) => {
  const search = async (typed: string, limit = 10) => {
    const rows = await searchEntries(handle.database, DEFAULT_TENANT_ID, {
      words: searchWords(typed),
      phrase: typed,
      limit,
      siteIds: null,
    });
    return rows.map((row) => row.slug);
  };

  it.each(CASES)('"$search" in "$body": $finds', async ({ body, search: typed, finds }) => {
    await addTestEntry(handle.database, {
      slug: "entry",
      data: { title: "Untitled", body: { type: "text", text: body } },
    });
    expect(await search(typed)).toEqual(finds ? ["entry"] : []);
  });

  it("reads values, never keys", async () => {
    await addTestEntry(handle.database, {
      slug: "entry",
      data: { title: "Untitled", port: "harbour", list: [{ port: ["support"] }] },
    });
    expect(await search("port")).toEqual([]);
    expect(await search("harbour")).toEqual(["entry"]);
  });

  it("finds the start of a word in a slug, and each part of it", async () => {
    await addTestEntry(handle.database, {
      slug: "opening-hours",
      data: { title: "Untitled" },
    });
    expect(await search("hour")).toEqual(["opening-hours"]);
    expect(await search("pening")).toEqual([]);
  });

  it("still finds the phrase inside a title, as a search box should", async () => {
    await addTestEntry(handle.database, { slug: "help", data: { title: "Customer Support" } });
    expect(await search("port")).toEqual(["help"]);
  });

  it("puts a title before a slug, and a slug before a value", async () => {
    await addTestEntry(handle.database, {
      slug: "a",
      data: { title: "Untitled", body: "On the harbour" },
    });
    await addTestEntry(handle.database, { slug: "harbour-b", data: { title: "Untitled" } });
    await addTestEntry(handle.database, { slug: "c", data: { title: "Harbour" } });
    expect(await search("harbour")).toEqual(["c", "harbour-b", "a"]);
  });

  it("keeps to the limit, and looks past rows that only look like matches", async () => {
    for (let number = 0; number < 120; number += 1) {
      await addTestEntry(handle.database, {
        slug: `support-${number}`.replace("support", "help"),
        data: { title: "Untitled", body: "Our support team" },
      });
    }
    await addTestEntry(handle.database, {
      slug: "harbour",
      data: { title: "Untitled", body: "The old port" },
    });
    await addTestEntry(handle.database, {
      slug: "pier",
      data: { title: "Untitled", body: "A new port" },
    });
    expect(await search("port", 1)).toHaveLength(1);
    expect((await search("port", 5)).sort()).toEqual(["harbour", "pier"]);
  });
});

it("gives the same answers without a database", () => {
  for (const { body, search, finds } of CASES) {
    const document = { title: "", slug: "entry", values: { body } };
    expect(documentHasWords(document, searchWords(search)), `${search} in ${body}`).toBe(finds);
  }
});
