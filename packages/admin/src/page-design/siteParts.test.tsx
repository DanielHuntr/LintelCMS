import type { SiteDesign } from "@lintel/builder-model";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { SitePartProblems } from "./SitePartProblems.js";
import { useSiteDesign } from "./useSiteDesign.js";
import { useSiteSections } from "./useSiteSections.js";

afterEach(() => vi.restoreAllMocks());

const sand = { id: "sand", name: "Sand", kind: "colour" as const, value: "#efe6d6" };

/** The builder's side of the site's styles, cut down to a button that changes them. */
function StylesProbe() {
  const { source, problem } = useSiteDesign();
  const change = source?.onChange;
  return (
    <>
      <p>{source ? `${source.value.variables.length} variables` : "Loading"}</p>
      {change && (
        <button
          type="button"
          onClick={() =>
            change({
              ...(source.value as SiteDesign),
              variables: [...source.value.variables, sand],
            })
          }
        >
          Add Sand
        </button>
      )}
      <SitePartProblems problems={[problem]} />
    </>
  );
}

function SectionsProbe() {
  const { source, problem } = useSiteSections();
  const change = source && "onChange" in source ? source.onChange : undefined;
  return (
    <>
      {change && (
        <button type="button" onClick={() => change?.({ footer: null })}>
          Take the footer off
        </button>
      )}
      <SitePartProblems problems={[problem]} />
    </>
  );
}

/** Opens the probe, and closes it as leaving the builder does. */
function Closable({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(false)}>
        Close
      </button>
      {open && children}
    </>
  );
}

describe("the site's styles in the builder", () => {
  it("saves a change still waiting when the builder closes", async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(({ method, url, body }) => {
      if (method === "GET" && url.pathname === "/website/design") {
        return { variables: [], sharedStyles: [], revision: "r1" };
      }
      if (method === "PUT" && url.pathname === "/website/design") {
        return { ...(body as object), revision: "r2" };
      }
      throw apiErrorResponse(404, "NOT_FOUND", "Not found");
    });
    renderScreen(
      <Closable>
        <StylesProbe />
      </Closable>,
    );
    await user.click(await screen.findByRole("button", { name: "Add Sand" }));
    await user.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(calls.filter((call) => call.method === "PUT")).toHaveLength(1));
    expect(calls.find((call) => call.method === "PUT")?.body).toMatchObject({
      variables: [sand],
      revision: "r1",
    });
  });

  it("shows a save that failed, and sends the change again with Try again", async () => {
    const user = userEvent.setup();
    let refuse = true;
    const { calls } = mockApi(({ method, url, body }) => {
      if (method === "GET" && url.pathname === "/website/design") {
        return { variables: [], sharedStyles: [], revision: "r1" };
      }
      if (method === "PUT" && url.pathname === "/website/design") {
        if (refuse) throw apiErrorResponse(500, "INTERNAL", "The server had a problem");
        return { ...(body as object), revision: "r2" };
      }
      throw apiErrorResponse(404, "NOT_FOUND", "Not found");
    });
    renderScreen(<StylesProbe />);
    await user.click(await screen.findByRole("button", { name: "Add Sand" }));
    expect(
      await screen.findByText(
        "The site's styles weren't saved: The server had a problem",
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("1 variables")).toBeInTheDocument();
    refuse = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    const puts = calls.filter((call) => call.method === "PUT");
    expect(puts).toHaveLength(2);
    expect(puts[1]?.body).toMatchObject({ variables: [sand] });
  });

  it("shows someone else's newer styles, and says so, instead of undoing them", async () => {
    const user = userEvent.setup();
    let saves = 0;
    mockApi(({ method, url }) => {
      if (method === "GET" && url.pathname === "/website/design") {
        return saves === 0
          ? { variables: [], sharedStyles: [], revision: "r1" }
          : { variables: [sand, { ...sand, id: "ink" }], sharedStyles: [], revision: "r9" };
      }
      if (method === "PUT" && url.pathname === "/website/design") {
        saves += 1;
        throw apiErrorResponse(409, "SITE_DESIGN_CHANGED", "Changed");
      }
      throw apiErrorResponse(404, "NOT_FOUND", "Not found");
    });
    renderScreen(<StylesProbe />);
    await user.click(await screen.findByRole("button", { name: "Add Sand" }));
    expect(
      await screen.findByText(/Someone else changed the site's styles/, {}, { timeout: 3000 }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 variables")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });
});

describe("the site's navigation and footer in the builder", () => {
  it("shows a save that failed and keeps the change for Try again", async () => {
    const user = userEvent.setup();
    let refuse = true;
    const { calls } = mockApi(({ method, url, body }) => {
      if (method === "GET" && url.pathname === "/website/sections") {
        return { navigation: null, footer: null };
      }
      if (method === "PUT" && url.pathname === "/website/sections") {
        if (refuse) throw apiErrorResponse(500, "INTERNAL", "The server had a problem");
        return { navigation: null, footer: null, ...(body as object) };
      }
      throw apiErrorResponse(404, "NOT_FOUND", "Not found");
    });
    renderScreen(<SectionsProbe />);
    await user.click(await screen.findByRole("button", { name: "Take the footer off" }));
    expect(
      await screen.findByText(
        "The navigation and footer weren't saved: The server had a problem",
        {},
        { timeout: 3000 },
      ),
    ).toBeInTheDocument();
    refuse = false;
    await user.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    const puts = calls.filter((call) => call.method === "PUT");
    expect(puts).toHaveLength(2);
    expect(puts[1]?.body).toEqual({ footer: null });
  });
});
