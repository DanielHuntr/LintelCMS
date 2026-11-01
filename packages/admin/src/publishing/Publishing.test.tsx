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

  it("says plainly what works on the hosting, and what doesn't", async () => {
    mockApi(({ method, url }) => {
      if (url.pathname === "/publishing/targets" && method === "GET") return { targets: [cpanel] };
      if (url.pathname === "/publishing/targets/t1/runs") return { runs: [] };
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<PublishingPage />, { enabledPlugins: ["forms", "commerce"] });

    const list = await screen.findByRole("region", { name: "What works on this hosting" });
    expect(within(list).getByText(/Forms, through the PHP file/)).toBeInTheDocument();
    expect(within(list).getByText(/Shop: needs Stripe or Mollie connected/)).toBeInTheDocument();
    expect(within(list).getByText(/Member logins/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publish website" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Test connection" })).toBeInTheDocument();
    expect(screen.getByText("Nothing published here yet.")).toBeInTheDocument();
  });
});
