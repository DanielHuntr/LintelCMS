import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { SiteImport, SiteImportReport, SiteImportMapping } from "./siteImport.api.js";
import { SiteImportPage } from "./SiteImportPage.js";

const none = { done: 0, skipped: 0, failed: 0 };

const mapping: SiteImportMapping = {
  contentTypes: {
    "blog-posts": {
      collection: "blog_posts",
      create: true,
      name: "Blog Posts",
      fields: { "Post body": "post_body", Featured: "featured" },
    },
  },
  taxonomies: {},
  media: "import",
  mediaHosts: [],
  drafts: "import",
  redirects: true,
  menus: true,
  globals: true,
};

const ready: SiteImport = {
  id: "s1",
  source: "webflow",
  filename: "Fernleaf - Blog Posts.csv",
  siteTitle: "Fernleaf",
  siteAddress: "",
  status: "ready",
  found: {
    contentTypes: [
      {
        key: "blog-posts",
        name: "Blog Posts",
        handle: "blog_posts",
        structure: "dated",
        entries: 4,
        fields: [
          { key: "Post body", label: "Post body", kind: "richText" },
          { key: "Featured", label: "Featured", kind: "toggle" },
        ],
      },
    ],
    taxonomies: [],
    media: 2,
    menus: 0,
    globals: 0,
    notes: ["Reference fields come in as text."],
  },
  mapping: null,
  mediaHosts: ["cdn.prod.website-files.com"],
  progress: { done: 0, total: 7 },
  hasArchive: false,
  lastError: null,
  createdAt: "2026-11-01T09:00:00Z",
  completedAt: null,
};

const dryRun: SiteImportReport = {
  dryRun: true,
  counts: {
    taxonomy: none,
    term: none,
    contentType: { done: 1, skipped: 0, failed: 0 },
    media: { done: 2, skipped: 0, failed: 0 },
    entry: { done: 4, skipped: 0, failed: 0 },
    menu: none,
    global: none,
  },
  createdTypes: ["Blog Posts"],
  designedPages: [],
  renamedSlugs: [],
  redirectsSuggested: 2,
  fieldsLeftOut: [],
  notes: ["Reference fields come in as text."],
  problems: [],
};

describe("moving a site from Webflow", () => {
  it("previews what it found, maps fields, dry-runs and starts", async () => {
    const { calls } = mockApi(({ method, url }) => {
      if (url.pathname === "/site-imports/s1" && method === "GET")
        return { ...ready, report: null };
      if (url.pathname === "/site-imports/s1/mapping" && method === "GET") {
        return {
          import: ready,
          collections: [{ handle: "pages", name: "Pages", structure: "tree" }],
          collectionFields: { pages: [] },
          taxonomies: [],
          suggested: mapping,
        };
      }
      if (url.pathname === "/site-imports/s1/mapping") return { mapping };
      if (url.pathname === "/site-imports/s1/dry-run") return dryRun;
      if (url.pathname === "/site-imports/s1/start") return { ...ready, status: "running" };
      return undefined;
    });
    renderScreen(<SiteImportPage source="webflow" importId="s1" />);

    expect(await screen.findByText(/4 × Blog Posts, 2 pictures/)).toBeInTheDocument();
    expect(screen.getByText("Reference fields come in as text.")).toBeInTheDocument();
    expect(await screen.findByRole("combobox", { name: "Post body goes into" })).toHaveValue(
      "post_body",
    );

    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Featured goes into" }), "");
    await userEvent.click(screen.getByRole("button", { name: "Check with a dry run" }));
    expect(await screen.findByText("Dry run: what the import will do")).toBeInTheDocument();
    const saved = calls.find((call) => call.method === "PUT")?.body as SiteImportMapping;
    expect(saved.contentTypes["blog-posts"]?.fields).toEqual({
      "Post body": "post_body",
      Featured: null,
    });

    await userEvent.click(screen.getByRole("button", { name: "Start import" }));
    expect(calls.some((call) => call.url.pathname === "/site-imports/s1/start")).toBe(true);
  });
});
