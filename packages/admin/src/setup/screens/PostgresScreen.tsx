import { Check } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "../../design/Button.js";
import { t } from "../../i18n/strings.js";
import type { ConnectionErrors, PostgresForm } from "../postgresConnection.js";
import { PostgresFields } from "../PostgresFields.js";
import { WizardScreen } from "../WizardScreen.js";

/** What a connection test found. "failed" means the wizard is already showing why. */
export type TestOutcome = "passed" | "passed-will-create" | "failed";

interface PostgresScreenProps {
  form: PostgresForm;
  errors: ConnectionErrors;
  onChange: (changes: Partial<PostgresForm>) => void;
  onTestConnection: () => Promise<TestOutcome>;
  onContinue: () => void;
  onBack: () => void;
  isBusy: boolean;
  statusMessage: string;
}

/**
 * "Connect to your PostgreSQL". Testing is optional reassurance: Continue tests the
 * connection again as it saves, so nobody has to press two buttons.
 */
export function PostgresScreen({
  form,
  errors,
  onChange,
  onTestConnection,
  onContinue,
  onBack,
  isBusy,
  statusMessage,
}: PostgresScreenProps) {
  const hostInput = useRef<HTMLInputElement>(null);
  const [testState, setTestState] = useState<TestOutcome | "idle" | "testing">("idle");

  function change(changes: Partial<PostgresForm>) {
    // A passed test says nothing about details that have since changed.
    setTestState("idle");
    onChange(changes);
  }

  async function test() {
    setTestState("testing");
    setTestState(await onTestConnection());
  }

  const passedMessage =
    testState === "passed"
      ? t("database.testPassed")
      : testState === "passed-will-create"
        ? t("database.testPassedWillCreate")
        : "";

  return (
    <WizardScreen
      title={t("postgres.title")}
      subtitle={t("postgres.subtitle")}
      focusTarget={hostInput}
      onContinue={onContinue}
      onBack={onBack}
      isBusy={isBusy}
      busyLabel={t("database.saving")}
      statusMessage={statusMessage}
    >
      <PostgresFields form={form} errors={errors} onChange={change} hostRef={hostInput} />

      <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
        <Button
          variant="tinted"
          size="large"
          onClick={() => void test()}
          disabled={testState === "testing" || isBusy}
        >
          {testState === "testing" ? t("database.testing") : t("database.test")}
        </Button>
        {/* Failures show on the field they are about; this line only confirms success. */}
        <p aria-live="polite" className="flex items-center gap-1.5 text-footnote text-success">
          {passedMessage && <Check aria-hidden="true" strokeWidth={2.5} className="size-4" />}
          {passedMessage}
        </p>
      </div>
    </WizardScreen>
  );
}
