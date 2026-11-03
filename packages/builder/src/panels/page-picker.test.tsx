import { pageLinkHref } from "@lintel/builder-model";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { LinkInputField, LinkListField } from "./content-fields.js";
import {
  type PageFinder,
  PageFinderContext,
  type PagePicker,
  PagePickerContext,
} from "./page-picker.js";

const ABOUT_ID = "0b9d2c1e-5f3a-4c6b-8d7e-1a2b3c4d5e6f";
const GONE_ID = "9f8e7d6c-5b4a-4321-8765-0fedcba98765";

const aboutPage: PagePicker = () =>
  Promise.resolve({ id: ABOUT_ID, url: "/about-us", title: "About us" });
const findPage: PageFinder = (entryId) =>
  Promise.resolve(entryId === ABOUT_ID ? { title: "About us" } : null);

function WithPages({ children }: { children: ReactNode }) {
  return (
    <PagePickerContext value={aboutPage}>
      <PageFinderContext value={findPage}>{children}</PageFinderContext>
    </PagePickerContext>
  );
}

describe("choosing a page for a link in the builder", () => {
  it("links a button to the page itself, and shows the page's title", async () => {
    const onChange = vi.fn();
    render(
      <WithPages>
        <LinkInputField label="Where it goes" value="" onChange={onChange} />
      </WithPages>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose a page…" }));

    expect(onChange).toHaveBeenCalledWith(pageLinkHref(ABOUT_ID));
    expect(await screen.findByDisplayValue("About us")).toHaveAttribute("readonly");
    expect(screen.queryByDisplayValue(/lintel:page/)).not.toBeInTheDocument();

    // Back to typing an address.
    await userEvent.click(screen.getByRole("button", { name: "Type an address instead" }));
    expect(onChange).toHaveBeenLastCalledWith("");
    expect(screen.getByLabelText("Where it goes")).not.toHaveAttribute("readonly");
  });

  it("says plainly when the linked page no longer exists", async () => {
    render(
      <WithPages>
        <LinkInputField label="Where it goes" value={pageLinkHref(GONE_ID)} onChange={vi.fn()} />
      </WithPages>,
    );

    expect(
      await screen.findByText(
        "This page no longer exists. Choose another page, or type an address.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Where it goes")).toHaveAttribute("aria-invalid", "true");
  });

  it("links a link list's item to the page, and fills its words when there are none", async () => {
    const onChange = vi.fn();
    render(
      <WithPages>
        <LinkListField
          label="Links"
          value={[
            { label: "", href: "" },
            { label: "Read more", href: "https://example.com" },
          ]}
          onChange={onChange}
        />
      </WithPages>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose a page for link 2" }));

    expect(onChange).toHaveBeenLastCalledWith([
      { label: "", href: "" },
      { label: "Read more", href: pageLinkHref(ABOUT_ID) },
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Choose a page for link 1" }));
    expect(onChange).toHaveBeenLastCalledWith([
      { label: "About us", href: pageLinkHref(ABOUT_ID) },
      { label: "Read more", href: "https://example.com" },
    ]);
  });

  it("shows a linked item's page title in a link list", async () => {
    render(
      <WithPages>
        <LinkListField
          label="Links"
          value={[{ label: "Who we are", href: pageLinkHref(ABOUT_ID) }]}
          onChange={vi.fn()}
        />
      </WithPages>,
    );
    expect(await screen.findByDisplayValue("About us")).toHaveAccessibleName("Link 1 address");
  });

  it("shows the newly selected element's link, not the last one's", async () => {
    const { rerender } = render(
      <WithPages>
        <LinkInputField label="Where it goes" value={pageLinkHref(ABOUT_ID)} onChange={vi.fn()} />
      </WithPages>,
    );
    expect(await screen.findByDisplayValue("About us")).toBeInTheDocument();
    rerender(
      <WithPages>
        <LinkInputField label="Where it goes" value="/contact" onChange={vi.fn()} />
      </WithPages>,
    );
    expect(screen.getByLabelText("Where it goes")).toHaveValue("/contact");
  });

  it("offers no picker when the app gives none, and a closed picker changes nothing", async () => {
    const onChange = vi.fn();
    const { unmount } = render(
      <LinkInputField label="Where it goes" value="" onChange={onChange} />,
    );
    expect(screen.queryByRole("button", { name: "Choose a page…" })).not.toBeInTheDocument();
    unmount();

    render(
      <PagePickerContext value={() => Promise.resolve(null)}>
        <LinkInputField label="Where it goes" value="/contact" onChange={onChange} />
      </PagePickerContext>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Choose a page…" }));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Where it goes")).toHaveValue("/contact");
  });
});
