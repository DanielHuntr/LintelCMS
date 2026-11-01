import { type FormEvent, useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { t } from "../i18n/strings.js";
import { TextAreaField } from "./FormControls.js";

interface TestRunDialogProps {
  sampleData: Record<string, unknown>;
  isStarting: boolean;
  error: unknown;
  onClose: () => void;
  onStart: (sampleData: Record<string, unknown>) => void;
}

/** Runs the workflow once with example data, which can be changed first. */
export function TestRunDialog({
  sampleData,
  isStarting,
  error,
  onClose,
  onStart,
}: TestRunDialogProps) {
  const [text, setText] = useState(() => JSON.stringify(sampleData, null, 2));
  const [invalid, setInvalid] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed))
        throw new Error("not an object");
      setInvalid(false);
      onStart(parsed as Record<string, unknown>);
    } catch {
      setInvalid(true);
    }
  }

  return (
    <Dialog
      open
      size="sheet"
      onClose={onClose}
      title={t("testRun.title")}
      description={t("testRun.description")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="test-run" disabled={isStarting}>
            {isStarting ? t("testRun.starting") : t("testRun.start")}
          </Button>
        </>
      }
    >
      <form id="test-run" onSubmit={submit} className="flex flex-col gap-3">
        <TextAreaField
          label={t("testRun.sampleLabel")}
          code
          rows={12}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-invalid={invalid}
        />
        {(invalid || error !== null) && (
          <p role="alert" className="text-footnote text-danger">
            {invalid ? t("testRun.invalidJson") : describeError(error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}
