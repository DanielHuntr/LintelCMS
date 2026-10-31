import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client.js";
import { DatabaseStep } from "./DatabaseStep.js";

function renderStep({
  testDatabaseConnection = vi.fn().mockResolvedValue(undefined),
  chooseDatabase = vi.fn().mockResolvedValue(undefined),
} = {}) {
  const onSaved = vi.fn();
  render(
    <DatabaseStep
      api={{ testDatabaseConnection, chooseDatabase }}
      setupCode={undefined}
      takesFocus={false}
      onSaved={onSaved}
      onInterrupted={vi.fn()}
    />,
  );
  return { testDatabaseConnection, chooseDatabase, onSaved };
}

const builtIn = () => screen.getByRole("radio", { name: /Built-in/ });
const postgres = () => screen.getByRole("radio", { name: "Your own PostgreSQL" });

async function choosePostgresAndTypePassword() {
  await userEvent.click(postgres());
  await userEvent.type(screen.getByLabelText("Password"), "secret");
}

describe("DatabaseStep", () => {
  it("offers built-in and Postgres as a radio group, with built-in chosen", () => {
    renderStep();

    expect(
      screen.getByRole("radiogroup", { name: "Where should Lintel keep your content?" }),
    ).toBeInTheDocument();
    expect(builtIn()).toHaveAttribute("aria-checked", "true");
    expect(builtIn()).toHaveAccessibleDescription(/Nothing to install/);
    expect(screen.queryByLabelText("Server address")).not.toBeInTheDocument();
  });

  it("moves the choice with the arrow keys, as one tab stop", async () => {
    renderStep();

    await userEvent.tab();
    expect(builtIn()).toHaveFocus();
    expect(postgres()).toHaveAttribute("tabindex", "-1");

    await userEvent.keyboard("{ArrowDown}");
    expect(postgres()).toHaveAttribute("aria-checked", "true");
    expect(postgres()).toHaveFocus();
    expect(screen.getByLabelText("Server address")).toHaveValue("localhost");

    await userEvent.keyboard("{ArrowDown}");
    expect(builtIn()).toHaveAttribute("aria-checked", "true");
  });

  it("saves the built-in database", async () => {
    const { chooseDatabase, onSaved } = renderStep();

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(chooseDatabase).toHaveBeenCalledWith({ kind: "built-in" }, undefined);
    expect(onSaved).toHaveBeenCalled();
  });

  it("starts the Postgres fields with the usual local values", async () => {
    renderStep();
    await userEvent.click(postgres());

    expect(screen.getByLabelText("Server address")).toHaveAccessibleDescription(
      "Usually localhost if Postgres is on this computer.",
    );
    expect(screen.getByLabelText("Port")).toHaveValue("5432");
    expect(screen.getByLabelText("Database name")).toHaveValue("lintel");
    expect(screen.getByLabelText("Username")).toHaveValue("postgres");
    expect(screen.getByRole("switch", { name: "Use a secure connection (SSL)" })).not.toBeChecked();
    expect(
      screen.getByRole("switch", { name: "Create the database if it doesn’t exist" }),
    ).toBeChecked();
  });

  it("sends the Postgres details, with the port as a number and the toggles as chosen", async () => {
    const { chooseDatabase } = renderStep();
    await choosePostgresAndTypePassword();
    await userEvent.clear(screen.getByLabelText("Server address"));
    await userEvent.type(screen.getByLabelText("Server address"), " db.example.com ");
    await userEvent.clear(screen.getByLabelText("Port"));
    await userEvent.type(screen.getByLabelText("Port"), "6543");
    await userEvent.click(screen.getByRole("switch", { name: "Use a secure connection (SSL)" }));
    await userEvent.click(
      screen.getByRole("switch", { name: "Create the database if it doesn’t exist" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(chooseDatabase).toHaveBeenCalledWith(
      {
        kind: "postgres",
        host: "db.example.com",
        port: 6543,
        database: "lintel",
        user: "postgres",
        password: "secret",
        ssl: true,
        createIfMissing: false,
      },
      undefined,
    );
  });

  it("tests the connection without createIfMissing and confirms calmly", async () => {
    const { testDatabaseConnection } = renderStep();
    await choosePostgresAndTypePassword();

    await userEvent.click(screen.getByRole("button", { name: "Test connection" }));

    expect(testDatabaseConnection).toHaveBeenCalledWith(
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
    expect(await screen.findByText("Connected. Lintel can use this database.")).toBeInTheDocument();
  });

  it.each([
    ["DATABASE_AUTH_FAILED", "Password", "Postgres turned down that username and password."],
    ["DATABASE_UNREACHABLE", "Server address", "Nothing answered at localhost:5432."],
  ])("shows %s next to %s", async (code, fieldLabel, message) => {
    renderStep({
      testDatabaseConnection: vi.fn().mockRejectedValue(new ApiError(400, code, message)),
    });
    await choosePostgresAndTypePassword();

    await userEvent.click(screen.getByRole("button", { name: "Test connection" }));

    const field = await screen.findByLabelText(fieldLabel);
    expect(field).toHaveAccessibleDescription(message);
    expect(field).toHaveAttribute("aria-invalid", "true");
    expect(field).toHaveFocus();
  });

  it("shows a missing database next to the database name when Lintel won't create it", async () => {
    const message = "There's no database called lintel on that server.";
    renderStep({
      chooseDatabase: vi.fn().mockRejectedValue(new ApiError(400, "DATABASE_NOT_FOUND", message)),
    });
    await choosePostgresAndTypePassword();
    await userEvent.click(
      screen.getByRole("switch", { name: "Create the database if it doesn’t exist" }),
    );

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByLabelText("Database name")).toHaveAccessibleDescription(message);
  });

  it("treats a missing database as fine in a test when Lintel will create it", async () => {
    renderStep({
      testDatabaseConnection: vi
        .fn()
        .mockRejectedValue(new ApiError(400, "DATABASE_NOT_FOUND", "No database called lintel.")),
    });
    await choosePostgresAndTypePassword();

    await userEvent.click(screen.getByRole("button", { name: "Test connection" }));

    expect(
      await screen.findByText("Connected. Lintel will create this database for you."),
    ).toBeInTheDocument();
  });

  it("puts other problems in the status line", async () => {
    renderStep({
      chooseDatabase: vi
        .fn()
        .mockRejectedValue(new ApiError(400, "DATABASE_INVALID", "That server isn't Postgres.")),
    });
    await choosePostgresAndTypePassword();

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByRole("status")).toHaveTextContent("That server isn't Postgres.");
  });

  it("checks the port before sending anything", async () => {
    const { chooseDatabase } = renderStep();
    await userEvent.click(postgres());
    await userEvent.clear(screen.getByLabelText("Port"));
    await userEvent.type(screen.getByLabelText("Port"), "five");

    await userEvent.click(screen.getByRole("button", { name: "Continue" }));

    expect(screen.getByLabelText("Port")).toHaveAccessibleDescription(
      "Enter a port number, like 5432.",
    );
    expect(chooseDatabase).not.toHaveBeenCalled();
  });
});
