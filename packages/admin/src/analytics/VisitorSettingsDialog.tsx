import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { SelectField } from "../design/SelectField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import type { AnalyticsSettings } from "./analytics.api.js";
import { useAnalyticsSettings, useSaveAnalyticsSettings } from "./analytics.queries.js";

const RETENTION_CHOICES = [7, 30, 90, 180, 365];

/** The two choices a site has: ask before counting, and how long single visits are kept. */
export function VisitorSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const stored = useAnalyticsSettings(open);
  const save = useSaveAnalyticsSettings();
  // What has been changed here; until then, what is saved.
  const [edits, setDraft] = useState<AnalyticsSettings | null>(null);
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
      title={t("visitors.settings.title")}
      footer={
        <>
          <Button variant="plain" onClick={close}>
            {t("visitors.settings.cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={!draft || save.isPending}>
            {t("visitors.settings.save")}
          </Button>
        </>
      }
    >
      {draft && (
        <div className="flex flex-col gap-5">
          <div>
            <Toggle
              label={t("visitors.settings.consent")}
              checked={draft.countOnlyAfterConsent}
              onCheckedChange={(checked) => setDraft({ ...draft, countOnlyAfterConsent: checked })}
              describedBy="visitors-consent-hint"
            />
            <p id="visitors-consent-hint" className="mt-1.5 text-footnote text-label-secondary">
              {t("visitors.settings.consentHint")}
            </p>
          </div>
          <SelectField
            label={t("visitors.settings.retention")}
            hint={t("visitors.settings.retentionHint")}
            value={String(draft.retentionDays)}
            onValueChange={(value) => setDraft({ ...draft, retentionDays: Number(value) })}
            options={[...new Set([...RETENTION_CHOICES, draft.retentionDays])]
              .sort((a, b) => a - b)
              .map((days) => ({
                value: String(days),
                label: t("visitors.settings.days", { days }),
              }))}
          />
        </div>
      )}
      {save.isError && (
        <p className="mt-3 text-footnote text-danger">{describeError(save.error)}</p>
      )}
    </Dialog>
  );
}
