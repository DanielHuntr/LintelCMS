import { useState } from "react";
import { ApiError } from "../api/client.js";
import { t } from "../i18n/strings.js";
import type { Session } from "../session/session.api.js";
import {
  cleanAccountDetails,
  emailProblem,
  fieldForAccountMessage,
  nameProblem,
  passwordProblem,
  type AccountField,
} from "./accountDetails.js";
import {
  defaultPostgresForm,
  placeDatabaseProblem,
  readPostgresForm,
  type ConnectionErrors,
  type PostgresForm,
} from "./postgresConnection.js";
import { DatabaseScreen } from "./screens/DatabaseScreen.js";
import { EmailScreen } from "./screens/EmailScreen.js";
import { NameScreen } from "./screens/NameScreen.js";
import { PasswordScreen } from "./screens/PasswordScreen.js";
import { PostgresScreen, type TestOutcome } from "./screens/PostgresScreen.js";
import { SetupCodeScreen } from "./screens/SetupCodeScreen.js";
import { WelcomeScreen } from "./screens/WelcomeScreen.js";
import type { DatabaseKind, FirstAccountDetails, SetupApi, SetupStatus } from "./setup.api.js";
import { rememberedSetupCode, rememberSetupCode, setupCodeLength } from "./setupCode.js";
import { stepProblemFor, type SetupFailure } from "./setupErrors.js";
import { accountScreensFor, setupProgress, type AccountScreen } from "./setupRouting.js";
import { afterSelectionShows, useWizardScreens } from "./useWizardScreens.js";
import { FullScreenLayout } from "../layout/FullScreenLayout.js";

interface SetupWizardProps {
  status: SetupStatus;
  api: Pick<SetupApi, "testDatabaseConnection" | "chooseDatabase" | "createFirstAccount">;
  onAccountCreated: (session: Session) => void;
  onAlreadySetUp: () => void;
}

type FieldErrors = Partial<Record<AccountField | "setupCode", string>>;

/**
 * The screens at /setup, one question each: welcome, the setup code (from another computer
 * only), where to keep content, the PostgreSQL details (if chosen), then name, email and
 * password. Everything typed lives here, so Back never loses an answer.
 */
export function SetupWizard({ status, api, onAccountCreated, onAlreadySetUp }: SetupWizardProps) {
  const { screen, goTo } = useWizardScreens<AccountScreen>("welcome");
  const [setupCode, setSetupCode] = useState(rememberedSetupCode() ?? "");
  const [databaseKind, setDatabaseKind] = useState<DatabaseKind>("built-in");
  const [postgresForm, setPostgresForm] = useState<PostgresForm>(defaultPostgresForm);
  const [connectionErrors, setConnectionErrors] = useState<ConnectionErrors>({});
  const [details, setDetails] = useState<FirstAccountDetails>({
    name: "",
    email: "",
    password: "",
  });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [statusMessage, setStatusMessage] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const screens = accountScreensFor(status, databaseKind);
  const codeToSend = status.requiresSetupCode ? setupCode : undefined;

  function move(to: AccountScreen, direction: "forward" | "back" = "forward") {
    setStatusMessage("");
    goTo(to, direction);
  }

  /** The next screen, worked out from the choice just made (PostgreSQL adds a screen). */
  function next(kind: DatabaseKind = databaseKind) {
    const upcoming = accountScreensFor(status, kind);
    move(upcoming[upcoming.indexOf(screen) + 1] ?? "password");
  }

  function back() {
    move(screens[screens.indexOf(screen) - 1] ?? "welcome", "back");
  }

  function showFieldError(field: keyof FieldErrors, message: string | undefined) {
    setFieldErrors({ ...fieldErrors, [field]: message });
    return message === undefined;
  }

  function handleInterrupted(failure: Exclude<SetupFailure, { kind: "problem" | "unreachable" }>) {
    if (failure.kind === "already-set-up") {
      onAlreadySetUp();
      return;
    }
    // The code was wrong or missing: back to where it's entered, with the API's explanation.
    setFieldErrors({ ...fieldErrors, setupCode: failure.message });
    move("setup-code", "back");
  }

  /**
   * Sends a request with the busy state on, and returns the problem to show, if any.
   * `isFine` lets a caller accept an error that only means there's nothing left to do.
   */
  async function send(request: () => Promise<void>, isFine?: (error: unknown) => boolean) {
    setIsBusy(true);
    setStatusMessage("");
    try {
      await request();
      return { ok: true as const };
    } catch (error) {
      if (isFine?.(error)) return { ok: true as const };
      return { ok: false as const, error, problem: stepProblemFor(error, handleInterrupted) };
    } finally {
      setIsBusy(false);
    }
  }

  function continueFromSetupCode() {
    const isComplete = setupCode.length === setupCodeLength;
    const message = isComplete
      ? undefined
      : t("setupCode.incomplete", { length: String(setupCodeLength) });
    if (!showFieldError("setupCode", message)) return;
    rememberSetupCode(setupCode);
    next();
  }

  async function saveDatabase(kind: DatabaseKind) {
    if (kind === "postgres") {
      next("postgres");
      return;
    }
    const result = await send(
      () => api.chooseDatabase({ kind: "built-in" }, codeToSend),
      isDatabaseDecidedAlready,
    );
    if (result.ok) next("built-in");
    else if (result.problem) setStatusMessage(result.problem.message);
  }

  async function savePostgres() {
    const connection = readConnectionOrShowErrors();
    if (!connection) return;
    const choice = { kind: "postgres" as const, ...connection };
    const result = await send(
      () =>
        api.chooseDatabase(
          { ...choice, createIfMissing: postgresForm.createIfMissing },
          codeToSend,
        ),
      isDatabaseDecidedAlready,
    );
    if (result.ok) next();
    else if (result.problem) showDatabaseProblem(result.problem);
  }

  async function testConnection(): Promise<TestOutcome> {
    const connection = readConnectionOrShowErrors();
    if (!connection) return "failed";
    setStatusMessage("");
    try {
      await api.testDatabaseConnection(connection, codeToSend);
      return "passed";
    } catch (error) {
      // Not finding the database is fine when Lintel is going to create it.
      if (postgresForm.createIfMissing && hasCode(error, "DATABASE_NOT_FOUND")) {
        return "passed-will-create";
      }
      const problem = stepProblemFor(error, handleInterrupted);
      if (problem) showDatabaseProblem(problem);
      return "failed";
    }
  }

  function readConnectionOrShowErrors() {
    const result = readPostgresForm(postgresForm);
    if (result.errors) {
      setConnectionErrors(result.errors);
      const firstField = Object.keys(result.errors)[0];
      if (firstField) focusField(firstField);
      return undefined;
    }
    setConnectionErrors({});
    return result.connection;
  }

  function showDatabaseProblem(problem: { code?: string; message: string }) {
    const placed = placeDatabaseProblem(problem);
    setConnectionErrors(placed.errors);
    setStatusMessage(placed.statusMessage);
    if (placed.field) focusField(placed.field);
  }

  async function createAccount() {
    if (!showFieldError("password", passwordProblem(details.password))) return;

    let session: Session | undefined;
    const result = await send(async () => {
      session = await api.createFirstAccount(cleanAccountDetails(details), codeToSend);
    });
    if (result.ok && session) {
      onAccountCreated(session);
      return;
    }
    if (!result.problem) return;

    // A problem with an earlier answer is shown on that answer's own screen.
    const field = hasCode(result.error, "INVALID_REQUEST")
      ? fieldForAccountMessage(result.problem.message)
      : undefined;
    if (field) {
      setFieldErrors({ ...fieldErrors, [field]: result.problem.message });
      if (field !== "password") move(field, "back");
    } else {
      setStatusMessage(result.problem.message);
    }
  }

  function changeDetail(field: AccountField, value: string) {
    setDetails({ ...details, [field]: value });
    setFieldErrors({ ...fieldErrors, [field]: undefined });
  }

  return (
    <FullScreenLayout
      progress={setupProgress(screen, status, databaseKind)}
      showsAppMark={screen !== "welcome"}
    >
      {renderScreen()}
    </FullScreenLayout>
  );

  function renderScreen() {
    switch (screen) {
      case "welcome":
        return <WelcomeScreen onContinue={() => next()} />;
      case "setup-code":
        return (
          <SetupCodeScreen
            code={setupCode}
            onCodeChange={(code) => {
              setSetupCode(code);
              setFieldErrors({ ...fieldErrors, setupCode: undefined });
            }}
            error={fieldErrors.setupCode}
            onContinue={continueFromSetupCode}
            onBack={back}
          />
        );
      case "database":
        return (
          <DatabaseScreen
            databaseKind={databaseKind}
            onDatabaseKindChange={setDatabaseKind}
            onChosen={(kind) => afterSelectionShows(() => void saveDatabase(kind))}
            onContinue={() => void saveDatabase(databaseKind)}
            onBack={back}
            isBusy={isBusy}
            statusMessage={statusMessage}
          />
        );
      case "postgres":
        return (
          <PostgresScreen
            form={postgresForm}
            errors={connectionErrors}
            onChange={(changes) => {
              setPostgresForm({ ...postgresForm, ...changes });
              setConnectionErrors({});
              setStatusMessage("");
            }}
            onTestConnection={testConnection}
            onContinue={() => void savePostgres()}
            onBack={back}
            isBusy={isBusy}
            statusMessage={statusMessage}
          />
        );
      case "name":
        return (
          <NameScreen
            name={details.name}
            onNameChange={(name) => changeDetail("name", name)}
            error={fieldErrors.name}
            onContinue={() => showFieldError("name", nameProblem(details.name)) && next()}
            onBack={back}
          />
        );
      case "email":
        return (
          <EmailScreen
            email={details.email}
            onEmailChange={(email) => changeDetail("email", email)}
            error={fieldErrors.email}
            onContinue={() => showFieldError("email", emailProblem(details.email)) && next()}
            onBack={back}
          />
        );
      default:
        return (
          <PasswordScreen
            password={details.password}
            onPasswordChange={(password) => changeDetail("password", password)}
            email={details.email}
            error={fieldErrors.password}
            onContinue={() => void createAccount()}
            onBack={back}
            isBusy={isBusy}
            statusMessage={statusMessage}
          />
        );
    }
  }
}

function hasCode(error: unknown, code: string): boolean {
  return error instanceof ApiError && error.code === code;
}

/**
 * The database endpoints answer 409 when DATABASE_URL already chose the database. The
 * database screens are normally skipped then, but if not, there is nothing to choose: move on.
 */
function isDatabaseDecidedAlready(error: unknown): boolean {
  return hasCode(error, "SETUP_ALREADY_DONE");
}

function focusField(name: string) {
  const field = document.querySelector<HTMLInputElement>(`input[name="${name}"]`);
  field?.focus();
}
