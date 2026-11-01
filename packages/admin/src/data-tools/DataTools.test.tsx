import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { BackupsPage } from "./BackupsPage.js";
import type { Backup, ImportPlan } from "./dataTools.api.js";
import { ImportPage } from "./ImportPage.js";
import { RestorePage } from "./RestorePage.js";
import type { WordPressImportMapping, WordPressImportReport } from "./wordpressImport.api.js";
import { WordPressMappingStep } from "./WordPressMappingStep.js";
import { WordPressReport } from "./WordPressReport.js";

const finishedBackup: Backup = {
  id: "b1",
  filename: "lintel-backup-2026-10-31-0900-abc123.zip",
  trigger: "manual",
  status: "complete",
  size: 5_000_000,
  contents: { tables: { entries: 12 }, mediaFiles: 3 },
  failureReason: null,
  createdByName: "Ada Lovelace",
  createdAt: "2026-10-31T09:00:00Z",
  completedAt: "2026-10-31T09:01:00Z",
};

afterEach(() => vi.restoreAllMocks());

describe("Settings → Backups", () => {
  it("explains backups when there are none, and makes one", async () => {
    const { calls } = mockApi(({ method, url }) => {
      if (url.pathname === "/backups" && method === "GET") {
        return { backups: [], schedule: { frequency: "off", keep: 7 } };
      }
      if (url.pathname === "/backups" && method === "POST")
        return { ...finishedBackup, status: "running" };
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<BackupsPage />);

    expect(await screen.findByText("No backups yet")).toBeInTheDocument();
    expect(screen.getByText("Automatic backups are off.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Back up now" }));
    expect(calls.some((call) => call.method === "POST" && call.url.pathname === "/backups")).toBe(
      true,
    );
  });

  it("lists backups with ways to download and restore them, and saves the schedule", async () => {
    const { calls } = mockApi(({ method, url, body }) => {
      if (url.pathname === "/backups")
        return { backups: [finishedBackup], schedule: { frequency: "off", keep: 7 } };
      if (url.pathname === "/backups/schedule" && method === "PUT") return body;
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<BackupsPage />);

    expect(await screen.findByText("Made by Ada Lovelace · 5 MB")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Download the backup from/ })).toHaveAttribute(
      "href",
      expect.stringContaining("/backups/b1/download"),
    );
    expect(screen.getByRole("link", { name: /Restore the backup from/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Daily" }));
    expect(calls.find((call) => call.method === "PUT")?.body).toEqual({
      frequency: "daily",
      keep: 7,
    });
  });
});

describe("restoring a backup", () => {
  it("asks for a tick and the word RESTORE before replacing anything", async () => {
    const { calls } = mockApi(({ method, url }) => {
      const summary = {
        createdAt: "2026-10-31T09:00:00Z",
        tables: [{ table: "entries", inBackup: 12, current: 15 }],
        mediaFiles: 3,
      };
      if (url.pathname.endsWith("/restore-preview")) return summary;
      if (url.pathname.endsWith("/restore") && method === "POST") return summary;
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<RestorePage backupId="b1" />);

    expect(
      await screen.findByRole("heading", { name: "This replaces everything on your site" }),
    ).toBeInTheDocument();
    const row = screen.getByRole("row", { name: /Pages and posts/ });
    expect(within(row).getByText("15")).toBeInTheDocument();
    expect(within(row).getByText("12")).toBeInTheDocument();

    const restoreButton = screen.getByRole("button", { name: "Restore this backup" });
    expect(restoreButton).toBeDisabled();
    await userEvent.click(
      screen.getByLabelText("I understand that this replaces everything on the site"),
    );
    await userEvent.type(screen.getByLabelText("Type RESTORE to confirm"), "restore");
    expect(restoreButton).toBeDisabled();
    await userEvent.clear(screen.getByLabelText("Type RESTORE to confirm"));
    await userEvent.type(screen.getByLabelText("Type RESTORE to confirm"), "RESTORE");
    await userEvent.click(restoreButton);

    expect(
      await screen.findByRole("heading", { name: "Your site has been restored" }),
    ).toBeInTheDocument();
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({ confirm: "RESTORE" });
  });
});

describe("Settings → Import", () => {
  it("offers an importer for each system and an export with options", async () => {
    mockApi(() => undefined);
    renderScreen(<ImportPage />);

    expect(await screen.findByRole("link", { name: /^WordPress/ })).toHaveAttribute(
      "href",
      "/settings/import/wordpress",
    );
    for (const source of ["Webflow", "Framer", "Statamic", "Umbraco"]) {
      expect(screen.getByRole("link", { name: new RegExp(`^${source}`) })).toHaveAttribute(
        "href",
        `/settings/import/${source.toLowerCase()}`,
      );
    }
    const download = screen.getByRole("link", { name: "Download export" });
    expect(download).toHaveAttribute("href", expect.stringContaining("revisions=false&files=true"));
    await userEvent.click(
      screen.getByRole("switch", { name: "Include every saved version of each page" }),
    );
    expect(download).toHaveAttribute("href", expect.stringContaining("revisions=true"));
  });

  it("shows a plan as a table of what will be added, updated and kept", async () => {
    const { PlanTable } = await import("./LintelImportCard.js");
    const empty = { create: 0, update: 0, skip: 0 };
    const plan: ImportPlan = {
      strategy: "skip",
      totals: {
        blueprint: empty,
        collection: { create: 0, update: 0, skip: 2 },
        taxonomy: empty,
        term: { create: 4, update: 0, skip: 0 },
        global: empty,
        menu: empty,
        media: empty,
        entry: { create: 10, update: 1, skip: 0 },
      },
      items: [],
      warnings: [],
    };
    renderScreen(<PlanTable plan={plan} />);
    const row = await screen.findByRole("row", { name: /Pages and posts/ });
    expect(
      within(row)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["10", "1", "0"]);
    expect(screen.getByRole("row", { name: /Categories and tags/ })).toBeInTheDocument();
  });
});

describe("the WordPress import report", () => {
  it("lists invited people, HTML blocks, changed addresses and problems", async () => {
    const none = { done: 0, skipped: 0, failed: 0 };
    const report: WordPressImportReport = {
      dryRun: false,
      counts: {
        author: { done: 2, skipped: 0, failed: 0 },
        category: none,
        tag: none,
        attachment: { done: 4, skipped: 0, failed: 1 },
        image: none,
        page: { done: 3, skipped: 0, failed: 0 },
        post: { done: 10, skipped: 1, failed: 0 },
        product: none,
        menu: none,
      },
      invitedPeople: [{ name: "Maria Baker", email: "maria@example.com" }],
      keptAsHtml: { embed: 2, image: 1 },
      entriesWithHtml: [{ title: "Our new sourdough", kinds: ["embed"] }],
      renamedSlugs: [{ title: "About", from: "about", to: "about-2" }],
      redirectsSuggested: 12,
      problems: [
        {
          kind: "attachment",
          title: "bunny.gif",
          message: "Not brought in: the old site answered 404.",
        },
      ],
    };
    renderScreen(<WordPressReport report={report} />);

    const posts = await screen.findByRole("row", { name: /Posts/ });
    expect(
      within(posts)
        .getAllByRole("cell")
        .map((cell) => cell.textContent),
    ).toEqual(["10", "1", "0"]);
    expect(screen.getByText("Maria Baker <maria@example.com>")).toBeInTheDocument();
    expect(screen.getByText("Our new sourdough (embed)")).toBeInTheDocument();
    expect(screen.getByText("About: about is taken, so it’s about-2")).toBeInTheDocument();
    expect(screen.getByText(/12 redirects suggested/)).toBeInTheDocument();
    expect(
      screen.getByText("bunny.gif: Not brought in: the old site answered 404."),
    ).toBeInTheDocument();
  });
});

describe("the WordPress mapping screen", () => {
  it("sends the other addresses images may come from with the mapping", async () => {
    const mapping: WordPressImportMapping = {
      postsCollection: "posts",
      pagesCollection: "pages",
      categoriesTaxonomy: "categories",
      tagsTaxonomy: "tags",
      media: "download",
      mediaHosts: [],
      postFields: {},
      pageFields: {},
      menus: true,
      products: "import",
      authors: "invite",
      drafts: "import",
      redirects: true,
    };
    const { calls } = mockApi(({ method, url, body }) => {
      if (url.pathname === "/wordpress-imports/w1/mapping" && method === "GET") {
        return {
          import: {
            id: "w1",
            filename: "bakery.xml",
            siteTitle: "Hillside Bakery",
            siteAddress: "https://hillside-bakery.example",
            status: "ready",
            found: {
              posts: 2,
              pages: 1,
              attachments: 1,
              authors: 1,
              categories: 1,
              tags: 1,
              ignored: {},
            },
            mapping: null,
            progress: { done: 0, total: 0 },
            hasContentZip: false,
            lastError: null,
            createdAt: "2026-10-31T09:00:00Z",
            completedAt: null,
          },
          collections: [{ handle: "posts", name: "Blog posts" }],
          taxonomies: [{ handle: "categories", name: "Categories" }],
          collectionFields: { posts: [] },
          shopEnabled: false,
          suggested: mapping,
        };
      }
      if (url.pathname === "/wordpress-imports/w1/mapping" && method === "PUT") {
        return { mapping: body, fields: { posts: null, pages: null } };
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(
      <WordPressMappingStep
        importId="w1"
        isStarting={false}
        startError={null}
        onStart={() => undefined}
      />,
    );

    const hosts = await screen.findByLabelText("Other addresses images may come from (optional)");
    await userEvent.type(hosts, "cdn.example.com, i0.wp.com");
    await userEvent.click(screen.getByRole("button", { name: "Start import" }));

    const saved = calls.find((call) => call.method === "PUT");
    expect(saved?.body).toMatchObject({ mediaHosts: ["cdn.example.com", "i0.wp.com"] });
  });
});
