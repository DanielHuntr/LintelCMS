import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderScreen } from "../testing/renderScreen.js";
import { HelpLauncher } from "./HelpLauncher.js";

async function openHelp() {
  const user = userEvent.setup();
  const { router } = renderScreen(<HelpLauncher />);
  await user.click(await screen.findByRole("button", { name: "Help for this screen" }));
  const panel = await screen.findByRole("complementary", { name: "Getting around" });
  return { user, router, panel };
}

describe("HelpLauncher", () => {
  it("opens the help for the current screen beside the page", async () => {
    const { panel } = await openHelp();

    expect(screen.getByRole("button", { name: "Help for this screen" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(panel).toHaveTextContent("The sidebar on the left lists the parts of Lintel");
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Getting around" })).toHaveFocus(),
    );
  });

  it("links to the full docs in a new tab", async () => {
    await openHelp();

    expect(screen.getByRole("link", { name: /Open the full docs/ })).toHaveAttribute(
      "target",
      "_blank",
    );
  });

  it("closes with Escape and puts focus back on the button", async () => {
    const { user } = await openHelp();

    await user.keyboard("{Escape}");

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Help for this screen" })).toHaveFocus();
  });

  it("moves between topics and back without leaving the screen", async () => {
    const { user, router } = await openHelp();

    await user.click(screen.getByRole("button", { name: "All help topics" }));
    await user.click(await screen.findByRole("button", { name: /Photos and files/ }));
    expect(await screen.findByRole("complementary", { name: "Photos and files" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Back" }));
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(await screen.findByRole("complementary", { name: "Getting around" })).toBeVisible();
    expect(router.state.location.pathname).toBe("/");
  });

  it("follows links between help pages inside the panel", async () => {
    const { user } = await openHelp();
    await user.click(screen.getByRole("button", { name: "All help topics" }));
    await user.click(await screen.findByRole("button", { name: /Using Lintel/ }));

    await user.click(await screen.findByRole("link", { name: "Set up Lintel" }));

    expect(await screen.findByRole("complementary", { name: "Setting up Lintel" })).toBeVisible();
  });

  it("switches to the new screen's help when the screen changes", async () => {
    const { router } = await openHelp();

    await router.navigate({ to: "/media" });

    expect(await screen.findByRole("complementary", { name: "Photos and files" })).toBeVisible();
  });

  describe("on a phone", () => {
    afterEach(() => vi.unstubAllGlobals());

    it("is a modal dialog: the page is inert and Escape anywhere closes it (LINTEL-A11Y-030)", async () => {
      vi.stubGlobal("matchMedia", (query: string) => ({
        matches: query.includes("max-width"),
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
      }));
      const user = userEvent.setup();
      renderScreen(
        <>
          <main id="page">
            <button type="button">On the page</button>
          </main>
          <HelpLauncher />
        </>,
      );
      const launcher = await screen.findByRole("button", { name: "Help for this screen" });
      await user.click(launcher);
      const dialog = await screen.findByRole("dialog", { name: "Getting around" });
      expect(dialog).toHaveAttribute("aria-modal", "true");
      expect(document.getElementById("page")).toHaveAttribute("inert");
      expect(launcher).toHaveAttribute("inert");

      // Escape closes it even when focus has left the panel (onto the body).
      (document.activeElement as HTMLElement | null)?.blur();
      await user.keyboard("{Escape}");
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(document.getElementById("page")).not.toHaveAttribute("inert");
      await waitFor(() => expect(launcher).toHaveFocus());
    });
  });
});
