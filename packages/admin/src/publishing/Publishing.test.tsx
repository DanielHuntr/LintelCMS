import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { PublishTarget } from "./publishing.api.js";
import { PublishingPage } from "./PublishingPage.js";

const cpanel: PublishTarget = {
  id: "t1",
  name: "My cPanel hosting",
  siteId: null,
  kind: "ftp",
  options: {
    host: "ftp.example.com",
    username: "baker",
    remoteFolder: "public_html",
    siteAddress: "https://www.example.com",
  },
  formDelivery: "bridge",
  publishAutomatically: false,
  deleteLimit: 50,
  lastPublishedAt: null,
  saved: {
    password: true,
    privateKey: false,
    accessKeyId: false,
    secretAccessKey: false,
    stripeWebhookSecret: false,
  },
  warnings: [],
};

afterEach(() => vi.restoreAllMocks());

describe("Settings → Publishing", () => {
  it("guides a first destination, sending the password but never showing one", async () => {
    const { calls } = mockApi(({ method, url, body }) => {
      if (url.pathname === "/publishing/targets" && method === "GET") return { targets: [] };
      if (url.pathname === "/sites") return { sites: [] };
      if (url.pathname === "/publishing/targets" && method === "POST")
        return { ...cpanel, ...(body as object) };
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<PublishingPage />);

    expect(await screen.findByText("Publish to your own hosting")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add a destination" }));
    const dialog = screen.getByRole("dialog", { name: "Where should your website go?" });
    await userEvent.type(within(dialog).getByLabelText("Server address"), "ftp.example.com");
    await userEvent.type(within(dialog).getByLabelText("Username"), "baker");
    await userEvent.type(within(dialog).getByLabelText("Password"), "correct horse");
    await userEvent.selectOptions(within(dialog).getByLabelText("Security"), "none");
    expect(within(dialog).getByText(/Plain FTP sends your password/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Save" }));

    const created = calls.find((call) => call.method === "POST");
    expect(created?.body).toMatchObject({
      kind: "ftp",
      options: { host: "ftp.example.com", username: "baker", ftpSecurity: "none" },
      secrets: { password: "correct horse" },
    });
  });

  it("shows the destination as published once a publish ends (LINTEL-FUNC-036)", async () => {
    const run = {
      id: "r1",
      targetId: "t1",
      status: "succeeded",
      startedAt: "2026-11-04T01:38:00Z",
    };
    let published = false;
    mockApi(({ method, url }) => {
      if (url.pathname === "/publishing/targets") {
        return {
          targets: [{ ...cpanel, lastPublishedAt: published ? "2026-11-04T01:38:44Z" : null }],
        };
      }
      if (method === "POST" && url.pathname === "/publishing/targets/t1/publish") {
        published = true;
        return { ...run, status: "running" };
      }
      if (url.pathname === "/publishing/targets/t1/runs/r1") return run;
      if (url.pathname === "/publishing/targets/t1/runs") return { runs: [] };
      return undefined;
    });
    renderScreen(<PublishingPage />, { permissions: ["*"] });
    expect(await screen.findByText("Not published yet")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Publish website" }));

    expect(await screen.findByText(/^Last published/)).toBeInTheDocument();
  });

  it("says plainly what works on the hosting, and what doesn't", async () => {
    mockApi(({ method, url }) => {
      if (url.pathname === "/publishing/targets" && method === "GET") return { targets: [cpanel] };
      if (url.pathname === "/publishing/targets/t1/runs") return { runs: [] };
      if (url.pathname === "/sites") return { sites: [] };
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<PublishingPage />, {
      enabledPlugins: ["forms", "commerce", "analytics", "experiments"],
    });

    const list = await screen.findByRole("region", { name: "What works on this hosting" });
    expect(within(list).getByText(/Forms, through the PHP file/)).toBeInTheDocument();
    expect(within(list).getByText(/Shop: needs Stripe or Mollie connected/)).toBeInTheDocument();
    expect(within(list).getByText(/Member logins/)).toBeInTheDocument();
    expect(within(list).getByText(/cookie notice/)).toBeInTheDocument();
    expect(
      within(list).getByText(/Shop buttons and baskets placed in page designs/),
    ).toBeInTheDocument();
    expect(within(list).getByText(/Visitor counts: files can’t count visits/)).toBeInTheDocument();
    expect(within(list).getByText(/A\/B tests: each visitor needs a version/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish website" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeInTheDocument();
    expect(screen.getByText("Nothing published here yet.")).toBeInTheDocument();
  });
});
