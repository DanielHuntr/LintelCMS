import { describe, expect, it } from "vitest";
import type { LoadedAddon } from "../addons/load-addons.js";
import { describeAddonForReview } from "../addons/addon-review.js";
import { definePlugin } from "../plugins/plugin-definition.js";
import { listPersonalDataSources, type PrivacyContext } from "./personal-data-sources.js";

/** An add-on author says what's personal once; the data map has to find it either way. */

const tables = [
  {
    name: "votes",
    purpose: "Each visitor's rating.",
    columns: [
      { name: "email", purpose: "Who rated it.", personalData: true },
      { name: "stars", purpose: "The rating." },
    ],
  },
];

const personalData = {
  tables: [{ name: "votes", columns: [{ name: "email", personalData: true }, { name: "stars" }] }],
};

const noDeclarations = { tables: [], publicRoutes: [], jobs: [], events: [], hosts: [] };

function sourceFor(plugin: ReturnType<typeof definePlugin>, manifest?: Record<string, unknown>) {
  const addons = manifest
    ? [{ plugin, addonPackage: { manifest: { ...noDeclarations, ...manifest } } }]
    : [];
  const context = {
    plugins: [plugin],
    addons: addons as unknown as LoadedAddon[],
    enabledPlugins: [plugin.id],
  } as unknown as PrivacyContext;
  return listPersonalDataSources(context).find((source) => source.pluginId === plugin.id);
}

const addon = definePlugin({ id: "ratings", name: "Ratings", description: "Star ratings." });

describe("an add-on's personal data in the data map", () => {
  const expected = [{ name: "votes", columns: ["email"] }];

  it("comes from `tables` in package.json", () => {
    expect(sourceFor(addon, { tables })?.tables).toEqual(expected);
  });

  it("comes from `personalData` in package.json", () => {
    expect(sourceFor(addon, { personalData })?.tables).toEqual(expected);
  });

  it("comes from `declares` in the code", () => {
    const declared = definePlugin({ ...addon, declares: { tables } });
    expect(sourceFor(declared)?.tables).toEqual(expected);
  });

  it("comes from `personalData` in the code", () => {
    const declared = definePlugin({ ...addon, personalData });
    expect(sourceFor(declared)?.tables).toEqual(expected);
  });

  it("lists a column once when both say so, and adds what only one says", () => {
    const both = {
      tables,
      personalData: {
        tables: [
          { name: "votes", columns: [{ name: "email", personalData: true }] },
          { name: "votes_notes", columns: [{ name: "note", personalData: true }] },
        ],
      },
    };
    expect(sourceFor(addon, both)?.tables).toEqual([
      ...expected,
      { name: "votes_notes", columns: ["note"] },
    ]);
  });

  it("keeps the hooks from `personalData` with columns from `tables`", async () => {
    const hooks = {
      find: async () => [],
      export: async () => [],
      erase: async () => ({ deleted: 0 }),
    };
    const searchable = definePlugin({ ...addon, personalData: { tables: [], ...hooks } });
    const source = sourceFor(searchable, { tables });
    expect(source?.tables).toEqual(expected);
    expect(source?.hooks).not.toBeNull();
  });

  it("still says so when an add-on hasn't said anything", () => {
    const quiet = [{ ...tables[0], columns: [{ name: "stars", purpose: "The rating." }] }];
    const withTable = definePlugin({
      ...addon,
      database: { tables: [{} as never], migrationsFolder: "migrations" },
    });
    expect(sourceFor(withTable, { tables: quiet })?.notSearchableReason).toMatch(
      /hasn't said whether/,
    );
  });
});

describe("the review before installing", () => {
  it("names personal columns said in either place", () => {
    const manifest = { ...noDeclarations, tables, personalData };
    const review = describeAddonForReview({ manifest, origin: {} } as never);
    expect(review).toContain("    Personal data: email");
    const unmarked = [{ ...tables[0], columns: [{ name: "email", purpose: "Who rated it." }] }];
    const fromKey = describeAddonForReview({
      manifest: { ...noDeclarations, tables: unmarked, personalData },
      origin: {},
    } as never);
    expect(fromKey).toContain("    Personal data: email");
  });

  it("doesn't say it keeps nothing when only `personalData` names the table", () => {
    const review = describeAddonForReview({
      manifest: { ...noDeclarations, personalData },
      origin: {},
    } as never);
    expect(review).not.toContain("  Nothing of its own, as it says, besides settings.");
    expect(review).toContain("  votes:");
    expect(review).toContain("    Personal data: email");
  });
});
