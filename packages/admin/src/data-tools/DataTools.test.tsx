import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { BackupsPage } from "./BackupsPage.js";
import type { Backup, ImportPlan } from "./dataTools.api.js";
import { ImportPage } from "./ImportPage.js";
import { RestorePage } from "./RestorePage.js";
import type { WordPressImportReport } from "./wordpressImport.api.js";
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
  it("offers the WordPress importer and an export with options", async () => {
    mockApi(() => undefined);
    renderScreen(<ImportPage />);

    expect(await screen.findByRole("link", { name: /Import from WordPress/ })).toHaveAttribute(
      "href",
      "/settings/import/wordpress",
    );
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
