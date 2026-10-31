import { PasswordField } from "../design/PasswordField.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import type { ConnectionErrors, PostgresForm } from "./postgresConnection.js";

interface PostgresFieldsProps {
  form: PostgresForm;
  errors: ConnectionErrors;
  onChange: (changes: Partial<PostgresForm>) => void;
}

/**
 * The connection details for someone's own Postgres, as plain separate fields rather than
 * one connection URL, which is easy to get subtly wrong.
 */
export function PostgresFields({ form, errors, onChange }: PostgresFieldsProps) {
  return (
    <fieldset className="flex flex-col gap-5">
      <legend className="sr-only">{t("database.connectionDetails")}</legend>

      <div className="grid grid-cols-[1fr_6rem] items-start gap-3">
        <TextField
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
          label={t("database.port")}
          name="port"
          value={form.port}
          onChange={(event) => onChange({ port: event.target.value })}
          error={errors.port}
          inputMode="numeric"
        />
      </div>

      <div className="grid grid-cols-2 items-start gap-3">
        <TextField
          label={t("database.name")}
          name="database"
          value={form.database}
          onChange={(event) => onChange({ database: event.target.value })}
          error={errors.database}
          autoCapitalize="off"
          spellCheck={false}
        />
        <TextField
          label={t("database.user")}
          name="user"
          value={form.user}
          onChange={(event) => onChange({ user: event.target.value })}
          error={errors.user}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
        />
      </div>

      <PasswordField
        label={t("database.password")}
        name="password"
        value={form.password}
        onChange={(event) => onChange({ password: event.target.value })}
        error={errors.password}
        // The database's password, not the person's: keep password managers from saving it as theirs.
        autoComplete="off"
      />

      <div className="flex flex-col gap-4 pt-1">
        <Toggle
          label={t("database.ssl")}
          checked={form.ssl}
          onCheckedChange={(ssl) => onChange({ ssl })}
        />
        <Toggle
          label={t("database.createIfMissing")}
          checked={form.createIfMissing}
          onCheckedChange={(createIfMissing) => onChange({ createIfMissing })}
        />
      </div>
    </fieldset>
  );
}
