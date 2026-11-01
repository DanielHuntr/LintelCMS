import { useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { webhookEventLabels, webhookEvents, type WebhookEvent } from "./webhooks.api.js";

export interface WebhookFormValues {
  name: string;
  url: string;
  events: WebhookEvent[];
}

interface WebhookFormDialogProps {
  open: boolean;
  title: string;
  submitLabel: string;
  initialValues?: WebhookFormValues;
  isSaving: boolean;
  error: unknown;
  onSubmit: (values: WebhookFormValues) => void;
  onClose: () => void;
}

const emptyValues: WebhookFormValues = { name: "", url: "", events: ["entry.published"] };

/** Adding or changing a webhook: where to send events, and which ones. */
export function WebhookFormDialog({
  open,
  title,
  submitLabel,
  initialValues = emptyValues,
  isSaving,
  error,
  onSubmit,
  onClose,
}: WebhookFormDialogProps) {
  const [values, setValues] = useState(initialValues);
  const [noEvents, setNoEvents] = useState(false);

  function toggleEvent(event: WebhookEvent, checked: boolean) {
    setNoEvents(false);
    setValues((current) => ({
      ...current,
      events: checked
        ? webhookEvents.filter((name) => name === event || current.events.includes(name))
        : current.events.filter((name) => name !== event),
    }));
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (values.events.length === 0) {
      setNoEvents(true);
      return;
    }
    onSubmit(values);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      description={t("webhooks.formDescription")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="webhook-form" disabled={isSaving}>
            {isSaving ? t("webhooks.saving") : submitLabel}
          </Button>
        </>
      }
    >
      <form id="webhook-form" onSubmit={submit} className="flex flex-col gap-5">
        <TextField
          label={t("webhooks.urlLabel")}
          hint={t("webhooks.urlHint")}
          placeholder="https://example.com/hooks/lintel"
          type="url"
          inputMode="url"
          value={values.url}
          onChange={(event) => setValues({ ...values, url: event.target.value })}
          error={error ? describeError(error) : undefined}
          required
          data-autofocus
        />
        <TextField
          label={t("webhooks.nameLabel")}
          hint={t("webhooks.nameHint")}
          value={values.name}
          maxLength={100}
          onChange={(event) => setValues({ ...values, name: event.target.value })}
        />
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-footnote font-medium text-label">
            {t("webhooks.eventsLabel")}
          </legend>
          <GroupedList>
            {webhookEvents.map((event) => (
              <GroupedListRow
                key={event}
                label={t(webhookEventLabels[event])}
                description={event}
                accessory={
                  <Toggle
                    label={t(webhookEventLabels[event])}
                    labelVisibility="hidden"
                    checked={values.events.includes(event)}
                    onCheckedChange={(checked) => toggleEvent(event, checked)}
                  />
                }
              />
            ))}
          </GroupedList>
          {noEvents && (
            <p role="alert" className="text-footnote text-danger">
              {t("webhooks.chooseAnEvent")}
            </p>
          )}
        </fieldset>
      </form>
    </Dialog>
  );
}
