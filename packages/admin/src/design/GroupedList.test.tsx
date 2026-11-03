import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GroupedList } from "./GroupedList.js";

describe("GroupedList", () => {
  it("names its group with a heading, h2 unless told otherwise (LINTEL-A11Y-036)", () => {
    render(
      <>
        <GroupedList header="Notifications">
          <li>Email</li>
        </GroupedList>
        <GroupedList header="Inside a panel" headingLevel={3}>
          <li>Row</li>
        </GroupedList>
      </>,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Notifications" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "Inside a panel" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Notifications" })).toBeInTheDocument();
  });
});
