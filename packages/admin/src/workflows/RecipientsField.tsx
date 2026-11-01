import { TextField } from "../design/TextField.js";
import { t } from "../i18n/strings.js";
import { SelectField } from "./FormControls.js";
import type { Recipients } from "./workflows.types.js";

interface RecipientsFieldProps {
  value: Recipients;
  onChange: (value: Recipients) => void;
  roles: readonly { handle: string; name: string }[];
  /** Email can go to addresses; notifications only to people with an account. */
  allowAddresses: boolean;
}

/** Who an email or notification goes to: a role, the person who made the change, or addresses. */
export function RecipientsField({ value, onChange, roles, allowAddresses }: RecipientsFieldProps) {
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label={t("stepEditor.toLabel")}
        value={value.type}
        onChange={(event) => {
          const type = event.target.value;
          if (type === "role") onChange({ type: "role", role: roles[0]?.handle ?? "super-admin" });
          else if (type === "addresses") onChange({ type: "addresses", addresses: "" });
          else onChange({ type: "actor" });
        }}
      >
        <option value="actor">{t("stepEditor.to.actor")}</option>
        <option value="role">{t("stepEditor.to.role")}</option>
        {allowAddresses && <option value="addresses">{t("stepEditor.to.addresses")}</option>}
      </SelectField>
      {value.type === "role" && (
        <RoleSelect
          label={t("stepEditor.roleLabel")}
          roles={roles}
          value={value.role}
          onChange={(role) => onChange({ type: "role", role })}
        />
      )}
      {value.type === "addresses" && (
        <TextField
          label={t("stepEditor.addressesLabel")}
          hint={t("stepEditor.addressesHint")}
          value={value.addresses}
          placeholder="team@example.com"
          onChange={(event) => onChange({ type: "addresses", addresses: event.target.value })}
        />
      )}
    </div>
  );
}

export function RoleSelect({
  label,
  roles,
  value,
  onChange,
}: {
  label: string;
  roles: readonly { handle: string; name: string }[];
  value: string;
  onChange: (role: string) => void;
}) {
  const known = roles.some((role) => role.handle === value);
  return (
    <SelectField label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {!known && <option value={value}>{value}</option>}
      {roles.map((role) => (
        <option key={role.handle} value={role.handle}>
          {role.name}
        </option>
      ))}
    </SelectField>
  );
}
