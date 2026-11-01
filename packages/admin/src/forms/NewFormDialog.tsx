import { CalendarCheck, FileText, Mail, MessageSquare, Receipt } from "lucide-react";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { ChoiceCardGroup, type ChoiceCard } from "../design/ChoiceCardGroup.js";
import { Dialog } from "../design/Dialog.js";
import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import type { FormTemplateId } from "./forms.types.js";

const templates: ReadonlyArray<ChoiceCard<FormTemplateId>> = [
  {
    value: "contact",
    title: t("forms.template.contact"),
    description: t("forms.template.contactHint"),
    icon: MessageSquare,
  },
  {
    value: "newsletter",
    title: t("forms.template.newsletter"),
    description: t("forms.template.newsletterHint"),
    icon: Mail,
  },
  {
    value: "quote_request",
    title: t("forms.template.quote"),
    description: t("forms.template.quoteHint"),
    icon: Receipt,
  },
  {
    value: "event_booking",
    title: t("forms.template.event"),
    description: t("forms.template.eventHint"),
    icon: CalendarCheck,
  },
  {
    value: "blank",
    title: t("forms.template.blank"),
    description: t("forms.template.blankHint"),
    icon: FileText,
  },
];

/** The usual name for a form made from each template, until someone types their own. */
const suggestedNames: Record<FormTemplateId, string> = {
  contact: t("forms.template.contact"),
  newsletter: t("forms.template.newsletter"),
  quote_request: t("forms.template.quote"),
  event_booking: t("forms.template.event"),
  blank: "",
};

interface NewFormDialogProps {
  open: boolean;
  isSaving: boolean;
  error: unknown;
  onClose: () => void;
  onCreate: (form: { name: string; template: FormTemplateId }) => void;
}

/** Start a form from a ready-made template (or a blank one) and give it a name. */
export function NewFormDialog({ open, isSaving, error, onClose, onCreate }: NewFormDialogProps) {
  const [template, setTemplate] = useState<FormTemplateId>("contact");
  const [name, setName] = useState(suggestedNames.contact);
  const [nameWasTyped, setNameWasTyped] = useState(false);
  const [showMissingName, setShowMissingName] = useState(false);

  function create() {
    if (name.trim() === "") {
      setShowMissingName(true);
      return;
    }
    onCreate({ name: name.trim(), template });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("forms.new.title")}
      description={t("forms.new.description")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={create} disabled={isSaving}>
            {isSaving ? t("forms.new.creating") : t("forms.new.create")}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5 pt-1"
        onSubmit={(event) => {
          event.preventDefault();
          create();
        }}
      >
        <ChoiceCardGroup<FormTemplateId>
          label={t("forms.new.templateLabel")}
          options={templates}
          value={template}
          onChange={(next) => {
            setTemplate(next);
            if (!nameWasTyped) setName(suggestedNames[next]);
          }}
          columns={2}
        />
        <TextField
          label={t("forms.new.name")}
          hint={t("forms.new.nameHint")}
          value={name}
          error={showMissingName && name.trim() === "" ? t("forms.builder.nameMissing") : undefined}
          onChange={(event) => {
            setName(event.target.value);
            setNameWasTyped(true);
          }}
        />
        {Boolean(error) && (
          <p role="alert" className="text-footnote text-danger">
            {describeError(error)}
          </p>
        )}
        <button type="submit" hidden aria-hidden="true" tabIndex={-1} />
      </form>
    </Dialog>
  );
}
