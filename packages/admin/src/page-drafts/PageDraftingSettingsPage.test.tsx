import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import type { ModelStatus } from "./pageDrafts.api.js";
import { PageDraftingSettingsPage } from "./PageDraftingSettingsPage.js";

const GIGABYTE = 1024 ** 3;

function statusWith(changes: Partial<ModelStatus> = {}): ModelStatus {
  return {
    state: "not-installed",
    model: {
      name: "Qwen2.5 7B Instruct",
      maker: "The Qwen team at Alibaba Cloud",
      licence: "Apache License 2.0",
      licenceUrl: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/blob/abc/LICENSE",
      sourcePage: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF",
      files: [
        {
          name: "part-1.gguf",
          url: "https://huggingface.co/Qwen/Qwen2.5-7B-Instruct-GGUF/resolve/abc/part-1.gguf",
          sizeInBytes: 4 * GIGABYTE,
          sha256: "a".repeat(64),
        },
      ],
      sizeInBytes: 4 * GIGABYTE,
      memoryNeededInBytes: 6 * GIGABYTE,
    },
    folder: "/data/models/qwen",
    bytesOnDisk: 0,
    problem: null,
    server: {
      totalMemoryInBytes: 16 * GIGABYTE,
      freeDiskInBytes: 100 * GIGABYTE,
      hasEnoughMemory: true,
      hasEnoughDisk: true,
    },
    ...changes,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("Settings → Page drafting", () => {
  it("says what will be downloaded, from where, to where, before anything happens", async () => {
    const { calls } = mockApi(() => statusWith());
    renderScreen(<PageDraftingSettingsPage />, { enabledPlugins: ["drafts"] });
    expect(await screen.findByText("Qwen2.5 7B Instruct")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Apache License 2.0" })).toHaveAttribute(
      "href",
      expect.stringContaining("/LICENSE"),
    );
    expect(screen.getByText(/resolve\/abc\/part-1\.gguf$/)).toBeInTheDocument();
    expect(screen.getByText("/data/models/qwen")).toBeInTheDocument();
    expect(screen.getByText("About 6.0 GB free while it writes")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Nothing about your site is sent anywhere, now or later. After this it works offline.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download 4.0 GB" })).toBeInTheDocument();
    expect(calls.map((call) => call.method)).toEqual(["GET"]);
  });

  it("shows the folder and file names for copying the model in by hand, then checks them", async () => {
    const user = userEvent.setup();
    let checking = false;
    const { calls } = mockApi(({ method }) => {
      if (method === "POST") checking = true;
      return statusWith(checking ? { state: "checking" } : {});
    });
    renderScreen(<PageDraftingSettingsPage />, { enabledPlugins: ["drafts"] });
    await user.click(await screen.findByRole("button", { name: "I’ll copy the file in myself" }));
    expect(screen.getByText("part-1.gguf")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Check files" }));
    expect(await screen.findByText(/Checking the files/)).toBeInTheDocument();
    expect(calls.some((call) => call.url.pathname === "/drafts/model/check")).toBe(true);
  });

  it("shows progress while downloading, with Cancel", async () => {
    mockApi(() => statusWith({ state: "downloading", bytesOnDisk: 1 * GIGABYTE }));
    renderScreen(<PageDraftingSettingsPage />, { enabledPlugins: ["drafts"] });
    expect(await screen.findByRole("progressbar")).toHaveAttribute("aria-valuenow", "25");
    expect(screen.getByText("1.0 GB of 4.0 GB")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Cancel download" })).toBeInTheDocument();
  });

  it("explains plainly when the server is too small", async () => {
    mockApi(() =>
      statusWith({
        server: {
          totalMemoryInBytes: 4 * GIGABYTE,
          freeDiskInBytes: 1 * GIGABYTE,
          hasEnoughMemory: false,
          hasEnoughDisk: false,
        },
      }),
    );
    renderScreen(<PageDraftingSettingsPage />, { enabledPlugins: ["drafts"] });
    expect(await screen.findByText(/This server has 4.0 GB of memory/)).toBeInTheDocument();
    expect(screen.getByText(/1.0 GB of free disk space/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download 4.0 GB" })).toBeDisabled();
  });

  it("shows what's installed, and removes it after asking", async () => {
    const user = userEvent.setup();
    const { calls } = mockApi(({ method }) =>
      statusWith(method === "DELETE" ? {} : { state: "installed", bytesOnDisk: 4 * GIGABYTE }),
    );
    renderScreen(<PageDraftingSettingsPage />, { enabledPlugins: ["drafts"] });
    expect(await screen.findByText("Installed and checked")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Remove the writing model?" });
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));
    expect(calls.some((call) => call.method === "DELETE")).toBe(true);
  });
});
