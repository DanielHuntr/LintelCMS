import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ConflictDialog } from "./ConflictDialog.js";
import { PeopleHere, PeopleOnRow } from "./PeopleHere.js";
import { personColour } from "./personColour.js";

describe("the question when two people changed the same thing", () => {
  it("says who changed what, and shows both versions", () => {
    render(
      <ConflictDialog
        personName="Sam Lee"
        items={[{ label: "Title", mine: "Welcome", theirs: "Hello" }]}
        onKeepMine={() => undefined}
        onUseTheirs={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Sam Lee changed this while you were working" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Title")).toBeInTheDocument();
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText(/kept in History/)).toBeInTheDocument();
  });

  it("does what the person chooses", async () => {
    const keepMine = vi.fn();
    const useTheirs = vi.fn();
    render(
      <ConflictDialog
        personName="Sam Lee"
        items={[{ label: "Title" }]}
        onKeepMine={keepMine}
        onUseTheirs={useTheirs}
        onClose={() => undefined}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Use Sam Lee’s" }));
    expect(useTheirs).toHaveBeenCalledOnce();
    await userEvent.click(screen.getByRole("button", { name: "Keep mine" }));
    expect(keepMine).toHaveBeenCalledOnce();
  });

  it("reads plainly when nobody is named", () => {
    render(
      <ConflictDialog
        personName={null}
        items={[{ label: "Title" }]}
        onKeepMine={() => undefined}
        onUseTheirs={() => undefined}
        onClose={() => undefined}
      />,
    );
    expect(
      screen.getByRole("heading", { name: "This changed while you were working" }),
    ).toBeInTheDocument();
  });
});

describe("who else is on a page", () => {
  const sam = { id: "1", name: "Sam Lee", avatarUrl: null, view: "design" as const };
  const ada = { id: "2", name: "Ada King", avatarUrl: null, view: "content" as const };

  it("takes no room when nobody else is here", () => {
    const { container } = render(<PeopleHere people={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("names one person, and lists where people are when pressed", async () => {
    render(<PeopleHere people={[sam]} />);
    await userEvent.click(screen.getByRole("button", { name: "Sam Lee is also on this page" }));
    expect(screen.getByText("In the designer")).toBeInTheDocument();
  });

  it("counts several, and shows the rest as a number", () => {
    const people = ["3", "4", "5", "6"].map((id) => ({ ...ada, id, name: `Person ${id}` }));
    render(<PeopleHere people={people} />);
    expect(
      screen.getByRole("button", { name: "4 other people are on this page" }),
    ).toHaveTextContent("+1");
  });

  it("says who is on a tree row", () => {
    render(<PeopleOnRow people={[sam, ada]} />);
    expect(screen.getByText("On this page now: Sam Lee, Ada King")).toBeInTheDocument();
  });

  it("gives a person the same colour everywhere", () => {
    expect(personColour("abc")).toBe(personColour("abc"));
  });
});
