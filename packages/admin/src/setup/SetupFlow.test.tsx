import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import type { Session } from "../session/session.api.js";
import type { SetupStatus } from "./setup.api.js";
import { rememberSetupCode } from "./setupCode.js";
import { SetupFlow } from "./SetupFlow.js";
import { setupStatus } from "./testStatus.js";

const session: Session = {
  user: { id: "user-1", email: "daniel@gmail.com", name: "Daniel" },
  permissions: ["*"],
  enabledPlugins: [],
};

function renderFlow(status: SetupStatus, apiChanges = {}) {
  const api = {
    testDatabaseConnection: vi.fn().mockResolvedValue(undefined),
    chooseDatabase: vi.fn().mockResolvedValue(undefined),
    createFirstAccount: vi.fn().mockResolvedValue(session),
    ...apiChanges,
  };
  const onAccountCreated = vi.fn();
  const onAlreadySetUp = vi.fn();
  render(
    <SetupFlow
      status={status}
      api={api}
      onAccountCreated={onAccountCreated}
      onAlreadySetUp={onAlreadySetUp}
    />,
  );
  return { api, onAccountCreated, onAlreadySetUp };
}

async function createAccount() {
  await userEvent.type(screen.getByLabelText("Your name"), "Daniel");
  await userEvent.type(screen.getByLabelText("Email address"), "daniel@gmail.com");
  await userEvent.type(screen.getByLabelText("Password"), "three good words");
  await userEvent.click(screen.getByRole("button", { name: "Create account" }));
}

describe("SetupFlow", () => {
  // The code is remembered for the whole page session; each test starts a fresh one.
  beforeEach(() => rememberSetupCode(undefined));

  it("starts with the database, then moves on to the account with focus on its heading", async () => {
    const { onAccountCreated } = renderFlow(setupStatus());
    expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    const heading = await screen.findByRole("heading", { name: "Create your admin account" });
    expect(heading).toHaveFocus();
    expect(screen.getByText("Step 2 of 3")).toBeInTheDocument();

    await createAccount();
    expect(onAccountCreated).toHaveBeenCalledWith(session);
  });

  it("skips the database step when DATABASE_URL already chose, and says so", () => {
    renderFlow(setupStatus({ database: { kind: "postgres", chosenBy: "environment" } }));

    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Create your admin account" })).toBeInTheDocument();
    expect(screen.getByText("Step 1 of 2")).toBeInTheDocument();
    expect(
      screen.getByText("Using the database set by your server’s DATABASE_URL."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back" })).not.toBeInTheDocument();
  });

  it("asks for the setup code first and sends it with every request", async () => {
    const { api } = renderFlow(setupStatus({ requiresSetupCode: true }));
    expect(
      screen.getByText("Enter the setup code shown in the terminal where Lintel is running."),
    ).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Setup code"), " K7Q-42M ");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(await screen.findByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Create your admin account" });
    await createAccount();

    expect(api.chooseDatabase).toHaveBeenCalledWith({ kind: "built-in" }, "K7Q-42M");
    expect(api.createFirstAccount).toHaveBeenCalledWith(expect.anything(), "K7Q-42M");
  });

  it("goes back to the setup code with the API's message when the code is wrong", async () => {
    renderFlow(setupStatus({ requiresSetupCode: true }), {
      chooseDatabase: vi
        .fn()
        .mockRejectedValue(
          new ApiError(
            403,
            "SETUP_CODE_INVALID",
            "That setup code doesn't match. Check the terminal.",
          ),
        ),
    });

    await userEvent.type(screen.getByLabelText("Setup code"), "WRONG");
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    await userEvent.click(await screen.findByRole("button", { name: "Continue" }));

    expect(await screen.findByLabelText("Setup code")).toHaveAccessibleDescription(
      "That setup code doesn't match. Check the terminal.",
    );
    expect(screen.getByLabelText("Setup code")).toHaveValue("WRONG");
  });

  it("sends people to sign in when Lintel turns out to be set up already", async () => {
    const { onAlreadySetUp } = renderFlow(setupStatus(), {
      chooseDatabase: vi
        .fn()
        .mockRejectedValue(new ApiError(409, "SETUP_ALREADY_DONE", "Lintel is already set up.")),
    });

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(onAlreadySetUp).toHaveBeenCalled();
  });
});
