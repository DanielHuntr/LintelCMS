import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { addMonths, dayKey, gridRange, monthGrid, parseMonth } from "./monthGrid.js";
import type { ScheduledEntry } from "./scheduleCalendar.api.js";
import { SchedulePage } from "./SchedulePage.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const november = { year: 2026, month: 11 };
const today = new Date(2026, 10, 3, 10, 0);

function scheduled(overrides: Partial<ScheduledEntry>): ScheduledEntry {
  return {
    id: "e1",
    title: "Winter menu",
    locale: "en-GB",
    collectionHandle: "pages",
    collectionName: "Pages",
    scheduledFor: new Date(2026, 10, 12, 9, 0).toISOString(),
    action: "publish",
    ...overrides,
  };
}

function serve(entries: ScheduledEntry[]) {
  return mockApi(({ url }) => (url.pathname === "/entries/scheduled" ? { entries } : {}));
}

function onPhone() {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("max-width"),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe("the month grid", () => {
  it("is whole weeks starting on Monday, covering the month", () => {
    const weeks = monthGrid(november);

    // 1 November 2026 is a Sunday, so the grid starts six days before it.
    expect(weeks).toHaveLength(6);
    expect(weeks[0]?.[0]?.key).toBe("2026-10-26");
    expect(weeks[0]?.[6]?.key).toBe("2026-11-01");
    expect(weeks[5]?.[6]?.key).toBe("2026-12-06");
    expect(weeks[0]?.[0]?.isInMonth).toBe(false);
    const { from, to } = gridRange(weeks);
    expect(dayKey(from)).toBe("2026-10-26");
    expect(dayKey(to)).toBe("2026-12-07");
  });

  it("moves between months and reads them from the address", () => {
    expect(addMonths(november, 2)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(parseMonth("2026-11")).toEqual(november);
    expect(parseMonth("2026-13")).toBeUndefined();
    expect(parseMonth(undefined)).toBeUndefined();
  });
});

describe("the schedule calendar", () => {
  it("puts each entry on its day, linking to it, and asks only for the days shown", async () => {
    const api = serve([
      scheduled({}),
      scheduled({
        id: "e2",
        title: "Christmas hours",
        scheduledFor: new Date(2026, 10, 12, 15, 30).toISOString(),
      }),
    ]);
    renderScreen(<SchedulePage month={november} onMonthChange={() => undefined} today={today} />);

    const calendar = await screen.findByRole("table", { name: "Scheduled in November 2026" });
    const day = within(calendar).getByRole("cell", {
      name: /Thursday,? (12 November|November 12), 2 due/,
    });
    expect(within(day).getByRole("link", { name: /Winter menu/ })).toHaveAttribute(
      "href",
      "/content/pages/e1",
    );
    expect(within(day).getByText("Christmas hours")).toBeInTheDocument();
    expect(
      within(calendar).getByRole("cell", {
        name: /Tuesday,? (3 November|November 3), nothing due, Today/,
      }),
    ).toBeInTheDocument();

    const asked = api.calls[0]?.url.searchParams;
    expect(new Date(asked?.get("from") ?? "")).toEqual(new Date(2026, 9, 26));
    expect(new Date(asked?.get("to") ?? "")).toEqual(new Date(2026, 11, 7));
  });

  it("moves to the next month, and back to this one", async () => {
    serve([]);
    const onMonthChange = vi.fn();
    renderScreen(
      <SchedulePage
        month={{ year: 2026, month: 12 }}
        onMonthChange={onMonthChange}
        today={today}
      />,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Next month" }));
    expect(onMonthChange).toHaveBeenLastCalledWith({ year: 2027, month: 1 });
    await userEvent.click(screen.getByRole("button", { name: "This month" }));
    expect(onMonthChange).toHaveBeenLastCalledWith(november);
  });

  it("explains how to schedule something when the month is empty", async () => {
    serve([]);
    renderScreen(<SchedulePage month={november} onMonthChange={() => undefined} today={today} />);

    expect(await screen.findByText(/Nothing scheduled in November 2026/)).toBeInTheDocument();
    expect(screen.getByText(/choose Schedule in its Status panel/)).toBeInTheDocument();
  });

  it("becomes a list grouped by day on a phone", async () => {
    onPhone();
    serve([
      scheduled({}),
      scheduled({
        id: "e3",
        title: "New year opening",
        scheduledFor: new Date(2026, 10, 20, 8, 0).toISOString(),
      }),
    ]);
    renderScreen(<SchedulePage month={november} onMonthChange={() => undefined} today={today} />);

    const thursday = await screen.findByRole("list", {
      name: /Thursday,? (12 November|November 12)/,
    });
    expect(within(thursday).getByRole("link", { name: /Winter menu/ })).toHaveAttribute(
      "href",
      "/content/pages/e1",
    );
    expect(
      screen.getByRole("list", { name: /Friday,? (20 November|November 20)/ }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
