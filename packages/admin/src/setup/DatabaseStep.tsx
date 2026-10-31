import { Check, Database, HardDrive } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { ApiError } from "../api/client.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { ChoiceCardGroup, type ChoiceCard } from "../design/ChoiceCardGroup.js";
import { t } from "../i18n/strings.js";
import {
  defaultPostgresForm,
  fieldForDatabaseError,
  readPostgresForm,
  type ConnectionErrors,
  type PostgresForm,
} from "./postgresConnection.js";
import { PostgresFields } from "./PostgresFields.js";
import type { SetupApi, SetupCode } from "./setup.api.js";
import { stepProblemFor, type SetupFailure } from "./setupErrors.js";
import { focusField, StatusLine, StepPanel } from "./StepPanel.js";

type DatabaseKind = "built-in" | "postgres";

const databaseChoices: readonly ChoiceCard<DatabaseKind>[] = [
  {
    value: "built-in",
    title: t("database.builtInTitle"),
    description: t("database.builtInDescription"),
    icon: HardDrive,
    accessory: <Badge tone="accent">{t("database.recommended")}</Badge>,
  },
  {
    value: "postgres",
    title: t("database.postgresTitle"),
    description: t("database.postgresDescription"),
    icon: Database,
  },
];

type TestState = "idle" | "testing" | "passed" | "passed-will-create";

interface DatabaseStepProps {
  api: Pick<SetupApi, "testDatabaseConnection" | "chooseDatabase">;
  setupCode: SetupCode;
  stepNumber?: { current: number; total: number };
  takesFocus: boolean;
  onSaved: () => void;
  onInterrupted: (failure: Exclude<SetupFailure, { kind: "problem" | "unreachable" }>) => void;
}

/**
 * "Where should Lintel keep your content?" Built-in needs nothing more. For Postgres, the
 * test is optional reassurance: Continue checks the connection again as it saves, so nobody
 * is made to press two buttons.
 */
export function DatabaseStep({
  api,
  setupCode,
  stepNumber,
  takesFocus,
  onSaved,
  onInterrupted,
}: DatabaseStepProps) {
  const formElement = useRef<HTMLFormElement>(null);
  const [kind, setKind] = useState<DatabaseKind>("built-in");
  const [postgresForm, setPostgresForm] = useState<PostgresForm>(defaultPostgresForm);
  const [errors, setErrors] = useState<ConnectionErrors>({});
  const [testState, setTestState] = useState<TestState>("idle");
  const [statusMessage, setStatusMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  function changePostgresForm(changes: Partial<PostgresForm>) {
    setPostgresForm({ ...postgresForm, ...changes });
    // A passed test no longer says anything about the details once they change.
    setTestState("idle");
    setErrors({});
    setStatusMessage("");
  }

  /** The connection to send, or undefined after showing what to fix. */
  function readConnectionOrShowErrors() {
    const result = readPostgresForm(postgresForm);
    if (result.errors) {
      setErrors(result.errors);
      const firstField = Object.keys(result.errors)[0];
      if (firstField) focusField(formElement.current, firstField);
      return undefined;
    }
    return result.connection;
  }

  function showFailure(error: unknown) {
    const problem = stepProblemFor(error, onInterrupted);
    if (!problem) return;

    const field = fieldForDatabaseError(problem.code);
    if (field) {
      setErrors({ [field]: problem.message });
      focusField(formElement.current, field);
    } else {
      setStatusMessage(problem.message);
    }
  }

  async function handleTestConnection() {
    setStatusMessage("");
    setErrors({});
    const connection = readConnectionOrShowErrors();
    if (!connection) return;

    setTestState("testing");
    try {
      await api.testDatabaseConnection(connection, setupCode);
      setTestState("passed");
    } catch (error) {
      setTestState("idle");
      // Reaching the server but not finding the database is fine when Lintel will create it.
      if (postgresForm.createIfMissing && isDatabaseNotFound(error)) {
        setTestState("passed-will-create");
        return;
      }
      showFailure(error);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage("");
    setErrors({});

    const connection = kind === "postgres" ? readConnectionOrShowErrors() : undefined;
    if (kind === "postgres" && !connection) return;

    setIsSaving(true);
    try {
      await api.chooseDatabase(
        connection
          ? { kind: "postgres", ...connection, createIfMissing: postgresForm.createIfMissing }
          : { kind: "built-in" },
        setupCode,
      );
      onSaved();
    } catch (error) {
      setIsSaving(false);
      showFailure(error);
    }
  }

  return (
    <StepPanel title={t("database.title")} stepNumber={stepNumber} takesFocus={takesFocus}>
      <form ref={formElement} noValidate onSubmit={handleSubmit} className="flex flex-col">
        <ChoiceCardGroup
          label={t("database.title")}
          options={databaseChoices}
          value={kind}
          onChange={(value) => {
            setKind(value);
            setStatusMessage("");
          }}
        />

        {kind === "postgres" && (
          <div className="mt-7 flex flex-col gap-5">
            <PostgresFields form={postgresForm} errors={errors} onChange={changePostgresForm} />
            <TestConnectionRow testState={testState} onTest={handleTestConnection} />
          </div>
        )}

        <Button type="submit" size="large" fullWidth className="mt-7" disabled={isSaving}>
          {isSaving && kind === "postgres" ? t("database.saving") : t("setup.continue")}
        </Button>
      </form>
      <StatusLine message={statusMessage} />
    </StepPanel>
  );
}

function TestConnectionRow({ testState, onTest }: { testState: TestState; onTest: () => void }) {
  const passedMessage =
    testState === "passed"
      ? t("database.testPassed")
      : testState === "passed-will-create"
        ? t("database.testPassedWillCreate")
        : "";

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Button variant="tinted" onClick={onTest} disabled={testState === "testing"}>
        {testState === "testing" ? t("database.testing") : t("database.test")}
      </Button>
      {/* Failures are shown on the field they are about; this only confirms success. */}
      <p aria-live="polite" className="flex items-center gap-1 text-footnote text-success">
        {passedMessage && <Check aria-hidden="true" strokeWidth={2.5} className="size-4" />}
        {passedMessage}
      </p>
    </div>
  );
}

function isDatabaseNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === "DATABASE_NOT_FOUND";
}
