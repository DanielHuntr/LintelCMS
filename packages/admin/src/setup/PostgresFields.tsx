import type { Ref } from "react";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { PasswordField } from "../design/PasswordField.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import type { ConnectionErrors, PostgresForm } from "./postgresConnection.js";

interface PostgresFieldsProps {
  form: PostgresForm;
  errors: ConnectionErrors;
  onChange: (changes: Partial<PostgresForm>) => void;
  /** The server address field, focused when the screen appears. */
  hostRef?: Ref<HTMLInputElement>;
}

/**
 * The connection details for someone's own Postgres, as plain separate fields rather than
 * one connection URL, which is easy to get subtly wrong.
 */
export function PostgresFields({ form, errors, onChange, hostRef }: PostgresFieldsProps) {
  return (
    <fieldset className="flex flex-col gap-6">
      <legend className="sr-only">{t("database.connectionDetails")}</legend>

      <div className="grid grid-cols-[1fr_6.5rem] items-start gap-3 sm:gap-4">
        <TextField
          ref={hostRef}
          fieldSize="large"
          label={t("database.host")}
          name="host"
          value={form.host}
          onChange={(event) => onChange({ host: event.target.value })}
          hint={t("database.hostHint")}
          error={errors.host}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <TextField
          fieldSize="large"
          label={t("database.port")}
          name="port"
          value={form.port}
          onChange={(event) => onChange({ port: event.target.value })}
          error={errors.port}
          inputMode="numeric"
        />
      </div>

      <TextField
        fieldSize="large"
        label={t("database.name")}
        name="database"
        value={form.database}
        onChange={(event) => onChange({ database: event.target.value })}
        error={errors.database}
        autoCapitalize="off"
        spellCheck={false}
      />

      <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 sm:gap-4">
        <TextField
          fieldSize="large"
          label={t("database.user")}
          name="user"
          value={form.user}
          onChange={(event) => onChange({ user: event.target.value })}
          error={errors.user}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        <PasswordField
          fieldSize="large"
          label={t("database.password")}
          name="password"
          value={form.password}
          onChange={(event) => onChange({ password: event.target.value })}
          error={errors.password}
          // The database's password, not the person's: keep password managers from saving it.
          autoComplete="off"
        />
      </div>

      <GroupedList>
        <GroupedListRow
          label={t("database.ssl")}
          description={t("database.sslDescription")}
          wrapsText
          accessory={
            <Toggle
              label={t("database.ssl")}
              labelVisibility="hidden"
              checked={form.ssl}
              onCheckedChange={(ssl) => onChange({ ssl })}
            />
          }
        />
        <GroupedListRow
          label={t("database.createIfMissing")}
          description={t("database.createIfMissingDescription")}
          wrapsText
          accessory={
            <Toggle
              label={t("database.createIfMissing")}
              labelVisibility="hidden"
              checked={form.createIfMissing}
              onCheckedChange={(createIfMissing) => onChange({ createIfMissing })}
            />
          }
        />
      </GroupedList>
    </fieldset>
  );
}
