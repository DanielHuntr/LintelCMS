import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import type { Session } from "../session/session.api.js";
import type { SetupStatus } from "./setup.api.js";
import { rememberSetupCode } from "./setupCode.js";
import { SetupWizard } from "./SetupWizard.js";
import { setupStatus } from "./testStatus.js";

const session: Session = {
  user: { id: "user-1", email: "daniel@gmail.com", name: "Daniel Roberts" },
  permissions: ["*"],
  enabledPlugins: [],
};

function renderWizard(status: SetupStatus = setupStatus(), apiChanges = {}) {
  const api = {
    testDatabaseConnection: vi.fn().mockResolvedValue(undefined),
    chooseDatabase: vi.fn().mockResolvedValue(undefined),
    createFirstAccount: vi.fn().mockResolvedValue(session),
    ...apiChanges,
  };
  const onAccountCreated = vi.fn();
  const onAlreadySetUp = vi.fn();
  render(
    <SetupWizard
      status={status}
      api={api}
      onAccountCreated={onAccountCreated}
      onAlreadySetUp={onAlreadySetUp}
    />,
  );
  return { api, onAccountCreated, onAlreadySetUp };
}

function question() {
  return screen.getByRole("heading", { level: 1 }).textContent;
}

async function press(name: string) {
  await userEvent.click(screen.getByRole("button", { name }));
}

async function answer(label: string, value: string) {
  await userEvent.type(screen.getByLabelText(label), `${value}{Enter}`);
}

/** From the welcome screen, with the built-in database, through to the password screen. */
async function reachPassword() {
  await press("Get started");
  await press("Continue");
  await screen.findByRole("heading", { name: "What should we call you?" });
  await answer("Your name", "  Daniel Roberts ");
  await answer("Email address", " daniel@gmail.com ");
}

const rejectWith = (status: number, code: string, message: string) =>
  vi.fn().mockRejectedValue(new ApiError(status, code, message));

beforeEach(() => rememberSetupCode(undefined));

describe("SetupWizard", () => {
  it("asks one question per screen, in order, and creates the account with trimmed details", async () => {
    const { api, onAccountCreated } = renderWizard();
    expect(question()).toBe("Welcome to Lintel");

    await press("Get started");
    expect(question()).toBe("Where should Lintel keep your content?");

    await press("Continue");
    expect(api.chooseDatabase).toHaveBeenCalledWith({ kind: "built-in" }, undefined);
    expect(await screen.findByRole("heading", { level: 1 })).toHaveTextContent(
      "What should we call you?",
    );

    await answer("Your name", "  Daniel Roberts ");
    expect(question()).toBe("What’s your email?");

    await answer("Email address", " daniel@gmail.com ");
    expect(question()).toBe("Create a password");
    expect(screen.getByText("You’ll use it with daniel@gmail.com to sign in.")).toBeInTheDocument();

    await answer("Password", " three good words ");
    expect(api.createFirstAccount).toHaveBeenCalledWith(
      { name: "Daniel Roberts", email: "daniel@gmail.com", password: " three good words " },
      undefined,
    );
    expect(onAccountCreated).toHaveBeenCalledWith(session);
  });

  it("puts focus in each screen's field, so typing can start straight away", async () => {
    renderWizard(setupStatus({ database: { kind: "postgres", chosenBy: "environment" } }));

    await press("Get started");
    expect(screen.getByLabelText("Your name")).toHaveFocus();

    await answer("Your name", "Daniel");
    expect(screen.getByLabelText("Email address")).toHaveFocus();
  });

  it("moves focus to the question on screens without a field", async () => {
    renderWizard();

    await press("Get started");

    expect(
      screen.getByRole("heading", { name: "Where should Lintel keep your content?" }),
    ).toHaveFocus();
  });

  it("only continues with Enter once the answer is usable, and says what's missing", async () => {
    renderWizard(setupStatus({ database: { kind: "postgres", chosenBy: "environment" } }));
    await press("Get started");

    await userEvent.keyboard("{Enter}");

    expect(question()).toBe("What should we call you?");
    expect(screen.getByLabelText("Your name")).toHaveAccessibleDescription(
      "Enter your name to continue.",
    );
  });

  it("goes back a screen without losing what was typed", async () => {
    renderWizard();
    await reachPassword();

    await press("Back");
    expect(question()).toBe("What’s your email?");
    // Email inputs drop surrounding spaces from their value, as browsers do.
    expect(screen.getByLabelText("Email address")).toHaveValue("daniel@gmail.com");

    await press("Back");
    expect(screen.getByLabelText("Your name")).toHaveValue("  Daniel Roberts ");
  });

  it("skips both database screens when DATABASE_URL has already chosen", async () => {
    const { api } = renderWizard(
      setupStatus({ database: { kind: "postgres", chosenBy: "environment" } }),
    );

    await press("Get started");

    expect(question()).toBe("What should we call you?");
    await press("Back");
    expect(question()).toBe("Welcome to Lintel");
    expect(api.chooseDatabase).not.toHaveBeenCalled();
  });

  it("shows a progress bar that moves forward with each screen", async () => {
    renderWizard();
    const progress = () => Number(screen.getByRole("progressbar").getAttribute("aria-valuenow"));
    expect(progress()).toBe(0);

    await press("Get started");

    expect(progress()).toBeGreaterThan(0);
  });

  it("offers a fix for a typo in the email domain", async () => {
    renderWizard(setupStatus({ database: { kind: "postgres", chosenBy: "environment" } }));
    await press("Get started");
    await answer("Your name", "Daniel");

    await userEvent.type(screen.getByLabelText("Email address"), "daniel@gmai.com");
    await userEvent.tab();
    await press("Use daniel@gmail.com");

    expect(screen.getByLabelText("Email address")).toHaveValue("daniel@gmail.com");
    expect(screen.getByLabelText("Email address")).toHaveFocus();
  });

  it("turns the password hint into 'Looks good' and can show the password", async () => {
    renderWizard();
    await reachPassword();
    const password = screen.getByLabelText("Password");

    await userEvent.type(password, "three good words");
    expect(password).toHaveAccessibleDescription("Looks good");

    const toggle = screen.getByRole("button", { name: "Show password" });
    await userEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(password).toHaveAttribute("type", "text");
  });

  it("takes people back to the screen an API problem is about", async () => {
    renderWizard(setupStatus(), {
      createFirstAccount: rejectWith(400, "INVALID_REQUEST", "That email address is too long."),
    });
    await reachPassword();

    await answer("Password", "three good words");

    expect(question()).toBe("What’s your email?");
    expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription(
      "That email address is too long.",
    );
  });

  it.each([
    [
      "too many attempts",
      rejectWith(429, "TOO_MANY_SETUP_ATTEMPTS", "Too many tries. Wait a minute."),
    ],
    ["an unexpected problem", rejectWith(500, "INTERNAL", "Something went wrong.")],
  ])("shows %s calmly on the password screen", async (_, createFirstAccount) => {
    renderWizard(setupStatus(), { createFirstAccount });
    await reachPassword();

    await answer("Password", "three good words");

    expect(question()).toBe("Create a password");
    expect(screen.getByRole("status")).not.toBeEmptyDOMElement();
  });

  it("explains that the API may not be running when nothing answers", async () => {
    renderWizard(setupStatus(), {
      createFirstAccount: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    });
    await reachPassword();

    await answer("Password", "three good words");

    expect(screen.getByRole("status")).toHaveTextContent(/pnpm dev/);
  });

  it("sends people to sign in when Lintel turns out to be set up already", async () => {
    const { onAlreadySetUp } = renderWizard(setupStatus(), {
      createFirstAccount: rejectWith(409, "SETUP_ALREADY_DONE", "Lintel is already set up."),
    });
    await reachPassword();

    await answer("Password", "three good words");

    expect(onAlreadySetUp).toHaveBeenCalled();
  });

  it("moves on when the database turns out to be decided by DATABASE_URL already", async () => {
    const { onAlreadySetUp } = renderWizard(setupStatus(), {
      chooseDatabase: rejectWith(
        409,
        "SETUP_ALREADY_DONE",
        "DATABASE_URL already sets the database.",
      ),
    });
    await press("Get started");

    await press("Continue");

    expect(await screen.findByRole("heading", { name: "What should we call you?" })).toBeVisible();
    expect(onAlreadySetUp).not.toHaveBeenCalled();
  });

  describe("PostgreSQL", () => {
    async function choosePostgres() {
      await press("Get started");
      await userEvent.click(screen.getByRole("radio", { name: "Your own PostgreSQL" }));
      await screen.findByRole("heading", { name: "Connect to your PostgreSQL" });
    }

    it("never shows the connection screen for the built-in database", async () => {
      renderWizard();
      await reachPassword();

      await press("Back");
      await press("Back");
      await press("Back");

      expect(question()).toBe("Where should Lintel keep your content?");
    });

    it("moves on to the connection screen as soon as PostgreSQL is picked", async () => {
      renderWizard();

      await choosePostgres();

      expect(screen.getByLabelText("Server address")).toHaveFocus();
      expect(screen.getByLabelText("Server address")).toHaveValue("localhost");
      expect(screen.getByLabelText("Port")).toHaveValue("5432");
    });

    it("saves the connection with the port as a number, then asks for a name", async () => {
      const { api } = renderWizard();
      await choosePostgres();
      await userEvent.type(screen.getByLabelText("Password"), "secret");
      await userEvent.click(screen.getByRole("switch", { name: "Use a secure connection (SSL)" }));

      // Enter in any field continues (on the switch itself, Enter flips it instead).
      await userEvent.type(screen.getByLabelText("Database name"), "{Enter}");

      expect(api.chooseDatabase).toHaveBeenCalledWith(
        {
          kind: "postgres",
          host: "localhost",
          port: 5432,
          database: "lintel",
          user: "postgres",
          password: "secret",
          ssl: true,
          createIfMissing: true,
        },
        undefined,
      );
      expect(
        await screen.findByRole("heading", { name: "What should we call you?" }),
      ).toBeVisible();
    });

    it("confirms a test calmly", async () => {
      const { api } = renderWizard();
      await choosePostgres();

      await press("Test connection");

      expect(api.testDatabaseConnection).toHaveBeenCalledWith(
        expect.not.objectContaining({ createIfMissing: expect.anything() }),
        undefined,
      );
      expect(await screen.findByText("Connected. Lintel can use this database.")).toBeVisible();
    });

    it.each([
      ["DATABASE_AUTH_FAILED", "Password"],
      ["DATABASE_NOT_FOUND", "Database name"],
      ["DATABASE_UNREACHABLE", "Server address"],
    ])("shows %s (a 422) next to %s", async (code, fieldLabel) => {
      renderWizard(setupStatus(), { chooseDatabase: rejectWith(422, code, `Problem: ${code}`) });
      await choosePostgres();

      await press("Continue");

      const field = await screen.findByLabelText(fieldLabel);
      expect(field).toHaveAccessibleDescription(`Problem: ${code}`);
      expect(field).toHaveFocus();
    });

    it("puts other database problems in the status line", async () => {
      renderWizard(setupStatus(), {
        chooseDatabase: rejectWith(422, "DATABASE_INVALID", "That server isn't Postgres."),
      });
      await choosePostgres();

      await press("Continue");

      expect(await screen.findByRole("status")).toHaveTextContent("That server isn't Postgres.");
    });
  });

  describe("setup code", () => {
    const fromAnotherComputer = () => setupStatus({ requiresSetupCode: true });

    it("comes straight after the welcome and is sent with every request", async () => {
      const { api } = renderWizard(fromAnotherComputer());
      await press("Get started");
      expect(question()).toBe("Enter your setup code");
      expect(screen.getByLabelText("Setup code")).toHaveFocus();

      await answer("Setup code", "4821-0937");
      await press("Continue");
      await screen.findByRole("heading", { name: "What should we call you?" });
      await answer("Your name", "Daniel");
      await answer("Email address", "daniel@gmail.com");
      await answer("Password", "three good words");

      expect(api.chooseDatabase).toHaveBeenCalledWith({ kind: "built-in" }, "48210937");
      expect(api.createFirstAccount).toHaveBeenCalledWith(expect.anything(), "48210937");
    });

    it("asks for the whole code", async () => {
      renderWizard(fromAnotherComputer());
      await press("Get started");

      await answer("Setup code", "4821");

      expect(screen.getByLabelText("Setup code")).toHaveAccessibleDescription(
        "Enter all 8 digits of the code.",
      );
    });

    it("goes back to the code with the API's message when it is wrong", async () => {
      renderWizard(fromAnotherComputer(), {
        chooseDatabase: rejectWith(403, "SETUP_CODE_INVALID", "That code doesn't match."),
      });
      await press("Get started");
      await answer("Setup code", "11112222");

      await press("Continue");

      expect(await screen.findByLabelText("Setup code")).toHaveAccessibleDescription(
        "That code doesn't match.",
      );
      expect(screen.getByLabelText("Setup code")).toHaveValue("11112222");
    });
  });
});
