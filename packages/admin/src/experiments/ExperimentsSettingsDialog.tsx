import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useExperimentsSettings, useSaveExperimentsSettings } from "./experiments.queries.js";
import type { ExperimentsSettings } from "./experiments.types.js";

/** The one choice tests have: count visitors only after they accept in the cookie notice. */
export function ExperimentsSettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const stored = useExperimentsSettings(open);
  const save = useSaveExperimentsSettings();
  // What has been changed here; until then, what is saved.
  const [edits, setDraft] = useState<ExperimentsSettings | null>(null);
  const draft = edits ?? stored.data ?? null;
  const close = () => {
    setDraft(null);
    onClose();
  };

  const submit = async () => {
    if (!draft) return;
    await save.mutateAsync(draft);
    close();
  };

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("experiments.settings.title")}
      footer={
        <>
          <Button variant="plain" onClick={close}>
            {t("experiments.settings.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={!draft || save.isPending}>
            {t("experiments.settings.save")}
          </Button>
        </>
      }
    >
      {draft && (
        <div>
          <Toggle
            label={t("experiments.settings.consent")}
            checked={draft.countOnlyAfterConsent}
            onCheckedChange={(checked) => setDraft({ ...draft, countOnlyAfterConsent: checked })}
            describedBy="experiments-consent-hint"
          />
          <p id="experiments-consent-hint" className="mt-1.5 text-footnote text-label-secondary">
            {t("experiments.settings.consentHint")}
          </p>
        </div>
      )}
      {save.isError && (
        <p className="mt-3 text-footnote text-danger">{describeError(save.error)}</p>
      )}
    </Dialog>
  );
}
