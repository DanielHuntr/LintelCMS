import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { SignInPage } from "./SignInPage.js";

describe("SignInPage", () => {
  it("has labelled fields that screen readers can announce", () => {
    render(<SignInPage />);

    expect(screen.getByLabelText("Email address")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("tells the person what happened after they submit", async () => {
    render(<SignInPage />);

    await userEvent.type(screen.getByLabelText("Email address"), "editor@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "a-password");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));

    expect(screen.getByRole("status")).toHaveTextContent(/next pull request/);
  });
});
