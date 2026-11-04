import { z } from "zod";
import type {
  FoundPersonalData,
  PersonalDataHookContext,
  PersonalDataHooks,
} from "../privacy/personal-data-declaration.js";
import type { PersonalDataSource } from "../privacy/personal-data-sources.js";
import { callBridge } from "./bridge-pull.service.js";

/**
 * What a published website keeps for itself until Lintel collects it: checkouts started there
 * (a hold has a name, email and address, and stays for 30 days in case a slow payment arrives),
 * and paid orders and form entries not yet collected. Find a person reaches them through the
 * companion, with signed requests, so a request about someone doesn't stop at Lintel's database.
 *
 * A website may be switched off or out of reach. That is said rather than skipped, so nobody
 * thinks they erased what they didn't.
 */

export interface BridgeWebsite {
  id: string;
  name: string;
  siteAddress: string;
  secret: string;
}

const recordsSchema = z.object({
  records: z.array(
    z.object({
      id: z.string(),
      summary: z.string(),
      email: z.string(),
      date: z.string().nullable(),
      data: z.record(z.string(), z.unknown()),
    }),
  ),
});
const erasedSchema = z.object({ erased: z.number() });

type WebsiteRecords = Array<{
  website: BridgeWebsite;
  records: z.output<typeof recordsSchema>["records"] | null;
}>;

export function bridgePersonalDataSource(
  listWebsites: () => Promise<BridgeWebsite[]>,
  fetcher: typeof fetch = fetch,
): PersonalDataSource {
  const look = async ({ person, only }: PersonalDataHookContext): Promise<WebsiteRecords> => {
    const found: WebsiteRecords = [];
    for (const website of await listWebsites()) {
      // Nothing ticked here: no reason to ask it.
      if (only && ![...only].some((id) => id.startsWith(itemId(website, "")))) continue;
      try {
        const answer = await callBridge(
          website.siteAddress,
          website.secret,
          "privacy-find",
          JSON.stringify(person),
          fetcher,
        );
        const { records } = recordsSchema.parse(answer);
        found.push({
          website,
          records: records.filter((record) => !only || only.has(itemId(website, record.id))),
        });
      } catch {
        found.push({ website, records: null });
      }
    }
    return found;
  };

  const hooks: PersonalDataHooks = {
    choosesRecords: true,
    async find(context) {
      return (await look(context)).flatMap(({ website, records }): FoundPersonalData[] =>
        records === null
          ? [
              {
                id: itemId(website, "unreachable"),
                summary: `${website.name} couldn't be reached, so it wasn't searched`,
                date: null,
              },
            ]
          : records.map((record) => ({
              id: itemId(website, record.id),
              summary: `${record.summary}, on ${website.name}`,
              email: record.email,
              date: record.date,
            })),
      );
    },
    async export(context) {
      return (await look(context)).flatMap(({ website, records }) =>
        (records ?? []).map((record) => ({
          website: website.name,
          kind: record.summary,
          date: record.date,
          ...record.data,
        })),
      );
    },
    async erase(context) {
      let anonymised = 0;
      const missed: string[] = [];
      for (const { website, records } of await look(context)) {
        if (records === null) {
          missed.push(website.name);
          continue;
        }
        if (records.length === 0) continue;
        try {
          const answer = await callBridge(
            website.siteAddress,
            website.secret,
            "privacy-erase",
            JSON.stringify({ ids: records.map((record) => record.id) }),
            fetcher,
          );
          anonymised += erasedSchema.parse(answer).erased;
        } catch {
          missed.push(website.name);
        }
      }
      return {
        deleted: 0,
        anonymised,
        kept: missed.length,
        explanation:
          missed.length > 0
            ? `${missed.join(", ")} couldn't be reached, so nothing was erased there. Try again when it's back.`
            : undefined,
      };
    },
  };

  return {
    id: "published-websites",
    name: "Published websites",
    description:
      "Checkouts started on a website published as files, and orders and form entries it hasn't handed to Lintel yet.",
    from: "core",
    pluginId: null,
    tables: [],
    erasure:
      "Form entries are deleted. Orders and checkouts stay without the name, email, address or phone.",
    hooks,
    notSearchableReason: null,
  };
}

function itemId(website: BridgeWebsite, recordId: string): string {
  return `${website.id}:${recordId}`;
}
