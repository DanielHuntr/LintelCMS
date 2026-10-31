import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import type { Session } from "../session/session.api.js";
import { AccountStep } from "./AccountStep.js";

const session: Session = {
  user: { id: "user-1", email: "daniel@gmail.com", name: "Daniel" },
  permissions: ["*"],
  enabledPlugins: [],
};

function renderStep(createFirstAccount = vi.fn().mockResolvedValue(session)) {
  const onCreated = vi.fn();
  const onInterrupted = vi.fn();
  render(
    <AccountStep
      api={{ createFirstAccount }}
      setupCode={undefined}
      takesFocus={false}
      usesEnvironmentDatabase={false}
      onCreated={onCreated}
      onInterrupted={onInterrupted}
    />,
  );
  return { createFirstAccount, onCreated, onInterrupted };
}

async function fillIn({
  name = "Daniel",
  email = "daniel@gmail.com",
  password = "three good words",
}) {
  await userEvent.type(screen.getByLabelText("Your name"), name);
  await userEvent.type(screen.getByLabelText("Email address"), email);
  await userEvent.type(screen.getByLabelText("Password"), password);
}

async function submit() {
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("AccountStep", () => {
  it("sends trimmed details, keeps the password exactly as typed, and hands back the session", async () => {
    const { createFirstAccount, onCreated } = renderStep();

    await fillIn({
      name: "  Daniel  ",
      email: " daniel@gmail.com ",
      password: " a long passphrase ",
    });
    await submit();

    expect(createFirstAccount).toHaveBeenCalledWith(
      { name: "Daniel", email: "daniel@gmail.com", password: " a long passphrase " },
      undefined,
    );
    expect(onCreated).toHaveBeenCalledWith(session);
  });

  it("repeats the email by the button so a slip is easy to see", async () => {
    renderStep();

    await userEvent.type(screen.getByLabelText("Email address"), "daniel@gmail.com");

    expect(screen.getByText("daniel@gmail.com")).toBeInTheDocument();
    expect(screen.getByText(/You’ll sign in with/)).toBeInTheDocument();
  });

  it("offers a fix for a domain typo once the field loses focus, and applies it on click", async () => {
    const { createFirstAccount } = renderStep();

    await userEvent.type(screen.getByLabelText("Email address"), "daniel@gmai.com");
    expect(screen.queryByRole("button", { name: /Did you mean/ })).not.toBeInTheDocument();

    await userEvent.tab();
    await userEvent.click(screen.getByRole("button", { name: "Did you mean daniel@gmail.com?" }));

    expect(screen.getByLabelText("Email address")).toHaveValue("daniel@gmail.com");
    expect(screen.getByLabelText("Email address")).toHaveFocus();
    expect(screen.queryByRole("button", { name: /Did you mean/ })).not.toBeInTheDocument();
    expect(createFirstAccount).not.toHaveBeenCalled();
  });

  it("never blocks the account because of a suggestion", async () => {
    const { createFirstAccount } = renderStep();

    await fillIn({ email: "daniel@gmai.com" });
    await submit();

    expect(createFirstAccount).toHaveBeenCalledWith(
      expect.objectContaining({ email: "daniel@gmai.com" }),
      undefined,
    );
  });

  it("turns the password hint into 'Looks good' once it is long enough, and says so aloud", async () => {
    renderStep();
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAccessibleDescription(/At least 12 characters/);

    await userEvent.type(password, "three good words");

    expect(password).toHaveAccessibleDescription("Looks good");
    expect(screen.getByText("Looks good")).toHaveAttribute("aria-live", "polite");
  });

  it("shows and hides the password with a toggle button screen readers can announce", async () => {
    renderStep();
    const toggle = screen.getByRole("button", { name: "Show password" });
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");

    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");

    await userEvent.click(toggle);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("explains what to fix before sending anything", async () => {
    const { createFirstAccount } = renderStep();

    await fillIn({ password: "too short" });
    await submit();

    expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
      "Use at least 12 characters.",
    );
    expect(screen.getByLabelText("Password")).toHaveFocus();
    expect(createFirstAccount).not.toHaveBeenCalled();
  });

  it("shows the API's message next to the field it is about", async () => {
    renderStep(
      vi
        .fn()
        .mockRejectedValue(
          new ApiError(400, "INVALID_REQUEST", "That email address doesn't look right."),
        ),
    );

    await fillIn({});
    await submit();

    expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription(
      "That email address doesn't look right.",
    );
    expect(screen.getByLabelText("Email address")).toHaveAttribute("aria-invalid", "true");
  });

  it("shows other API messages in the status line", async () => {
    renderStep(
      vi.fn().mockRejectedValue(new ApiError(400, "INVALID_REQUEST", "Something is missing.")),
    );

    await fillIn({});
    await submit();

    expect(screen.getByRole("status")).toHaveTextContent("Something is missing.");
    expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
  });

  it("explains that the API may not be running when nothing answers", async () => {
    renderStep(vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));

    await fillIn({});
    await submit();

    expect(screen.getByRole("status")).toHaveTextContent(/pnpm dev/);
  });

  it("hands 'already set up' to the flow, which sends people to sign in", async () => {
    const { onInterrupted } = renderStep(
      vi
        .fn()
        .mockRejectedValue(
          new ApiError(409, "SETUP_ALREADY_DONE", "Lintel is already set up. Sign in instead."),
        ),
    );

    await fillIn({});
    await submit();

    expect(onInterrupted).toHaveBeenCalledWith({ kind: "already-set-up" });
  });
});
