import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { apiErrorResponse, mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { ApiToken } from "./apiAccess.api.js";
import { ApiAccessPage } from "./ApiAccessPage.js";
import { listOperations } from "./openApiReference.js";

const websiteToken: ApiToken = {
  id: "t1",
  name: "Marketing website",
  access: "read",
  tokenStart: "lintel_3fA9",
  createdAt: "2026-10-30T09:00:00Z",
  lastUsedAt: null,
  createdBy: { id: "u1", name: "Ada Lovelace" },
};

function serveApiAccess(tokens: ApiToken[] = []) {
  let access = { requireToken: false, allowedOrigins: [] as string[] };
  return mockApi(({ method, url, body }) => {
    if (url.pathname === "/api-tokens" && method === "GET") return { tokens };
    if (url.pathname === "/api-tokens" && method === "POST") {
      const { name } = body as { name: string };
      if (name.trim() === "") {
        throw apiErrorResponse(400, "INVALID_REQUEST", "Please give the token a name");
      }
      return { token: { ...websiteToken, id: "t2", name }, secret: "lintel_the-whole-secret" };
    }
    if (url.pathname === "/delivery-access" && method === "GET") return access;
    if (url.pathname === "/delivery-access" && method === "PUT") {
      access = { ...access, ...(body as object) };
      return access;
    }
    throw new Error(`Unexpected request: ${method} ${url.pathname}`);
  });
}

afterEach(() => vi.restoreAllMocks());

describe("the API access screen", () => {
  it("guides people to make their first token, and shows it once", async () => {
    const { calls } = serveApiAccess();
    renderScreen(<ApiAccessPage />);

    expect(await screen.findByText("No tokens yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "New token" }));
    const dialog = screen.getByRole("dialog", { name: "New API token" });
    await userEvent.type(within(dialog).getByLabelText("Name"), "Nightly import");
    await userEvent.click(within(dialog).getByRole("radio", { name: "Read and write" }));
    expect(within(dialog).getByText(/Keep it on a server/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Create token" }));

    const created = await screen.findByRole("dialog", { name: "“Nightly import” is ready" });
    expect(within(created).getByText("lintel_the-whole-secret")).toBeInTheDocument();
    expect(within(created).getByText(/won’t show it again/)).toBeInTheDocument();
    expect(calls.find((call) => call.method === "POST")?.body).toEqual({
      name: "Nightly import",
      access: "readWrite",
    });

    await userEvent.click(within(created).getByRole("button", { name: "Done" }));
    expect(screen.queryByText("lintel_the-whole-secret")).not.toBeInTheDocument();
  });

  it("lists tokens by name without their secret", async () => {
    serveApiAccess([websiteToken]);
    renderScreen(<ApiAccessPage />);

    expect(await screen.findByText("Marketing website")).toBeInTheDocument();
    expect(screen.getByText("Read only · Not used yet")).toBeInTheDocument();
    expect(screen.getByText("lintel_3fA9…")).toBeInTheDocument();
  });

  it("turns on “only with a token” and adds a website address", async () => {
    const { calls } = serveApiAccess();
    renderScreen(<ApiAccessPage />);

    await userEvent.click(await screen.findByRole("switch", { name: "Only with a token" }));
    await waitFor(() =>
      expect(screen.getByRole("switch", { name: "Only with a token" })).toBeChecked(),
    );
    await userEvent.type(screen.getByLabelText("Website address"), "https://www.example.com");
    await userEvent.click(screen.getByRole("button", { name: "Add" }));

    expect(await screen.findByText("https://www.example.com")).toBeInTheDocument();
    const updates = calls.filter((call) => call.method === "PUT").map((call) => call.body);
    expect(updates).toEqual([
      { requireToken: true },
      { allowedOrigins: ["https://www.example.com"] },
    ]);
  });

  it("hides changes from people who can only look", async () => {
    serveApiAccess([websiteToken]);
    renderScreen(<ApiAccessPage />, { permissions: ["settings:read"] });

    expect(await screen.findByText("Marketing website")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "New token" })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Only with a token" })).toBeDisabled();
  });
});

describe("the API reference", () => {
  it("reads endpoints from the OpenAPI document", () => {
    const operations = listOperations({
      info: { title: "Lintel API" },
      paths: {
        "/delivery/{collection}": {
          get: {
            tags: ["Delivery"],
            summary: "List published entries",
            parameters: [
              { name: "collection", in: "path", required: true, schema: { type: "string" } },
            ],
            responses: { "200": {}, default: {} },
          },
        },
        "/entries/{id}": {
          delete: { tags: ["Entries"], "x-permission": "entries:delete", responses: { "204": {} } },
        },
      },
    });

    expect(operations).toEqual([
      expect.objectContaining({
        method: "GET",
        path: "/delivery/{collection}",
        permission: undefined,
        parameters: [{ name: "collection", in: "path", required: true, type: "string" }],
        responseCodes: ["200"],
      }),
      expect.objectContaining({ method: "DELETE", tag: "Entries", permission: "entries:delete" }),
    ]);
  });
});
