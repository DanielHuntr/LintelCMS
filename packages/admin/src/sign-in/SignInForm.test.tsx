import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import type { Session } from "../session/session.api.js";
import { SignInForm } from "./SignInForm.js";

const session: Session = {
  user: { id: "user-1", email: "editor@example.com", name: "Ada Editor" },
  permissions: ["entries:*"],
  enabledPlugins: [],
  siteName: null,
};

async function fillInAndSubmit() {
  await userEvent.type(screen.getByLabelText("Email address"), "editor@example.com");
  await userEvent.type(screen.getByLabelText("Password"), "a-long-password");
  await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("SignInForm", () => {
  it("has labelled fields that screen readers can announce", () => {
    render(<SignInForm signIn={vi.fn()} onSignedIn={vi.fn()} />);

    expect(screen.getByLabelText("Email address")).toHaveAttribute("type", "email");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("sends the details and hands back the session", async () => {
    const signIn = vi.fn().mockResolvedValue(session);
    const onSignedIn = vi.fn();
    render(<SignInForm signIn={signIn} onSignedIn={onSignedIn} />);

    await fillInAndSubmit();

    expect(signIn).toHaveBeenCalledWith("editor@example.com", "a-long-password");
    expect(onSignedIn).toHaveBeenCalledWith(session);
  });

  it("shows the API's message when the details are wrong", async () => {
    const signIn = vi
      .fn()
      .mockRejectedValue(
        new ApiError(401, "SIGN_IN_FAILED", "That email and password don't match"),
      );
    render(<SignInForm signIn={signIn} onSignedIn={vi.fn()} />);

    await fillInAndSubmit();

    expect(screen.getByRole("status")).toHaveTextContent("That email and password don't match");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("explains when the server can't be reached", async () => {
    const signIn = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
    render(<SignInForm signIn={signIn} onSignedIn={vi.fn()} />);

    await fillInAndSubmit();

    expect(screen.getByRole("status")).toHaveTextContent(/couldn't reach the server/);
  });

  it("offers to fix a typo in the email domain", async () => {
    const signIn = vi.fn().mockResolvedValue(session);
    render(<SignInForm signIn={signIn} onSignedIn={vi.fn()} />);

    await userEvent.type(screen.getByLabelText("Email address"), "editor@gmai.com");
    await userEvent.tab();
    await userEvent.click(screen.getByRole("button", { name: "Use editor@gmail.com" }));

    expect(screen.getByLabelText("Email address")).toHaveValue("editor@gmail.com");
  });

  it("can show the password as typed", async () => {
    render(<SignInForm signIn={vi.fn()} onSignedIn={vi.fn()} />);
    const toggle = screen.getByRole("button", { name: "Show password" });

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
  });
});
