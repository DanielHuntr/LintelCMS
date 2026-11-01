import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContentTypesPage } from "../content-types/ContentTypesPage.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { ContentModelStatus } from "./contentModelSync.api.js";

const blueprints = [
  {
    id: "b1",
    handle: "post",
    name: "Blog post",
    kind: "entry",
    version: 1,
    updatedAt: "",
    fields: [],
  },
];

function status(overrides: Partial<ContentModelStatus>): ContentModelStatus {
  return {
    managedInCode: true,
    editableInAdmin: false,
    folder: "content-model",
    mode: "production",
    pending: [],
    notices: [],
    problems: [],
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("content types managed in code", () => {
  it("explains that content types are managed in code, and hides New content type", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/blueprints") return { blueprints };
      if (url.pathname === "/content-model/status") return status({});
      throw new Error(`Unexpected ${url.pathname}`);
    });
    renderScreen(<ContentTypesPage />);

    expect(await screen.findByRole("heading", { name: "Managed in code" })).toBeInTheDocument();
    expect(screen.getByText("content-model")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "New content type" })).not.toBeInTheDocument();
  });

  it("says changes are saved to the files when editing is allowed", async () => {
    mockApi(({ url }) => {
      if (url.pathname === "/blueprints") return { blueprints };
      if (url.pathname === "/content-model/status") {
        return status({ editableInAdmin: true, mode: "development" });
      }
      throw new Error(`Unexpected ${url.pathname}`);
    });
    renderScreen(<ContentTypesPage />);

    expect(await screen.findByRole("heading", { name: "Saved to code too" })).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "New content type" })).toBeInTheDocument();
  });

  it("lists changes that would delete content, and makes them once confirmed", async () => {
    const api = mockApi(({ method, url }) => {
      if (url.pathname === "/blueprints") return { blueprints };
      if (url.pathname === "/content-model/status") {
        return status({
          pending: [
            {
              summary: "Remove the field `excerpt` from Blog post",
              impact: "Removing `excerpt` would delete text from 14 entries in Blog posts.",
              destructive: true,
            },
          ],
        });
      }
      if (method === "POST" && url.pathname === "/content-model/pending/apply") {
        return status({});
      }
      throw new Error(`Unexpected ${method} ${url.pathname}`);
    });
    renderScreen(<ContentTypesPage />);

    const pending = await screen.findByRole("region", {
      name: "Changes waiting for you to confirm",
    });
    expect(
      within(pending).getByText(
        "Removing `excerpt` would delete text from 14 entries in Blog posts.",
      ),
    ).toBeInTheDocument();

    await userEvent.click(within(pending).getByRole("button", { name: "Make these changes" }));
    await userEvent.click(await screen.findByRole("button", { name: "Make changes" }));

    await waitFor(() =>
      expect(api.calls.some((call) => call.url.pathname === "/content-model/pending/apply")).toBe(
        true,
      ),
    );
  });

  it("shows a notice when a change here was undone by a file, and dismisses it", async () => {
    const api = mockApi(({ method, url }) => {
      if (url.pathname === "/blueprints") return { blueprints };
      if (url.pathname === "/content-model/status") {
        return status({
          editableInAdmin: true,
          notices: [{ id: "n1", message: "The version in the file was kept.", createdAt: "" }],
        });
      }
      if (method === "DELETE") return undefined;
      throw new Error(`Unexpected ${method} ${url.pathname}`);
    });
    renderScreen(<ContentTypesPage />);

    expect(await screen.findByText("The version in the file was kept.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dismiss" }));

    await waitFor(() =>
      expect(api.calls.some((call) => call.url.pathname === "/content-model/notices/n1")).toBe(
        true,
      ),
    );
  });
});
