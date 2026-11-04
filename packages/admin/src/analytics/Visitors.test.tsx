import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { PageVisitorStats, Totals, VisitorStats } from "./analytics.api.js";
import { BuilderVisitorsLine } from "./BuilderVisitorsLine.js";
import { EntryVisitorsPanel } from "./EntryVisitorsPanel.js";
import { VisitorsPage } from "./VisitorsPage.js";
import { describeChange, formatSeconds } from "./visitorLabels.js";

const totals: Totals = {
  visitors: 128,
  views: 301,
  averageSeconds: 95,
  conversions: 4,
  conversionRate: 3.1,
  value: 0,
};
const none: Totals = {
  ...totals,
  visitors: 0,
  views: 0,
  averageSeconds: null,
  conversions: 0,
  conversionRate: null,
};
const row = (key: string, visitors: number) => ({
  key,
  visitors,
  views: visitors,
  conversions: 0,
  averageSeconds: null,
});

const stats: VisitorStats = {
  period: { from: "2026-10-28", to: "2026-11-03" },
  previousPeriod: { from: "2026-10-21", to: "2026-10-27" },
  totals,
  previousTotals: { ...totals, visitors: 100 },
  days: [
    { day: "2026-11-02", visitors: 60, views: 140 },
    { day: "2026-11-03", visitors: 68, views: 161 },
  ],
  pages: [row("/", 90), row("/menu", 40)],
  sources: [row("", 70), row("google.com", 58)],
  campaigns: [],
  devices: [row("phone", 80), row("desktop", 48)],
  countries: [row("GB", 100), row("", 28)],
  goals: [{ ...row("form:contact", 3), conversions: 3 }],
  events: [],
  outbound: [],
  versions: [],
};

afterEach(() => vi.restoreAllMocks());

describe("the Visitors screen", () => {
  it("shows the week's figures, compared with the week before, in plain words", async () => {
    const { calls } = mockApi(({ url }) => {
      if (url.pathname === "/analytics/stats") return stats;
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    renderScreen(<VisitorsPage />, {
      enabledPlugins: ["analytics"],
      permissions: ["analytics:read"],
    });

    expect(await screen.findByRole("heading", { level: 1, name: "Visitors" })).toBeInTheDocument();
    expect(await screen.findByText("128")).toBeInTheDocument();
    expect(screen.getByText("Up 28% on the previous period")).toBeInTheDocument();
    expect(screen.getByText("1m 35s")).toBeInTheDocument();
    expect(screen.getByText("Typed in or bookmarked")).toBeInTheDocument();
    expect(screen.getByText("Phone")).toBeInTheDocument();
    expect(screen.getByText("“contact” form sent")).toBeInTheDocument();
    // Settings are for people who may change them.
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
    expect(calls.at(-1)?.url.search).toBe("?range=7d");

    await userEvent.click(screen.getByRole("radio", { name: "30 days" }));
    expect(calls.at(-1)?.url.search).toBe("?range=30d");
  });

  it("shows the visitors of each running test's versions to people who run tests", async () => {
    const running = {
      id: "t1",
      pageTitle: "Home",
      status: "running",
      versions: [{ key: "b" }],
    };
    const ended = { ...running, id: "t0", status: "ended" };
    mockApi(({ url }) => {
      if (url.pathname === "/analytics/stats") {
        return {
          ...stats,
          versions: [row("t1:original", 41), row("t1:b", 39), row("t0:b", 12)],
        };
      }
      if (url.pathname === "/experiments") return { experiments: [running, ended] };
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    renderScreen(<VisitorsPage />, {
      enabledPlugins: ["analytics", "experiments"],
      permissions: ["analytics:read", "experiments:manage"],
    });
    const card = (await screen.findByRole("heading", { name: "A/B tests running" })).closest(
      "section, div",
    ) as HTMLElement;
    expect(
      await within(card.parentElement ?? card).findByText("Home: Original"),
    ).toBeInTheDocument();
    expect(screen.getByText("Home: Version B")).toBeInTheDocument();
    expect(screen.queryByText(/t0/)).not.toBeInTheDocument();
    cleanup();

    // Without the A/B testing permission, no card and no request for tests.
    const { calls } = mockApi(({ url }) =>
      url.pathname === "/analytics/stats" ? { ...stats, versions: [row("t1:b", 39)] } : null,
    );
    renderScreen(<VisitorsPage />, {
      enabledPlugins: ["analytics", "experiments"],
      permissions: ["analytics:read"],
    });
    expect(await screen.findByText("128")).toBeInTheDocument();
    expect(screen.queryByText("A/B tests running")).not.toBeInTheDocument();
    expect(calls.some((call) => call.url.pathname === "/experiments")).toBe(false);
  });

  it("offers the chart as a table", async () => {
    mockApi(() => stats);
    renderScreen(<VisitorsPage />, { enabledPlugins: ["analytics"] });
    const chart = await screen.findByRole("img", { name: /128 visitors from/ });
    expect(chart).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Show as a table" }));
    const table = screen.getAllByRole("table")[0];
    expect(table && within(table).getByRole("columnheader", { name: "Day" })).toBeInTheDocument();
  });

  it("explains what will appear before anyone has visited", async () => {
    mockApi(() => ({ ...stats, totals: none, previousTotals: none, days: [] }));
    renderScreen(<VisitorsPage />, { enabledPlugins: ["analytics"] });
    expect(await screen.findByText("No visitors yet")).toBeInTheDocument();
  });
});

describe("visitors beside a page", () => {
  const pageStats: PageVisitorStats = {
    path: "/menu",
    period: stats.period,
    totals,
    previousTotals: totals,
    days: [],
  };

  it("shows the page's week in the editor", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/analytics/entries/e1") return pageStats;
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    renderScreen(
      <EntryVisitorsPanel
        entryId="e1"
        entryTitle="Menu"
        slug="menu"
        collection={{ handle: "pages", name: "Pages", routePattern: "/{slug}" }}
      />,
      { enabledPlugins: ["analytics"] },
    );
    expect(await screen.findByText("128 visitors in the last 7 days")).toBeInTheDocument();
  });

  it("says how many visited this week in the builder, only with the plugin on", async () => {
    mockApi(() => pageStats);
    renderScreen(<BuilderVisitorsLine entryId="e1" />, { enabledPlugins: ["analytics"] });
    const line = await screen.findByText("128 visitors this week");
    // It never squeezes onto three lines beside the other toolbar buttons (LINTEL-UX-330).
    expect(line.className).toContain("whitespace-nowrap");
    cleanup();

    const { calls } = mockApi(() => pageStats);
    renderScreen(<BuilderVisitorsLine entryId="e1" />, { enabledPlugins: [] });
    expect(screen.queryByText("128 visitors this week")).not.toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });
});

describe("visitor labels", () => {
  it("says times and changes plainly", () => {
    expect(formatSeconds(42)).toBe("42s");
    expect(formatSeconds(null)).toBe("Not yet");
    expect(describeChange(50, 100).text).toBe("Down 50% on the previous period");
    expect(describeChange(5, 0).text).toBe("None in the previous period");
  });
});
