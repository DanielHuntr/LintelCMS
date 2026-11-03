import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { AvailableRelease, UpdatesOverview } from "./updates.api.js";
import { UpdateProgressPanel } from "./UpdateProgressPanel.js";
import { UpdatesPage } from "./UpdatesPage.js";
import { UpdatesSidebarLink } from "./UpdatesSidebarLink.js";
import { UpdatesWidget } from "./UpdatesWidget.js";

const securityRelease: AvailableRelease = {
  version: "1.2.0",
  name: "Lintel 1.2.0",
  channel: "stable",
  publishedAt: "2026-10-30T09:00:00Z",
  notesHtml: "<p>Faster uploads.</p><ul><li>Fixes a sign-in problem.</li></ul>",
  summary: "Faster uploads, and a fix for a sign-in problem.",
  security: true,
  breaking: false,
  minimumVersion: null,
  pageUrl: "https://github.com/DanielHuntr/LintelCMS/releases/tag/v1.2.0",
};

function overview(changes: Partial<UpdatesOverview> = {}): UpdatesOverview {
  return {
    currentVersion: "1.1.0",
    method: { installType: "supervised", oneClick: true, commands: [] },
    checksEnabled: true,
    feedIsDefault: true,
    checkedAt: new Date().toISOString(),
    problem: null,
    preferences: { channel: "stable" },
    releases: [securityRelease],
    recommendedVersion: "1.2.0",
    plugins: [],
    summary: { count: 1, securityCount: 1, checkFailed: false },
    canInstall: true,
    installedVersions: [],
    progress: null,
    ...changes,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Settings → Updates", () => {
  it("shows the new version in plain words, and updates only after the tick", async () => {
    const { calls } = mockApi(({ method, url }) => {
      if (url.pathname === "/updates") return overview();
      if (url.pathname === "/updates/install" && method === "POST") {
        return {
          version: "1.2.0",
          fromVersion: "1.1.0",
          kind: "update",
          step: "backing-up",
          message: "Making a backup of the whole site first.",
          fraction: null,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          backupFilename: null,
        };
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<UpdatesPage />);

    expect(
      await screen.findByRole("heading", { name: "Lintel 1.2.0 is available" }),
    ).toBeInTheDocument();
    expect(screen.getByText("You’re running Lintel 1.1.0.")).toBeInTheDocument();
    expect(screen.getByText("Security fix")).toBeInTheDocument();
    expect(screen.getByText(/fixes a security problem/)).toBeInTheDocument();
    expect(screen.getByText("Fixes a sign-in problem.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Update to 1.2.0" }));
    const dialog = screen.getByRole("dialog", { name: "Update to Lintel 1.2.0?" });
    expect(within(dialog).getByText(/makes a backup of your whole site/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Update now" });
    expect(confirm).toBeDisabled();
    await userEvent.click(within(dialog).getByLabelText("I understand. Update now."));
    await userEvent.click(confirm);

    const install = calls.find((call) => call.url.pathname === "/updates/install");
    expect(install?.body).toEqual({ version: "1.2.0", confirmed: true });
    expect(
      await screen.findByRole("heading", { name: "Updating to Lintel 1.2.0" }),
    ).toBeInTheDocument();
  });

  it("shows admins what's new without the button", async () => {
    mockApi(({ url }) =>
      url.pathname === "/updates" ? overview({ canInstall: false }) : undefined,
    );
    renderScreen(<UpdatesPage />);

    expect(
      await screen.findByText(/Only an owner of this site can install updates/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update to 1.2.0" })).not.toBeInTheDocument();
  });

  it("gives Docker installs the two commands, with the version filled in", async () => {
    mockApi(({ url }) =>
      url.pathname === "/updates"
        ? overview({
            method: {
              installType: "docker",
              oneClick: false,
              commands: [
                "git fetch --tags && git checkout v{version}",
                "docker compose -f deploy/docker-compose.yml up -d --build",
              ],
            },
          })
        : undefined,
    );
    renderScreen(<UpdatesPage />);

    const commands = await screen.findByRole("list", { name: "Commands to run" });
    expect(
      within(commands).getByText("git fetch --tags && git checkout v1.2.0"),
    ).toBeInTheDocument();
    expect(screen.getByText(/lintel-updater service/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Update to 1.2.0" })).not.toBeInTheDocument();
  });

  it("tells source installs to run lintel update", async () => {
    mockApi(({ url }) =>
      url.pathname === "/updates"
        ? overview({
            method: {
              installType: "source",
              oneClick: false,
              commands: ["pnpm lintel update --to {version}"],
            },
          })
        : undefined,
    );
    renderScreen(<UpdatesPage />);
    expect(await screen.findByText("pnpm lintel update --to 1.2.0")).toBeInTheDocument();
    expect(screen.getByText(/You’re running from source/)).toBeInTheDocument();
  });

  it("doesn't offer to update to the version already running (LINTEL-LEFT-007)", async () => {
    mockApi(({ url }) =>
      url.pathname === "/updates"
        ? overview({
            method: {
              installType: "source",
              oneClick: false,
              commands: ["pnpm lintel update --to {version}"],
            },
            releases: [],
            recommendedVersion: null,
            summary: { count: 0, securityCount: 0, checkFailed: false },
          })
        : undefined,
    );
    renderScreen(<UpdatesPage />);
    expect(await screen.findByText("You’re up to date")).toBeInTheDocument();
    expect(screen.queryByText(/pnpm lintel update/)).not.toBeInTheDocument();
    expect(
      screen.getByText("The command to run shows here when there’s a newer version to update to."),
    ).toBeInTheDocument();
  });

  it("says when everything is up to date", async () => {
    mockApi(({ url }) =>
      url.pathname === "/updates"
        ? overview({
            releases: [],
            recommendedVersion: null,
            summary: { count: 0, securityCount: 0, checkFailed: false },
          })
        : undefined,
    );
    renderScreen(<UpdatesPage />);
    expect(await screen.findByText("You’re up to date")).toBeInTheDocument();
  });

  it("rolls back to an earlier version, putting the backup back when asked", async () => {
    const { calls } = mockApi(({ method, url }) => {
      if (url.pathname === "/updates") {
        return overview({
          releases: [],
          recommendedVersion: null,
          installedVersions: [
            {
              version: "1.1.0",
              current: true,
              installedAt: null,
              backupBeforeLeaving: null,
              databaseCopyBeforeLeaving: null,
              databaseDiffers: false,
            },
            {
              version: "1.0.0",
              current: false,
              installedAt: null,
              backupBeforeLeaving: "lintel-backup.zip",
              databaseCopyBeforeLeaving: "copy-1",
              databaseDiffers: false,
            },
          ],
        });
      }
      if (url.pathname === "/updates/rollback" && method === "POST") {
        return {
          version: "1.0.0",
          fromVersion: "1.1.0",
          kind: "rollback",
          step: "maintenance",
          message: "Going back to Lintel 1.0.0.",
          fraction: null,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          backupFilename: "lintel-backup.zip",
        };
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<UpdatesPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Roll back to 1.0.0" }));
    const dialog = screen.getByRole("dialog", { name: "Go back to Lintel 1.0.0?" });
    await userEvent.click(within(dialog).getByLabelText(/Also put your content back/));
    await userEvent.click(within(dialog).getByRole("button", { name: "Roll back" }));

    expect(calls.find((call) => call.url.pathname === "/updates/rollback")?.body).toEqual({
      version: "1.0.0",
      restoreBackup: true,
      confirmed: true,
    });
  });
});

// LINTEL-DATA-011: going back across database changes needs the database put back too.
describe("rolling back after the database changed", () => {
  function overviewWith(databaseCopyBeforeLeaving: string | null) {
    return overview({
      releases: [],
      recommendedVersion: null,
      installedVersions: [
        {
          version: "1.1.0",
          current: true,
          installedAt: null,
          backupBeforeLeaving: null,
          databaseCopyBeforeLeaving: null,
          databaseDiffers: false,
        },
        {
          version: "1.0.0",
          current: false,
          installedAt: null,
          backupBeforeLeaving: "lintel-backup.zip",
          databaseCopyBeforeLeaving,
          databaseDiffers: true,
        },
      ],
    });
  }

  it("puts the content back without asking, and says so", async () => {
    const { calls } = mockApi(({ method, url }) => {
      if (url.pathname === "/updates") return overviewWith("copy-1");
      if (url.pathname === "/updates/rollback" && method === "POST") {
        return {
          version: "1.0.0",
          fromVersion: "1.1.0",
          kind: "rollback",
          step: "maintenance",
          message: "Going back to Lintel 1.0.0.",
          fraction: null,
          startedAt: new Date().toISOString(),
          finishedAt: null,
          backupFilename: null,
        };
      }
      return undefined;
    });
    renderScreen(<UpdatesPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Roll back to 1.0.0" }));
    const dialog = screen.getByRole("dialog", { name: "Go back to Lintel 1.0.0?" });
    expect(within(dialog).queryByRole("checkbox")).not.toBeInTheDocument();
    expect(within(dialog).getByText(/changed how your content is stored/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Roll back" }));

    expect(calls.find((call) => call.url.pathname === "/updates/rollback")?.body).toEqual({
      version: "1.0.0",
      restoreBackup: true,
      confirmed: true,
    });
  });

  it("explains, and doesn't offer the button, when the copy from before is gone", async () => {
    mockApi(({ url }) => (url.pathname === "/updates" ? overviewWith(null) : undefined));
    renderScreen(<UpdatesPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Roll back to 1.0.0" }));
    const dialog = screen.getByRole("dialog", { name: "Go back to Lintel 1.0.0?" });
    expect(within(dialog).getByText(/can’t safely run again/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Roll back" })).toBeDisabled();
  });
});

describe("the update's progress", () => {
  it("shows each step, the one under way, and how much has downloaded", async () => {
    renderScreen(
      <UpdateProgressPanel
        restarting={false}
        progress={{
          version: "1.2.0",
          fromVersion: "1.1.0",
          kind: "update",
          step: "downloading",
          message: "Downloading the new version.",
          fraction: 0.42,
          startedAt: "2026-11-01T09:00:00Z",
          finishedAt: null,
          backupFilename: "lintel-backup.zip",
        }}
      />,
    );
    expect(await screen.findByText("42% downloaded")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Downloading the new version.");
    expect(screen.getByText("Back up the site").parentElement).toHaveTextContent("done");
    expect(screen.getByText("Download the new version").parentElement).toHaveTextContent(
      "in progress",
    );
  });

  it("says plainly when an update failed and the old version is back", async () => {
    renderScreen(
      <UpdateProgressPanel
        restarting={false}
        progress={{
          version: "1.2.0",
          fromVersion: "1.1.0",
          kind: "update",
          step: "failed",
          message: "Lintel 1.2.0 didn't start properly. Lintel 1.1.0 is running again.",
          fraction: null,
          startedAt: "2026-11-01T09:00:00Z",
          finishedAt: "2026-11-01T09:02:00Z",
          backupFilename: null,
        }}
      />,
    );
    expect(
      await screen.findByRole("heading", { name: "The update didn’t work" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/running the version it had before/)).toBeInTheDocument();
  });
});

describe("when the last look for updates didn't work", () => {
  it("says it couldn't check, not that this is the newest version", async () => {
    mockApi(({ url }) =>
      url.pathname === "/updates"
        ? overview({
            releases: [],
            recommendedVersion: null,
            problem: "Lintel couldn't reach the update feed: it turned the request away.",
            summary: { count: 0, securityCount: 0, checkFailed: true },
          })
        : undefined,
    );
    renderScreen(<UpdatesPage />, { permissions: ["*"] });
    expect(await screen.findByText("Couldn’t check for updates")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("couldn't reach the update feed");
    expect(screen.queryByText("You’re up to date")).not.toBeInTheDocument();
  });

  it("says so on the dashboard too", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/updates/summary")
        return { count: 0, securityCount: 0, checkFailed: true };
      if (url.pathname === "/about") return { version: "1.1.0" };
      return undefined;
    });
    renderScreen(<UpdatesWidget />);
    expect(await screen.findByText("Couldn’t check for updates")).toBeInTheDocument();
    expect(screen.queryByText(/is up to date/)).not.toBeInTheDocument();
  });
});

describe("the updates badge and widget", () => {
  it("shows the count in the sidebar, saying when one is a security fix", async () => {
    mockApi(({ url }) =>
      url.pathname === "/updates/summary" ? { count: 2, securityCount: 1 } : undefined,
    );
    renderScreen(<UpdatesSidebarLink />);
    expect(
      await screen.findByRole("link", { name: "2 updates, including a security fix" }),
    ).toHaveAttribute("href", "/settings/updates");
  });

  it("asks nothing and shows nothing without updates:read", () => {
    const { calls } = mockApi(() => ({ count: 2, securityCount: 0 }));
    renderScreen(<UpdatesSidebarLink />, { permissions: ["entries:read"] });
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(calls).toEqual([]);
  });

  it("sums it up on the dashboard", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/updates/summary") return { count: 2, securityCount: 1 };
      if (url.pathname === "/about") return { version: "1.1.0" };
      return undefined;
    });
    renderScreen(<UpdatesWidget />);
    expect(await screen.findByText("2 updates available · 1 security")).toBeInTheDocument();
  });
});
