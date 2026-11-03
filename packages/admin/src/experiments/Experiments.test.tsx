import { createEmptyPage, type PageDocument, type PageNode } from "@lintel/builder-model";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { ExperimentPage } from "./ExperimentPage.js";
import { ExperimentsPage } from "./ExperimentsPage.js";
import { formatDifference, linksOnPages, verdictSentence } from "./experimentText.js";
import type { Experiment, ExperimentResults, VersionResult } from "./experiments.types.js";
import { sectionAround, versionDocument } from "./useVersionEditing.js";

afterEach(() => vi.restoreAllMocks());

function node(
  id: string,
  type: string,
  props: Record<string, unknown> = {},
  children: PageNode[] = [],
): PageNode {
  return {
    id,
    type,
    name: "",
    props,
    styles: { base: {} },
    children,
    hidden: false,
    locked: false,
  };
}

function page(...children: PageNode[]): PageDocument {
  const empty = createEmptyPage();
  return { ...empty, root: { ...empty.root, children } };
}

const design = page(
  node("hero", "section", {}, [
    node("title", "heading", { text: "Fresh bread" }),
    node("cta", "button", { label: "Book a table", href: "/book" }),
  ]),
  node("hours", "section", {}, [node("times", "text", { text: "Open daily" })]),
);

const experiment: Experiment = {
  id: "e1",
  entryId: "p1",
  pageTitle: "Bakery",
  collection: "pages",
  scope: "page",
  sectionId: null,
  status: "running",
  goal: { kind: "click", target: "/book", label: "Book a table" },
  split: [50, 50],
  winner: null,
  startedAt: "2026-11-01T09:00:00.000Z",
  endedAt: null,
  createdAt: "2026-11-01T08:00:00.000Z",
  versions: [{ key: "b", design, updatedAt: "2026-11-01T08:30:00.000Z" }],
};

function result(
  key: "original" | "b",
  visitors: number,
  conversions: number,
  verdict?: string,
  sureness = 0,
): VersionResult {
  return {
    key,
    share: 50,
    visitors,
    conversions,
    rate: conversions / visitors,
    comparison:
      key === "original"
        ? null
        : {
            rate: conversions / visitors,
            originalRate: 0.1,
            relativeDifference: 0.3,
            probabilityBetter: sureness / 100,
            verdict: verdict as "better",
            sureness,
          },
  };
}

const strongResults: ExperimentResults = {
  enoughData: true,
  minimumVisitors: 100,
  minimumConversions: 20,
  versions: [result("original", 1000, 100), result("b", 1000, 130, "better", 98)],
};

describe("A/B test words", () => {
  it("says how sure a result is, in plain English", () => {
    expect(verdictSentence(result("b", 40, 8, "aheadTooEarly", 80))).toBe(
      "B is ahead, but it’s too early to be sure.",
    );
    expect(verdictSentence(result("b", 1000, 130, "better", 95))).toBe(
      "B is better: about 95% sure.",
    );
    expect(verdictSentence(result("b", 1000, 70, "worse", 97))).toBe("B is worse: about 97% sure.");
  });

  it("shows the difference with a sign", () => {
    expect(formatDifference(0.23)).toMatch(/^\+23\s?%$/);
    expect(formatDifference(-0.08)).toMatch(/^−8\s?%$/);
    expect(formatDifference(0.001)).toBe("about the same");
    expect(formatDifference(null)).toBe("");
  });

  it("finds each button and link on the versions once", () => {
    expect(linksOnPages([design, design])).toEqual([{ href: "/book", label: "Book a table" }]);
  });
});

describe("versions in the designer", () => {
  it("draws a section version in the page as it is now, the rest locked", () => {
    const sectionTest: Experiment = {
      ...experiment,
      scope: "section",
      sectionId: "hero",
      versions: [
        {
          key: "b",
          design: page(
            node("hero", "section", {}, [node("title", "heading", { text: "Baked at dawn" })]),
          ),
          updatedAt: "",
        },
      ],
    };
    const shown = versionDocument(sectionTest, "b", design);
    expect(shown?.root.children.map((child) => [child.id, child.locked])).toEqual([
      ["hero", false],
      ["hours", true],
    ]);
    expect(JSON.stringify(shown)).toContain("Baked at dawn");
  });

  it("finds the section around a selected element", () => {
    expect(sectionAround(design, "cta")).toBe("hero");
    expect(sectionAround(design, "hours")).toBe("hours");
    expect(sectionAround(design, null)).toBeNull();
  });
});

describe("the A/B test screens", () => {
  it("lists tests with their state", async () => {
    mockApi(() => ({ experiments: [experiment] }));
    renderScreen(<ExperimentsPage />, { enabledPlugins: ["experiments"] });
    expect(await screen.findByText("Bakery")).toBeInTheDocument();
    expect(screen.getByText("Running")).toBeInTheDocument();
    expect(screen.getByText(/2 versions · Someone clicks “Book a table”/)).toBeInTheDocument();
  });

  it("guides a first test from the designer", async () => {
    mockApi(() => ({ experiments: [] }));
    renderScreen(<ExperimentsPage />, { enabledPlugins: ["experiments"] });
    expect(await screen.findByText("No tests yet")).toBeInTheDocument();
    expect(screen.getByText(/Try another version/)).toBeInTheDocument();
  });

  it("shows results with a verdict, and makes B the page", async () => {
    const { calls } = mockApi(({ method, url }) => {
      if (url.pathname === "/experiments/e1" && method === "GET") return experiment;
      if (url.pathname === "/experiments/e1/results") return strongResults;
      if (url.pathname === "/entries/p1") return { id: "p1", data: { title: "Bakery", design } };
      if (url.pathname === "/experiments/e1/end")
        return { ...experiment, status: "ended", winner: "b" };
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<ExperimentPage experimentId="e1" />, { enabledPlugins: ["experiments"] });

    expect(await screen.findByText("B is better: about 98% sure.")).toBeInTheDocument();
    expect(screen.getByText("1,000 visitors · 130 clicked")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Make Version B the page" }));
    const dialog = screen.getByRole("alertdialog", { name: "Make Version B the page?" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Make it the page" }));
    expect(calls.find((call) => call.url.pathname === "/experiments/e1/end")?.body).toEqual({
      version: "b",
    });
  });

  it("warns when it's too early, and hides publishing from people who can't publish", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/experiments/e1") return experiment;
      if (url.pathname === "/experiments/e1/results")
        return {
          ...strongResults,
          enoughData: false,
          versions: [result("original", 40, 2), result("b", 40, 8, "aheadTooEarly", 81)],
        };
      return { id: "p1", data: { title: "Bakery", design } };
    });
    renderScreen(<ExperimentPage experimentId="e1" />, {
      enabledPlugins: ["experiments"],
      permissions: ["experiments:manage", "entries:read"],
    });
    expect(
      await screen.findByText("B is ahead, but it’s too early to be sure."),
    ).toBeInTheDocument();
    expect(screen.getByText(/wait for at least 100 visitors on each version/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /the page$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Keep the original" })).toBeInTheDocument();
  });

  it("chooses a goal before starting", async () => {
    const draft: Experiment = { ...experiment, status: "draft", startedAt: null, goal: null };
    const { calls } = mockApi(({ method, url, body }) => {
      if (url.pathname === "/experiments/e1" && method === "GET") return draft;
      if (url.pathname === "/experiments/e1" && method === "PATCH")
        return { ...draft, ...(body as object) };
      return { id: "p1", data: { title: "Bakery", design } };
    });
    renderScreen(<ExperimentPage experimentId="e1" />, { enabledPlugins: ["experiments"] });

    await userEvent.selectOptions(
      await screen.findByLabelText("Count a success when someone…"),
      "click",
    );
    await userEvent.selectOptions(screen.getByLabelText("Which button or link?"), "/book");
    expect(calls.find((call) => call.method === "PATCH")?.body).toEqual({
      goal: { kind: "click", target: "/book", label: "Book a table" },
    });
    expect(screen.getByRole("button", { name: "Start test" })).toBeInTheDocument();
  });
});
