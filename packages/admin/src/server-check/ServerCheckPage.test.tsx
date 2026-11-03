import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { ServerCheckReport } from "./serverCheck.api.js";
import { ServerCheckPage } from "./ServerCheckPage.js";

const limited: ServerCheckReport = {
  verdict: "runs-with-limits",
  headline: "Lintel runs here, with the notes below.",
  checks: [
    { name: "Node.js version", status: "pass", detail: "Node.js 22.12.0" },
    { name: "Database", status: "pass", detail: "Postgres 17.2 answers" },
    {
      name: "Internet access",
      status: "warn",
      detail: "This server couldn't reach the internet.",
      askHost: "Please allow outgoing HTTPS connections (port 443) from my Node.js app.",
    },
  ],
  askHost: ["Please allow outgoing HTTPS connections (port 443) from my Node.js app."],
};

afterEach(() => vi.restoreAllMocks());

describe("Settings → This server", () => {
  it("lists each check in plain words, and what to ask the host", async () => {
    const { calls } = mockApi(({ url }) => {
      if (url.pathname === "/system/server-check") return limited;
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    renderScreen(<ServerCheckPage />);

    const list = await screen.findByRole("list", { name: limited.headline });
    expect(within(list).getByText("Postgres 17.2 answers")).toBeInTheDocument();
    expect(within(list).getByText("Worth knowing")).toBeInTheDocument();
    const ask = screen.getByRole("region", { name: "What to ask your hosting company" });
    expect(within(ask).getByText(/port 443/)).toBeInTheDocument();
    expect(
      within(ask).getByRole("button", { name: "Copy the message for your host" }),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Check again" }));
    expect(calls.filter((call) => call.url.pathname === "/system/server-check")).toHaveLength(2);
  });

  it("asks nothing of the host when all is well", async () => {
    mockApi(() => ({
      ...limited,
      verdict: "runs",
      headline: "Everything Lintel needs is here.",
      checks: limited.checks.slice(0, 2),
      askHost: [],
    }));
    renderScreen(<ServerCheckPage />);

    expect(
      await screen.findByRole("list", { name: "Everything Lintel needs is here." }),
    ).toBeInTheDocument();
    expect(screen.queryByText("What to ask your hosting company")).not.toBeInTheDocument();
  });
});
