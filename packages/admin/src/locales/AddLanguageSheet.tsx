import { ChevronsUpDown } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { commonLocaleCodes, describeLanguage } from "./commonLocales.js";

const otherLanguage = "other";

interface AddLanguageSheetProps {
  /** Codes the site already has, left out of the list. */
  existingCodes: readonly string[];
  onAdd: (code: string) => Promise<void>;
  onClose: () => void;
}

/** Pick a language from a list of common ones, or type the code of any other. */
export function AddLanguageSheet({ existingCodes, onAdd, onClose }: AddLanguageSheetProps) {
  const offered = commonLocaleCodes.filter((code) => !existingCodes.includes(code));
  const [choice, setChoice] = useState<string>(offered[0] ?? otherLanguage);
  const [typedCode, setTypedCode] = useState("");
  const [problem, setProblem] = useState<string | undefined>();
  const [isAdding, setIsAdding] = useState(false);
  const selectId = useId();
  const code = choice === otherLanguage ? typedCode.trim() : choice;

  async function add(event?: FormEvent) {
    event?.preventDefault();
    if (code === "") {
      setProblem(t("languages.problem.code"));
      return;
    }
    setIsAdding(true);
    setProblem(undefined);
    try {
      await onAdd(code);
    } catch (error) {
      setProblem(describeError(error));
    } finally {
      setIsAdding(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("languages.addTitle")}
      description={t("languages.addDescription")}
      footer={
        <>
          <Button variant="tinted" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void add()} disabled={isAdding}>
            {t("languages.add")}
          </Button>
        </>
      }
    >
      <form onSubmit={(event) => void add(event)} className="flex flex-col gap-5 pt-2 pb-1">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={selectId} className="text-footnote font-medium text-label">
            {t("languages.language")}
          </label>
          <div className="relative">
            <select
              id={selectId}
              value={choice}
              data-autofocus
              onChange={(event) => setChoice(event.target.value)}
              className={classNames("h-10 appearance-none pe-9", controlClasses())}
            >
              {offered.map((option) => (
                <option key={option} value={option}>
                  {describeLanguage(option)}
                </option>
              ))}
              <option value={otherLanguage}>{t("languages.other")}</option>
            </select>
            <ChevronsUpDown
              aria-hidden="true"
              strokeWidth={2}
              className="pointer-events-none absolute top-1/2 inset-e-3 size-4 -translate-y-1/2 text-label-secondary"
            />
          </div>
          {choice !== otherLanguage && problem && (
            <p className="text-footnote font-medium text-danger">{problem}</p>
          )}
        </div>
        {choice === otherLanguage && (
          <TextField
            label={t("languages.code")}
            hint={t("languages.codeHint")}
            value={typedCode}
            error={problem}
            spellCheck={false}
            autoCapitalize="off"
            className="[&_input]:font-mono"
            onChange={(event) => setTypedCode(event.target.value)}
          />
        )}
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}
