import {
  createCountingNodeIds,
  createEmptyPage,
  createNode,
  findNode,
  type PageDocument,
  standardCatalogue,
} from "@lintel/builder-model";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PageBuilder } from "./PageBuilder.js";
import {
  createMemoryPreferenceStore,
  type PreferenceStore,
} from "./preferences/builder-preferences.js";

function headingPage(): PageDocument {
  const page = createEmptyPage();
  const section = createNode(
    {
      type: "section",
      name: "Welcome",
      children: [{ type: "heading", name: "Title", props: { text: "Fresh bread", level: 1 } }],
    },
    standardCatalogue,
    createCountingNodeIds(),
  );
  return { ...page, root: { ...page.root, children: [section] } };
}

function renderBuilder(
  document: PageDocument,
  preferences: PreferenceStore = createMemoryPreferenceStore({ tourSeen: "yes" }),
  canEditCode = false,
) {
  const onChange = vi.fn<(document: PageDocument) => void>();
  render(
    <PageBuilder
      initialDocument={document}
      onChange={onChange}
      title="Home"
      canEditCode={canEditCode}
      createId={createCountingNodeIds("new")}
      preferences={preferences}
      toolbarEnd={
        <button type="button" data-tour="publish">
          Publish
        </button>
      }
    />,
  );
  const latest = () => onChange.mock.lastCall?.[0] as PageDocument;
  return { latest };
}

async function selectTitle(user: ReturnType<typeof userEvent.setup>) {
  await user.click(within(screen.getByRole("tree")).getByRole("treeitem", { name: "Title" }));
}

describe("animating in the builder", () => {
  it("saves a preset on the element, and removes it again", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(headingPage());
    await selectTitle(user);
    await user.click(screen.getByRole("tab", { name: "Animate" }));
    expect(screen.getByRole("heading", { name: "Animation for Title" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Fade up/ }));
    const animated = findNode(latest().root, "n2");
    expect(animated?.animation?.presetId).toBe("fade-up");
    expect(animated?.animation?.spec.trigger.type).toBe("inView");
    expect(screen.getByRole("status")).toHaveTextContent("");

    await user.click(screen.getByRole("button", { name: "Remove animation" }));
    expect(findNode(latest().root, "n2")?.animation).toBeUndefined();
    expect(screen.getByRole("status")).toHaveTextContent("Removed the animation from Title");
  });

  it("undoes an animation like any other change", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(headingPage());
    await selectTitle(user);
    await user.click(screen.getByRole("tab", { name: "Animate" }));
    await user.click(screen.getByRole("button", { name: /^Pop in/ }));
    expect(findNode(latest().root, "n2")?.animation?.presetId).toBe("pop-in");
    await user.click(screen.getByRole("button", { name: "Undo: Animated Title" }));
    expect(findNode(latest().root, "n2")?.animation).toBeUndefined();
  });
});

describe("skill levels", () => {
  it("keeps things simple for beginners", async () => {
    const user = userEvent.setup();
    renderBuilder(headingPage());
    expect(screen.getByRole("button", { name: "Tools: Beginner" })).toBeInTheDocument();
    await selectTitle(user);
    expect(screen.queryByRole("radio", { name: "Advanced" })).not.toBeInTheDocument();
    expect(screen.getByText(/Choose Designer in Tools/)).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Animate" }));
    await user.click(screen.getByRole("button", { name: /^Fade up/ }));
    expect(screen.queryByRole("radio", { name: "Advanced" })).not.toBeInTheDocument();
    expect(screen.getByText(/Switch to Designer to open the timeline/)).toBeInTheDocument();
  });

  it("shows every style and the timeline to designers, and remembers the choice", async () => {
    const user = userEvent.setup();
    const preferences = createMemoryPreferenceStore({ tourSeen: "yes" });
    renderBuilder(headingPage(), preferences);
    await user.click(screen.getByRole("button", { name: "Tools: Beginner" }));
    await user.click(screen.getByRole("radio", { name: /Designer/ }));
    expect(screen.getByRole("status")).toHaveTextContent("Showing the Designer tools");
    expect(preferences.read("skillLevel")).toBe("designer");
    await selectTitle(user);
    expect(screen.getByRole("radio", { name: "Advanced" })).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Animate" }));
    await user.click(screen.getByRole("button", { name: /^Fade up/ }));
    expect(screen.getByRole("radio", { name: "Advanced" })).toBeInTheDocument();
  });

  it("adds the Code panel for developers who may edit code", () => {
    renderBuilder(
      headingPage(),
      createMemoryPreferenceStore({ tourSeen: "yes", skillLevel: "developer" }),
      true,
    );
    expect(screen.getByRole("tab", { name: "Code" })).toBeInTheDocument();
  });

  it("never shows developer tools without the permission, whatever was stored", () => {
    renderBuilder(
      headingPage(),
      createMemoryPreferenceStore({ tourSeen: "yes", skillLevel: "developer" }),
    );
    expect(screen.getByRole("button", { name: "Tools: Designer" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Code" })).not.toBeInTheDocument();
  });
});

describe("the guided tour", () => {
  it("shows itself the first time, step by step, and can be skipped with Escape", async () => {
    const user = userEvent.setup();
    const preferences = createMemoryPreferenceStore();
    renderBuilder(headingPage(), preferences);
    const tour = screen.getByRole("dialog", { name: "Welcome to your page builder" });
    expect(
      within(tour).getByRole("heading", { name: "Welcome to your page builder" }),
    ).toHaveFocus();
    expect(tour).toHaveTextContent("Step 1 of 8");
    await user.click(within(tour).getByRole("button", { name: "Next" }));
    expect(screen.getByRole("dialog", { name: "Select something" })).toHaveTextContent(
      "Step 2 of 8",
    );
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(
      screen.getByRole("dialog", { name: "Welcome to your page builder" }),
    ).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: /Welcome/ })).not.toBeInTheDocument();
    expect(preferences.read("tourSeen")).toBe("yes");
  });

  it("walks through to Publish and can be replayed from Help and tips", async () => {
    const user = userEvent.setup();
    renderBuilder(headingPage(), createMemoryPreferenceStore());
    for (let step = 1; step < 8; step += 1) {
      await user.click(screen.getByRole("button", { name: "Next" }));
    }
    expect(screen.getByRole("dialog", { name: "Publish it" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Start building" }));
    expect(screen.queryByRole("dialog", { name: "Publish it" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Help and tips" }));
    await user.click(screen.getByRole("button", { name: "Replay the tour" }));
    expect(
      screen.getByRole("dialog", { name: "Welcome to your page builder" }),
    ).toBeInTheDocument();
  });

  it("brings closed tips back", async () => {
    const user = userEvent.setup();
    renderBuilder(headingPage());
    await selectTitle(user);
    await user.click(screen.getByRole("button", { name: "Got it" }));
    expect(screen.queryByText(/Choose Designer in Tools/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Help and tips" }));
    await user.click(screen.getByRole("button", { name: "Show tips again" }));
    expect(screen.getByText(/Choose Designer in Tools/)).toBeInTheDocument();
  });
});

describe("starting from a template page", () => {
  it("fills an empty page with a whole page from the template library", async () => {
    const user = userEvent.setup();
    const { latest } = renderBuilder(createEmptyPage());
    await user.click(screen.getByRole("button", { name: /^Bakery and café: Home/ }));
    const sections = latest().root.children;
    expect(sections.length).toBeGreaterThanOrEqual(3);
    expect(sections[0]?.name).toBe("Hero");
    expect(screen.getByRole("status")).toHaveTextContent("Started from Bakery and café: Home");
  });
});
