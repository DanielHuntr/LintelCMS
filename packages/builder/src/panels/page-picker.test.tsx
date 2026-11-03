import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LinkInputField, LinkListField } from "./content-fields.js";
import { type PagePicker, PagePickerContext } from "./page-picker.js";

const aboutPage: PagePicker = () => Promise.resolve({ url: "/about-us", title: "About us" });

describe("choosing a page for a link in the builder", () => {
  it("fills a button's address from the app's page picker", async () => {
    const onChange = vi.fn();
    render(
      <PagePickerContext value={aboutPage}>
        <LinkInputField label="Where it goes" value="" onChange={onChange} />
      </PagePickerContext>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose a page…" }));

    expect(onChange).toHaveBeenCalledWith("/about-us");
    expect(screen.getByLabelText("Where it goes")).toHaveValue("/about-us");
  });

  it("fills a link list's address, and its words when there are none", async () => {
    const onChange = vi.fn();
    render(
      <PagePickerContext value={aboutPage}>
        <LinkListField
          label="Links"
          value={[
            { label: "", href: "" },
            { label: "Read more", href: "https://example.com" },
          ]}
          onChange={onChange}
        />
      </PagePickerContext>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Choose a page for link 2" }));

    expect(onChange).toHaveBeenLastCalledWith([
      { label: "", href: "" },
      { label: "Read more", href: "/about-us" },
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Choose a page for link 1" }));
    expect(onChange).toHaveBeenLastCalledWith([
      { label: "About us", href: "/about-us" },
      { label: "Read more", href: "https://example.com" },
    ]);
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
