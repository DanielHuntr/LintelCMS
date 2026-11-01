import { readAdminMessage, wrapMessage } from "@lintel/app-bridge/protocol";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FileText } from "lucide-react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { visibleExtensions } from "../plugins/pluginContributions.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { AppExtensions, AppManifest, AppResponse } from "./apps.api.js";
import { AppDetailPage } from "./AppDetailPage.js";
import { AppFrame } from "./AppFrame.js";
import { AppsPage } from "./AppsPage.js";
import { AppToastsProvider } from "./AppToasts.js";
import { appAsAdminPlugin } from "./installedAppPlugins.js";

const APP_ORIGIN = "https://stock.example.com";

const manifest: AppManifest = {
  name: "Stock Sync",
  handle: "stock-sync",
  description: "Keeps product pages in step with the warehouse.",
  appUrl: APP_ORIGIN,
  developer: { name: "Warehouse Tools Ltd" },
  scopes: ["read_content", "write_content"],
  webhooks: [{ event: "entry.published", url: `${APP_ORIGIN}/webhooks` }],
  admin: {
    page: { label: "Stock", url: `${APP_ORIGIN}/admin` },
    dashboardWidgets: [
      {
        id: "low-stock",
        title: "Low stock",
        description: "Running out soon",
        url: `${APP_ORIGIN}/w`,
        size: "medium",
      },
    ],
    editorPanels: [
      { id: "stock", title: "Stock level", url: `${APP_ORIGIN}/p`, collections: ["products"] },
    ],
    settingsPage: { url: `${APP_ORIGIN}/settings` },
  },
};

const installedApp: AppResponse = {
  id: "8d3f1c2e-0000-4000-8000-000000000001",
  handle: "stock-sync",
  name: "Stock Sync",
  manifest,
  manifestUrl: `${APP_ORIGIN}/lintel-app.json`,
  scopes: ["read_content", "write_content"],
  clientId: "app_0123456789abcdef0123",
  clientSecretStart: "lintelapp_AbCd",
  installedAt: "2026-10-30T09:00:00Z",
  installedBy: { id: "u1", name: "Ada Lovelace" },
  lastUsedAt: null,
};

const extensions: AppExtensions = {
  id: installedApp.id,
  handle: "stock-sync",
  name: "Stock Sync",
  iconUrl: null,
  origin: APP_ORIGIN,
  admin: manifest.admin,
};

afterEach(() => vi.restoreAllMocks());

describe("Settings → Apps", () => {
  it("adds an app from its address after showing what it asks for in plain English", async () => {
    const { calls } = mockApi(({ method, url }) => {
      if (url.pathname === "/apps" && method === "GET") return { apps: [] };
      if (url.pathname === "/apps/preview") {
        return { manifest, manifestUrl: `${APP_ORIGIN}/lintel-app.json`, alreadyInstalled: false };
      }
      if (url.pathname === "/apps" && method === "POST") {
        return { app: installedApp, clientSecret: "lintelapp_the-whole-secret" };
      }
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<AppsPage />);

    expect(await screen.findByText("No apps yet")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Add an app" }));
    const dialog = screen.getByRole("dialog", { name: "Add an app" });
    await userEvent.type(
      within(dialog).getByLabelText("The app’s address"),
      `${APP_ORIGIN}/lintel-app.json`,
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    const review = await screen.findByRole("dialog", { name: "Install Stock Sync?" });
    expect(within(review).getByText("Made by Warehouse Tools Ltd")).toBeInTheDocument();
    expect(
      within(review).getByText("See all your content, including drafts, and how it is organised"),
    ).toBeInTheDocument();
    expect(
      within(review).getByText("Create, edit and delete entries (but not publish them)"),
    ).toBeInTheDocument();
    expect(within(review).getByText("Something is published")).toBeInTheDocument();
    expect(
      within(review).getByText("A panel in the editor: Stock level, for products"),
    ).toBeInTheDocument();
    await userEvent.click(within(review).getByRole("button", { name: "Install app" }));

    const done = await screen.findByRole("dialog", { name: "Stock Sync is installed" });
    expect(within(done).getByText("lintelapp_the-whole-secret")).toBeInTheDocument();
    expect(within(done).getByText("app_0123456789abcdef0123")).toBeInTheDocument();
    expect(
      calls.find((call) => call.method === "POST" && call.url.pathname === "/apps")?.body,
    ).toEqual({
      manifestUrl: `${APP_ORIGIN}/lintel-app.json`,
      approvedScopes: ["read_content", "write_content"],
    });
  });

  it("says what is wrong with pasted details that aren't JSON, without asking the server", async () => {
    const { calls } = mockApi(() => ({ apps: [] }));
    renderScreen(<AppsPage />);

    await userEvent.click(await screen.findByRole("button", { name: "Add an app" }));
    const dialog = screen.getByRole("dialog", { name: "Add an app" });
    await userEvent.click(within(dialog).getByRole("radio", { name: "Pasted details" }));
    await userEvent.type(within(dialog).getByLabelText("The app’s details"), '"name": "Half');
    await userEvent.click(within(dialog).getByRole("button", { name: "Continue" }));

    expect(within(dialog).getByText(/doesn’t look like the whole file/)).toBeInTheDocument();
    expect(calls.some((call) => call.url.pathname === "/apps/preview")).toBe(false);
  });

  it("uninstalls an app after saying what will happen", async () => {
    const { calls } = mockApi(({ method, url }) => {
      if (method === "GET") return installedApp;
      if (method === "DELETE") return undefined;
      throw new Error(`Unexpected request: ${method} ${url.pathname}`);
    });
    renderScreen(<AppDetailPage appId={installedApp.id} />);

    expect(await screen.findByText("app_0123456789abcdef0123")).toBeInTheDocument();
    expect(screen.getByText("lintelapp_AbCd…")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Uninstall" }));
    const confirm = screen.getByRole("alertdialog", { name: "Uninstall Stock Sync?" });
    expect(within(confirm).getByText(/stop working straight away/)).toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole("button", { name: "Uninstall" }));

    await waitFor(() =>
      expect(
        calls.some(
          (call) => call.method === "DELETE" && call.url.pathname === `/apps/${installedApp.id}`,
        ),
      ).toBe(true),
    );
  });
});

describe("an app in the admin's extension points", () => {
  const app = appAsAdminPlugin(extensions);
  const plugin = {
    id: "bookings",
    sidebarItems: [{ path: "/bookings", label: "Bookings", icon: FileText }],
  };

  it("is on while installed, whatever plugins are switched on", () => {
    const viewer = { permissions: ["*"], enabledPlugins: [] };
    expect(
      visibleExtensions([plugin], [app], "sidebarItems", viewer).map((item) => item.label),
    ).toEqual(["Stock"]);
    expect(visibleExtensions([plugin], [app], "dashboardWidgets", viewer)[0]).toMatchObject({
      pluginId: "app-stock-sync",
      id: "low-stock",
    });
  });

  it("keeps its settings page for people who may see settings", () => {
    const editor = { permissions: ["entries:read"], enabledPlugins: [] };
    expect(visibleExtensions([], [app], "settingsRows", editor)).toEqual([]);
    expect(visibleExtensions([], [app], "screens", editor).map((screen) => screen.path)).toEqual([
      "/apps/stock-sync",
    ]);
  });
});

describe("an app's frame", () => {
  function renderFrame() {
    const { calls } = mockApi(({ url }) => {
      if (url.pathname === `/apps/${extensions.id}/session-token`) {
        return { token: "header.payload.signature", expiresAt: "2026-11-01T12:05:00.000Z" };
      }
      throw new Error(`Unexpected request: ${url.pathname}`);
    });
    renderScreen(
      <AppToastsProvider>
        <AppFrame
          app={extensions}
          url={`${APP_ORIGIN}/w`}
          extension="widget"
          extensionId="low-stock"
          title="Stock Sync: Low stock"
        />
      </AppToastsProvider>,
    );
    return { calls };
  }

  async function frameWindow() {
    const frame = await screen.findByTitle("Stock Sync: Low stock");
    const contentWindow = (frame as HTMLIFrameElement).contentWindow;
    if (!contentWindow) throw new Error("The frame has no window");
    return {
      frame,
      contentWindow,
      posted: vi.spyOn(contentWindow, "postMessage").mockImplementation(() => undefined),
    };
  }

  function sendFromFrame(data: unknown, origin: string, source: Window) {
    act(() => {
      window.dispatchEvent(new MessageEvent("message", { data, origin, source }));
    });
  }

  it("is sandboxed, asks for no browser features, and tells the page who to talk to", async () => {
    renderFrame();
    const { frame } = await frameWindow();

    expect(frame.getAttribute("sandbox")?.split(" ").sort()).toEqual([
      "allow-downloads",
      "allow-forms",
      "allow-popups",
      "allow-popups-to-escape-sandbox",
      "allow-same-origin",
      "allow-scripts",
    ]);
    expect(frame.getAttribute("allow")).toBe("");
    const src = new URL(frame.getAttribute("src") ?? "");
    expect(src.origin).toBe(APP_ORIGIN);
    expect(src.searchParams.get("lintelOrigin")).toBe(window.location.origin);
  });

  it("sends a session token and the context to the app's origin only, when the page is ready", async () => {
    const { calls } = renderFrame();
    const { contentWindow, posted } = await frameWindow();

    sendFromFrame(wrapMessage({ type: "ready" }), APP_ORIGIN, contentWindow);

    await waitFor(() => expect(posted).toHaveBeenCalledTimes(1));
    const [message, targetOrigin] = posted.mock.calls[0] ?? [];
    expect(targetOrigin).toBe(APP_ORIGIN);
    expect(readAdminMessage(message)).toMatchObject({
      type: "context",
      sessionToken: "header.payload.signature",
      context: {
        appId: extensions.id,
        extension: "widget",
        extensionId: "low-stock",
        user: { name: "Ada Lovelace" },
      },
    });
    expect(calls.filter((call) => call.url.pathname.endsWith("/session-token"))).toHaveLength(1);
  });

  it("ignores the same message from another origin or another window", async () => {
    const { calls } = renderFrame();
    const { contentWindow, posted } = await frameWindow();

    sendFromFrame(wrapMessage({ type: "ready" }), "https://evil.example.com", contentWindow);
    sendFromFrame(wrapMessage({ type: "ready" }), APP_ORIGIN, window);
    sendFromFrame({ type: "ready" }, APP_ORIGIN, contentWindow);

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(calls).toHaveLength(0);
    expect(posted).not.toHaveBeenCalled();
  });

  it("follows the page's height and shows its toasts, saying which app they are from", async () => {
    renderFrame();
    const { frame, contentWindow } = await frameWindow();

    sendFromFrame(wrapMessage({ type: "resize", height: 412 }), APP_ORIGIN, contentWindow);
    sendFromFrame(
      wrapMessage({ type: "toast", message: "Stock updated", tone: "success" }),
      APP_ORIGIN,
      contentWindow,
    );

    expect(frame.style.height).toBe("412px");
    expect(screen.getByRole("status")).toHaveTextContent("Stock Sync: Stock updated");
  });
});
