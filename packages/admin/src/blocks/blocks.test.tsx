import type { PageNode } from "@lintel/builder-model";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlockTypesEditor } from "../content-types/BlockTypesEditor.js";
import type { DraftField } from "../content-types/blueprintDraft.js";
import { blockTypesForSaving } from "../content-types/blockTypesDraft.js";
import type { BlockType } from "../fields/field.types.js";
import { mockApi } from "../testing/mockApi.js";
import { renderScreen } from "../testing/renderScreen.js";
import { renamedProperties, withoutBindingsTo } from "./blockChanges.js";
import type { SiteBlock } from "./blocks.api.js";
import { BlocksPage } from "./BlocksPage.js";

afterEach(() => vi.restoreAllMocks());

const teamCard: SiteBlock = {
  id: "b1",
  handle: "team_card",
  name: "Team card",
  icon: "users",
  category: "Team",
  description: "A person with their role",
  source: "site",
  properties: [
    { handle: "name", label: "Name", type: "text", required: true, options: {} },
    { handle: "role", label: "Role", type: "text", required: false, options: {} },
  ],
  design: null,
  template: null,
  renamedProperties: {},
  version: 1,
  editable: true,
  usedOn: [{ entryId: "e1", title: "About", collection: "pages" }],
  usedIn: [],
  updatedAt: "2026-11-01T00:00:00.000Z",
};

const quote: SiteBlock = {
  ...teamCard,
  id: "b2",
  handle: "quote",
  name: "Quote",
  category: "",
  source: "code",
  editable: false,
  usedOn: [],
};

describe("Your site's blocks", () => {
  it("lists blocks by group, with who looks after them and where they're used", async () => {
    mockApi(() => ({ blocks: [teamCard, quote] }));
    renderScreen(<BlocksPage />);
    const row = await screen.findByRole("link", { name: /Team card/ });
    expect(row).toHaveAttribute("href", "/design/blocks/team_card");
    expect(row).toHaveTextContent("2 details to fill in · On 1 page");
    expect(row).toHaveTextContent("Made here");
    expect(screen.getByRole("link", { name: /Quote/ })).toHaveTextContent("Defined in code");
    expect(screen.getByRole("list", { name: "Team" })).toContainElement(row);
  });

  it("tells a new site how to make its first block", async () => {
    mockApi(() => ({ blocks: [] }));
    renderScreen(<BlocksPage />);
    expect(await screen.findByText("No blocks yet")).toBeInTheDocument();
    expect(screen.getByText(/choose Make into a block/)).toBeInTheDocument();
  });

  it("knows which properties were renamed, and drops bindings to removed ones", () => {
    const fields = [
      { handle: "full_name", key: "saved:name" },
      { handle: "role", key: "saved:role" },
      { handle: "email", key: "new-1" },
    ] as DraftField[];
    expect(renamedProperties(fields)).toEqual({ name: "full_name" });
    const design = {
      id: "card",
      type: "box",
      name: "",
      props: {},
      styles: { base: {} },
      hidden: false,
      locked: false,
      children: [
        {
          id: "h",
          type: "heading",
          name: "",
          props: {},
          styles: { base: {} },
          hidden: false,
          locked: false,
          children: [],
          bindings: { text: "role" },
        },
      ],
    } as PageNode;
    expect(withoutBindingsTo(design, ["role"]).children[0]?.bindings).toBeUndefined();
    expect(withoutBindingsTo(design, []).children[0]?.bindings).toEqual({ text: "role" });
  });
});

describe("site blocks in blocks fields", () => {
  it("offers the site's blocks, and saves one by name for the API to fill in", async () => {
    mockApi(({ url }) =>
      url.pathname.endsWith("/blocks") ? { blocks: [teamCard] } : { fieldtypes: [] },
    );
    const onChange = vi.fn<(blockTypes: BlockType[]) => void>();
    renderScreen(<BlockTypesEditor blockTypes={[]} onChange={onChange} problem={undefined} />);
    const picker = await screen.findByRole("combobox", { name: "Add one of your site’s blocks" });
    await userEvent.selectOptions(picker, "team_card");
    const [added] = onChange.mock.lastCall?.[0] ?? [];
    expect(added).toMatchObject({ handle: "team_card", name: "Team card", block: "team_card" });
    expect(blockTypesForSaving([added as BlockType], (field) => field)).toEqual([
      { handle: "team_card", name: "Team card", block: "team_card", fields: [] },
    ]);
  });

  it("shows a site block's type as the block, with its fields listed", async () => {
    mockApi(() => ({ blocks: [teamCard], fieldtypes: [] }));
    renderScreen(
      <BlockTypesEditor
        blockTypes={[
          {
            handle: "team_card",
            name: "Team card",
            block: "team_card",
            fields: teamCard.properties,
          },
        ]}
        onChange={vi.fn()}
        problem={undefined}
      />,
    );
    const card = await screen.findByText("Your block: Team card");
    const item = card.closest("li") as HTMLElement;
    expect(within(item).getByText("Name, Role")).toBeInTheDocument();
    expect(within(item).queryByRole("textbox")).not.toBeInTheDocument();
  });
});
