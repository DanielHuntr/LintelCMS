import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { Button } from "../design/Button.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { SelectField } from "../design/SelectField.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { readAddonSettings, saveAddonSettings } from "./addons.api.js";
import type { SettingsFormField } from "./settingsForm.js";

interface AddonSettingsFormProps {
  addonId: string;
  fields: readonly SettingsFormField[];
  canChange: boolean;
}

type Values = Record<string, unknown>;

/** An add-on's settings, drawn from its schema; the server checks them when they're saved. */
export function AddonSettingsForm({ addonId, fields, canChange }: AddonSettingsFormProps) {
  const queryClient = useQueryClient();
  const queryKey = ["addons", addonId, "settings"];
  const saved = useQuery({ queryKey, queryFn: () => readAddonSettings(addonId) });
  const [edits, setEdits] = useState<Values>({});
  const values: Values = { ...saved.data, ...edits };

  const save = useMutation({
    mutationFn: () => saveAddonSettings(addonId, values),
    onSuccess: (stored) => {
      queryClient.setQueryData(queryKey, stored);
      setEdits({});
    },
  });

  if (saved.isError) return <LoadError error={saved.error} onRetry={() => void saved.refetch()} />;
  if (!saved.data) {
    return (
      <LoadingRegion label={t("addons.settingsLoading")}>
        <Skeleton className="h-11" />
      </LoadingRegion>
    );
  }

  const change = (key: string, value: unknown) => {
    save.reset();
    setEdits((current) => ({ ...current, [key]: value }));
  };

  function submit(event: FormEvent) {
    event.preventDefault();
    save.mutate();
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={submit}>
      {fields.map((field) => (
        <SettingsField
          key={field.key}
          field={field}
          value={values[field.key]}
          disabled={!canChange}
          onChange={(value) => change(field.key, value)}
        />
      ))}
      {canChange && (
        <div className="flex items-center gap-3">
          <Button type="submit" variant="tinted" disabled={save.isPending}>
            {t("addons.settingsSave")}
          </Button>
          <p role="status" className="text-footnote text-label-secondary">
            {save.isSuccess && t("addons.settingsSaved")}
            {save.isError && <span className="text-danger">{describeError(save.error)}</span>}
          </p>
        </div>
      )}
    </form>
  );
}

interface SettingsFieldProps {
  field: SettingsFormField;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}

function SettingsField({ field, value, disabled, onChange }: SettingsFieldProps) {
  switch (field.kind) {
    case "toggle":
      return (
        <Toggle
          label={field.label}
          checked={value === true}
          disabled={disabled}
          onCheckedChange={onChange}
        />
      );
    case "choice":
      return (
        <SelectField
          label={field.label}
          options={field.options.map((option) => ({ value: option, label: option }))}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onValueChange={onChange}
        />
      );
    case "number":
      return (
        <TextField
          label={field.label}
          type="number"
          inputMode={field.whole ? "numeric" : "decimal"}
          min={field.minimum}
          max={field.maximum}
          step={field.whole ? 1 : "any"}
          value={typeof value === "number" ? String(value) : ""}
          disabled={disabled}
          onChange={(event) =>
            onChange(event.target.value === "" ? undefined : Number(event.target.value))
          }
        />
      );
    case "text":
      return (
        <TextField
          label={field.label}
          maxLength={field.maxLength}
          value={typeof value === "string" ? value : ""}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      );
  }
}
