import { type FormEvent, useState } from "react";
import { useCollections } from "../content/content.queries.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { describeEvent, schedulePresets } from "./describeSteps.js";
import { SelectField } from "./FormControls.js";
import type { EventDefinition, Trigger } from "./workflows.types.js";

interface TriggerEditorDialogProps {
  trigger: Trigger;
  events: readonly EventDefinition[];
  onClose: () => void;
  onSave: (trigger: Trigger) => void;
}

/** What starts the workflow: something happening, a schedule, or a button. */
export function TriggerEditorDialog({
  trigger,
  events,
  onClose,
  onSave,
}: TriggerEditorDialogProps) {
  const [draft, setDraft] = useState<Trigger>(trigger);
  const collections = useCollections();
  const [isCustomSchedule, setIsCustomSchedule] = useState(
    trigger.type === "schedule" && !schedulePresets.some((preset) => preset.cron === trigger.cron),
  );
  const groups = [...new Set(events.map((event) => event.group))];

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(draft);
  }

  function changeKind(kind: Trigger["type"]) {
    if (kind === "event")
      setDraft({ type: "event", event: events[0]?.name ?? "entry.published", collections: [] });
    if (kind === "schedule") setDraft({ type: "schedule", cron: schedulePresets[1].cron });
    if (kind === "manual") setDraft({ type: "manual" });
  }

  return (
    <Dialog
      open
      size="sheet"
      onClose={onClose}
      title={t("trigger.dialogTitle")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="trigger-editor">
            {t("stepEditor.save")}
          </Button>
        </>
      }
    >
      <form id="trigger-editor" onSubmit={submit} className="flex flex-col gap-5">
        <SegmentedControl
          label={t("trigger.kindLabel")}
          value={draft.type}
          onChange={changeKind}
          options={[
            { value: "event", label: t("trigger.kind.event") },
            { value: "schedule", label: t("trigger.kind.schedule") },
            { value: "manual", label: t("trigger.kind.manual") },
          ]}
        />

        {draft.type === "event" && (
          <>
            <SelectField
              label={t("trigger.eventLabel")}
              value={draft.event}
              onChange={(event) => setDraft({ ...draft, event: event.target.value })}
            >
              {groups.map((group) => (
                <optgroup key={group} label={group}>
                  {events
                    .filter((event) => event.group === group)
                    .map((event) => (
                      <option key={event.name} value={event.name}>
                        {capitalise(describeEvent(event.name, events))}
                      </option>
                    ))}
                </optgroup>
              ))}
            </SelectField>
            {draft.event.startsWith("entry.") && (
              <fieldset className="flex flex-col gap-2">
                <legend className="mb-1 text-footnote font-medium text-label">
                  {t("trigger.collectionsLabel")}
                </legend>
                {(collections.data ?? []).map((collection) => (
                  <Toggle
                    key={collection.handle}
                    label={collection.name}
                    checked={draft.collections.includes(collection.handle)}
                    onCheckedChange={(checked) =>
                      setDraft({
                        ...draft,
                        collections: checked
                          ? [...draft.collections, collection.handle]
                          : draft.collections.filter((handle) => handle !== collection.handle),
                      })
                    }
                  />
                ))}
                <p className="text-footnote text-label-secondary">{t("trigger.collectionsHint")}</p>
              </fieldset>
            )}
          </>
        )}

        {draft.type === "schedule" && (
          <>
            <SelectField
              label={t("trigger.scheduleLabel")}
              value={isCustomSchedule ? "custom" : draft.cron}
              onChange={(event) => {
                const value = event.target.value;
                setIsCustomSchedule(value === "custom");
                if (value !== "custom") setDraft({ type: "schedule", cron: value });
              }}
            >
              {schedulePresets.map((preset) => (
                <option key={preset.cron} value={preset.cron}>
                  {t(preset.label)}
                </option>
              ))}
              <option value="custom">{t("trigger.preset.custom")}</option>
            </SelectField>
            {isCustomSchedule && (
              <TextField
                label={t("trigger.cronLabel")}
                hint={t("trigger.cronHint")}
                value={draft.cron}
                className="font-mono"
                onChange={(event) => setDraft({ type: "schedule", cron: event.target.value })}
              />
            )}
          </>
        )}
      </form>
    </Dialog>
  );
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
