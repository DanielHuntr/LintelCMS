import { render, screen, within } from "@testing-library/react";
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
  enabledPlugins: ["blog", "forms", "seo"],
  siteName: "Brightside Bakery",
};

/** A passphrase zxcvbn rates "Strong". */
const STRONG_PASSWORD = "maple orbit cactus river";

function renderWizard(status: SetupStatus = setupStatus(), apiChanges = {}) {
  const api = {
    testDatabaseConnection: vi.fn().mockResolvedValue(undefined),
    finishSetup: vi.fn().mockResolvedValue(session),
    ...apiChanges,
  };
  const onFinished = vi.fn();
  const onAlreadySetUp = vi.fn();
  const view = render(
    <SetupWizard
      status={status}
      api={api}
      onFinished={onFinished}
      onAlreadySetUp={onAlreadySetUp}
    />,
  );
  return { api, onFinished, onAlreadySetUp, view };
}

function question() {
  return screen.getByRole("heading", { level: 1 }).textContent;
}

async function press(name: string | RegExp) {
  await userEvent.click(screen.getByRole("button", { name }));
}

function step(name: RegExp) {
  return within(screen.getByRole("navigation", { name: "Setup steps" })).getByRole("button", {
    name,
  });
}

/** Fills in the account form. The confirmation defaults to the same password. */
async function fillAccount({
  name = "  Daniel Roberts ",
  email = " daniel@gmail.com ",
  password = STRONG_PASSWORD,
  confirmation = password,
}: { name?: string; email?: string; password?: string; confirmation?: string } = {}) {
  if (name) await userEvent.type(screen.getByLabelText("Your name"), name);
  if (email) await userEvent.type(screen.getByLabelText("Email address"), email);
  if (password) await userEvent.type(screen.getByLabelText("Password"), password);
  if (confirmation) await userEvent.type(screen.getByLabelText("Confirm password"), confirmation);
}

/** The meter's word for the password, once the checker has rated what was typed. */
function strengthShown(level: string) {
  return screen.findByText(level, { selector: "span.font-semibold" });
}

/** From the welcome screen, with the built-in database, to "Create your account". */
async function reachAccount() {
  await press("Get started");
  await press("Continue");
  await screen.findByRole("heading", { name: "Create your account" });
}

/** Through every step with good answers, to the review. */
async function reachReview() {
  await reachAccount();
  await fillAccount();
  await strengthShown("Strong");
  await press("Continue");
  await userEvent.type(screen.getByLabelText("Site name"), " Brightside Bakery ");
  await press("Continue");
  await userEvent.click(screen.getByRole("radio", { name: "Blog" }));
  await press("Continue");
  await screen.findByRole("heading", { name: "Check your details" });
}

async function finish() {
  await userEvent.click(screen.getByRole("checkbox", { name: "I’ve checked these details" }));
  await press("Finish setup");
}

const rejectWith = (status: number, code: string, message: string, details = {}) =>
  vi.fn().mockRejectedValue(new ApiError(status, code, message, details));

// Whole journeys through setup type a lot; give them room on a slow machine.
vi.setConfig({ testTimeout: 30_000 });

beforeEach(() => {
  rememberSetupCode(undefined);
  sessionStorage.clear();
});

describe("SetupWizard", () => {
  it("goes through every step and only sends the answers when finishing", async () => {
    const { api, onFinished } = renderWizard();
    expect(question()).toBe("Welcome to Lintel");

    await reachReview();
    expect(api.finishSetup).not.toHaveBeenCalled();

    await finish();

    expect(api.finishSetup).toHaveBeenCalledTimes(1);
    expect(api.finishSetup).toHaveBeenCalledWith(
      {
        database: { kind: "built-in" },
        account: { name: "Daniel Roberts", email: "daniel@gmail.com", password: STRONG_PASSWORD },
        site: { siteName: "Brightside Bakery", siteType: "blog" },
      },
      undefined,
    );
    expect(await screen.findByRole("heading", { name: "You’re all set, Daniel" })).toBeVisible();
    expect(screen.getByText("Built-in database · Blog, Forms, SEO tools")).toBeVisible();
    await press("Go to your dashboard");
    expect(onFinished).toHaveBeenCalledWith(session);
  });

  it("puts focus in the first field of the account step", async () => {
    renderWizard();
    await reachAccount();

    expect(screen.getByLabelText("Your name")).toHaveFocus();
  });

  describe("the step indicator", () => {
    it("names each step with its position, marks the current one and disables unvisited ones", async () => {
      renderWizard();
      await press("Get started");

      expect(step(/Step 1 of 5: Database/)).toHaveAttribute("aria-current", "step");
      expect(step(/Step 2 of 5: Your account/)).toBeDisabled();
      expect(step(/Step 5 of 5: Review/)).toBeDisabled();
    });

    it("goes back to a visited step and forward again, keeping every answer", async () => {
      renderWizard();
      await reachAccount();
      await fillAccount();
      await strengthShown("Strong");
      await press("Continue");

      await userEvent.click(step(/Database/));
      expect(question()).toBe("Where should Lintel keep your content?");
      expect(step(/Your account.*done/)).toBeEnabled();

      await userEvent.click(step(/Site name/));
      expect(question()).toBe("What’s your site called?");
      await userEvent.click(step(/Your account/));
      expect(screen.getByLabelText("Your name")).toHaveValue("  Daniel Roberts ");
      expect(screen.getByLabelText("Password")).toHaveValue(STRONG_PASSWORD);
    });

    it("leaves out the database step when DATABASE_URL has already chosen", async () => {
      const { api } = renderWizard(
        setupStatus({ database: { kind: "postgres", chosenBy: "environment" } }),
      );

      await press("Get started");

      expect(question()).toBe("Create your account");
      expect(step(/Step 1 of 4: Your account/)).toHaveAttribute("aria-current", "step");
      expect(api.testDatabaseConnection).not.toHaveBeenCalled();
    });
  });

  describe("the database step", () => {
    async function choosePostgres() {
      await press("Get started");
      await userEvent.click(screen.getByRole("radio", { name: "Your own PostgreSQL" }));
      await press("Continue");
      await screen.findByRole("heading", { name: "Connect to your PostgreSQL" });
    }

    it("only selects a tile when it is clicked; it doesn't move on by itself", async () => {
      renderWizard();
      await press("Get started");

      await userEvent.click(screen.getByRole("radio", { name: "Your own PostgreSQL" }));
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(screen.getByRole("radio", { name: "Your own PostgreSQL" })).toBeChecked();
      expect(question()).toBe("Where should Lintel keep your content?");
    });

    it("picking PostgreSQL then Continue opens the connection screen", async () => {
      renderWizard();

      await choosePostgres();

      expect(screen.getByLabelText("Server address")).toHaveFocus();
      expect(screen.getByLabelText("Port")).toHaveValue("5432");
    });

    it("checks the fields before moving on, without connecting", async () => {
      const { api } = renderWizard();
      await choosePostgres();
      await userEvent.clear(screen.getByLabelText("Port"));
      await userEvent.type(screen.getByLabelText("Port"), "lots");

      await press("Continue");

      expect(screen.getByLabelText("Port")).toHaveAccessibleDescription(
        "Enter a port number, like 5432.",
      );
      expect(api.testDatabaseConnection).not.toHaveBeenCalled();
    });

    it("can test the connection, and sends it with the port as a number when finishing", async () => {
      const { api } = renderWizard();
      await choosePostgres();
      await userEvent.type(screen.getByLabelText("Password"), "secret");

      await press("Test connection");
      expect(await screen.findByText("Connected. Lintel can use this database.")).toBeVisible();

      await press("Continue");
      expect(await screen.findByRole("heading", { name: "Create your account" })).toBeVisible();
      await userEvent.click(step(/Database/));
      await press("Continue");
      expect(api.testDatabaseConnection).toHaveBeenCalledWith(
        {
          host: "localhost",
          port: 5432,
          database: "lintel",
          user: "postgres",
          password: "secret",
          ssl: false,
        },
        undefined,
      );
    });

    it("takes people back to the connection screen when finishing finds a problem", async () => {
      const { api } = renderWizard(setupStatus(), {
        finishSetup: rejectWith(422, "DATABASE_AUTH_FAILED", "Postgres turned down the password.", {
          step: "database",
        }),
      });
      await choosePostgres();
      await press("Continue");
      await fillAccount();
      await strengthShown("Strong");
      await press("Continue");
      await userEvent.type(screen.getByLabelText("Site name"), "Brightside");
      await press("Continue");
      await press("Continue");

      await finish();

      expect(api.finishSetup).toHaveBeenCalledWith(
        expect.objectContaining({
          database: expect.objectContaining({
            kind: "postgres",
            port: 5432,
            createIfMissing: true,
          }),
        }),
        undefined,
      );
      expect(await screen.findByLabelText("Password")).toHaveAccessibleDescription(
        "Postgres turned down the password.",
      );
      expect(question()).toBe("Connect to your PostgreSQL");
    });
  });

  describe("the account step", () => {
    it("checks every field, says what to fix and focuses the first problem", async () => {
      renderWizard();
      await reachAccount();
      await fillAccount({ name: "", email: "daniel@", confirmation: "something else" });
      await strengthShown("Strong");

      await press("Continue");

      expect(question()).toBe("Create your account");
      expect(screen.getByLabelText("Your name")).toHaveAccessibleDescription(
        "Enter your name to continue.",
      );
      expect(screen.getByLabelText("Your name")).toHaveFocus();
      expect(screen.getByLabelText("Email address")).toHaveAccessibleDescription(
        "That doesn’t look like an email address. Check it has an @ and a domain.",
      );
      expect(screen.getByLabelText("Confirm password")).toHaveAccessibleDescription(
        "These don’t match yet.",
      );
    });

    it("offers a fix for a typo in the email domain", async () => {
      renderWizard();
      await reachAccount();

      await userEvent.type(screen.getByLabelText("Email address"), "daniel@gmai.com");
      await userEvent.tab();
      await press("Use daniel@gmail.com");

      expect(screen.getByLabelText("Email address")).toHaveValue("daniel@gmail.com");
    });

    it("rates the password as it's typed, with one tip, and can show it", async () => {
      renderWizard();
      await reachAccount();
      const password = screen.getByLabelText("Password");
      expect(password).toHaveAccessibleDescription(
        "At least 12 characters. A few unrelated words work well.",
      );

      await userEvent.type(password, "chocolatecake");
      expect(await strengthShown("Weak")).toBeVisible();
      expect(password).toHaveAccessibleDescription(
        expect.stringContaining("Add another word or two."),
      );

      await userEvent.type(password, " kettle cobalt");
      expect(await strengthShown("Strong")).toBeVisible();

      const passwordBox = password.closest("div.relative") as HTMLElement;
      const toggle = within(passwordBox).getByRole("button", { name: "Show password" });
      await userEvent.click(toggle);
      expect(toggle).toHaveAttribute("aria-pressed", "true");
      expect(password).toHaveAttribute("type", "text");
    });

    it("warns against the person's own name", async () => {
      renderWizard();
      await reachAccount();

      await fillAccount({ password: "daniel roberts 1998" });

      expect(await screen.findByText("Avoid your name or email.")).toBeVisible();
    });

    it("keeps Continue unavailable until the password is good, and says why", async () => {
      renderWizard();
      await reachAccount();
      const button = screen.getByRole("button", { name: "Continue" });
      expect(button).toHaveAttribute("aria-disabled", "true");
      expect(button).toHaveAccessibleDescription("Choose a password to continue.");

      await userEvent.type(screen.getByLabelText("Password"), "kettle");
      expect(button).toHaveAccessibleDescription("Your password needs at least 12 characters.");

      await userEvent.type(screen.getByLabelText("Password"), "kettle");
      await strengthShown("Too weak");
      expect(button).toHaveAccessibleDescription(
        "Your password needs to be Good or Strong to continue.",
      );

      await press("Continue");
      expect(question()).toBe("Create your account");

      await userEvent.clear(screen.getByLabelText("Password"));
      await userEvent.type(screen.getByLabelText("Password"), STRONG_PASSWORD);
      await strengthShown("Strong");
      expect(button).not.toHaveAttribute("aria-disabled");
    });

    it("suggests a passphrase, fills both fields, shows it and offers to copy it", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      renderWizard();
      await reachAccount();

      await press("Suggest a password");

      const password = screen.getByLabelText("Password");
      await vi.waitFor(() => expect(password).not.toHaveValue(""));
      const suggestion = (password as HTMLInputElement).value;
      expect(suggestion).toMatch(/^[a-z]+-[a-z]+-[a-z]+-[a-z]+-\d{2}$/);
      expect(password).toHaveAttribute("type", "text");
      expect(password).toHaveAttribute("autocomplete", "new-password");
      expect(screen.getByLabelText("Confirm password")).toHaveValue(suggestion);
      expect(screen.getByLabelText("Confirm password")).toHaveAccessibleDescription(
        "Passwords match",
      );
      expect(await strengthShown("Strong")).toBeVisible();
      expect(screen.getByText(/Save it in your password manager/)).toBeVisible();

      await press("Copy the suggested password");
      expect(writeText).toHaveBeenCalledWith(suggestion);
      expect(await screen.findByRole("button", { name: "Copied" })).toBeVisible();
    });

    it("says whether the confirmation matches once something is typed there", async () => {
      renderWizard();
      await reachAccount();
      await userEvent.type(screen.getByLabelText("Password"), STRONG_PASSWORD);
      const confirmation = screen.getByLabelText("Confirm password");
      expect(confirmation).toHaveAccessibleDescription("");

      await userEvent.type(confirmation, "maple");
      expect(confirmation).toHaveAccessibleDescription("These don’t match yet.");

      await userEvent.type(confirmation, " orbit cactus river");
      expect(confirmation).toHaveAccessibleDescription("Passwords match");
    });
  });

  describe("the site steps", () => {
    it("needs a site name", async () => {
      renderWizard();
      await reachAccount();
      await fillAccount();
      await strengthShown("Strong");
      await press("Continue");

      await press("Continue");

      expect(screen.getByLabelText("Site name")).toHaveAccessibleDescription(
        "Give your site a name to continue.",
      );
    });

    it("says features can be changed later", async () => {
      renderWizard();
      await reachReview();
      await userEvent.click(step(/What you’re building/));

      expect(
        screen.getByText("You can switch features on or off later in Settings → Features."),
      ).toBeVisible();
    });
  });

  describe("the review", () => {
    it("shows every answer with the password hidden, and the features to switch on", async () => {
      renderWizard();
      await reachReview();

      expect(screen.getByText("daniel@gmail.com")).toBeVisible();
      expect(screen.queryByText(STRONG_PASSWORD)).toBeNull();
      expect(screen.getByText("Brightside Bakery")).toBeVisible();
      expect(screen.getByText("Blog, Forms, SEO tools")).toBeVisible();

      const account = screen.getByRole("region", { name: "Your account" });
      await userEvent.click(within(account).getByRole("button", { name: "Show password" }));
      expect(screen.getByText(STRONG_PASSWORD)).toBeVisible();
    });

    it("jumps to a step with Edit", async () => {
      renderWizard();
      await reachReview();

      await press("Edit Site name");

      expect(question()).toBe("What’s your site called?");
      expect(screen.getByLabelText("Site name")).toHaveValue(" Brightside Bakery ");
    });

    it("needs the box ticked before finishing, and says so", async () => {
      const { api } = renderWizard();
      await reachReview();
      const button = screen.getByRole("button", { name: "Finish setup" });
      expect(button).toHaveAccessibleDescription("Tick “I’ve checked these details” to finish.");

      await press("Finish setup");

      expect(api.finishSetup).not.toHaveBeenCalled();
      expect(screen.getByRole("checkbox")).toHaveFocus();
    });

    it("takes people back to the account step with the API's verdict on the password", async () => {
      const message = "That password would be too easy to guess. Add another word or two.";
      renderWizard(setupStatus(), {
        finishSetup: rejectWith(400, "INVALID_REQUEST", message, {
          step: "account",
          fields: { password: message },
        }),
      });
      await reachReview();

      await finish();

      expect(await screen.findByRole("heading", { name: "Create your account" })).toBeVisible();
      expect(screen.getByLabelText("Password")).toHaveAccessibleDescription(
        expect.stringContaining(message),
      );
    });

    it.each([
      ["too many attempts", rejectWith(429, "TOO_MANY_SETUP_ATTEMPTS", "Too many tries.")],
      ["an unexpected problem", rejectWith(500, "INTERNAL", "Something went wrong.")],
    ])("shows %s calmly on the review", async (_, finishSetup) => {
      renderWizard(setupStatus(), { finishSetup });
      await reachReview();

      await finish();

      expect(question()).toBe("Check your details");
      expect(await screen.findByText(/Too many tries|Something went wrong/)).toBeVisible();
    });

    it("explains that the API may not be running when nothing answers", async () => {
      renderWizard(setupStatus(), {
        finishSetup: vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
      });
      await reachReview();

      await finish();

      expect(await screen.findByText(/pnpm dev/)).toBeVisible();
    });

    it("sends people to sign in when Lintel turns out to be set up already", async () => {
      const { onAlreadySetUp } = renderWizard(setupStatus(), {
        finishSetup: rejectWith(409, "SETUP_ALREADY_DONE", "Lintel is already set up."),
      });
      await reachReview();

      await finish();

      expect(onAlreadySetUp).toHaveBeenCalled();
    });
  });

  describe("refreshing the page", () => {
    it("keeps every answer except passwords, and asks for the password again kindly", async () => {
      const first = renderWizard();
      await reachReview();
      expect(sessionStorage.getItem("lintel.setup")).not.toContain(STRONG_PASSWORD);
      first.view.unmount();

      const { api } = renderWizard();

      expect(question()).toBe("Check your details");
      expect(screen.getByText("Brightside Bakery")).toBeVisible();
      expect(screen.getByText("Not entered yet")).toBeVisible();
      await finish();
      expect(api.finishSetup).not.toHaveBeenCalled();
      expect(question()).toBe("Create your account");
      expect(screen.getByLabelText("Your name")).toHaveValue("  Daniel Roberts ");
      expect(screen.getByText(/passwords aren’t kept when the page reloads/)).toBeVisible();
    });
  });

  describe("setup code", () => {
    const fromAnotherComputer = () => setupStatus({ requiresSetupCode: true });

    it("comes straight after the welcome and is sent with every request", async () => {
      const { api } = renderWizard(fromAnotherComputer());
      await press("Get started");
      expect(question()).toBe("Enter your setup code");

      await userEvent.type(screen.getByLabelText("Setup code"), "4821-0937{Enter}");
      await reachReviewFromDatabase();
      await finish();

      expect(api.finishSetup).toHaveBeenCalledWith(expect.anything(), "48210937");
    });

    it("asks for the whole code", async () => {
      renderWizard(fromAnotherComputer());
      await press("Get started");

      await userEvent.type(screen.getByLabelText("Setup code"), "4821{Enter}");

      expect(screen.getByLabelText("Setup code")).toHaveAccessibleDescription(
        "Enter all 8 digits of the code.",
      );
    });

    it("goes back to the code with the API's message when it is wrong", async () => {
      renderWizard(fromAnotherComputer(), {
        finishSetup: rejectWith(403, "SETUP_CODE_INVALID", "That code doesn't match."),
      });
      await press("Get started");
      await userEvent.type(screen.getByLabelText("Setup code"), "11112222{Enter}");
      await reachReviewFromDatabase();

      await finish();

      expect(await screen.findByLabelText("Setup code")).toHaveAccessibleDescription(
        "That code doesn't match.",
      );
    });

    async function reachReviewFromDatabase() {
      await screen.findByRole("heading", { name: "Where should Lintel keep your content?" });
      await press("Continue");
      await fillAccount();
      await strengthShown("Strong");
      await press("Continue");
      await userEvent.type(screen.getByLabelText("Site name"), "Brightside");
      await press("Continue");
      await press("Continue");
    }
  });
});
