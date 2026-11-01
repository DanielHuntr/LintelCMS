import { hasPermission, type Permission } from "@lintel/core/permissions";
import { GroupedList } from "../design/GroupedList.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import type { PermissionGroup } from "./people.api.js";

interface PermissionEditorProps {
  groups: PermissionGroup[];
  /** The role's permissions; may hold wildcards for built-in roles. */
  permissions: readonly string[];
  onChange: (permissions: string[]) => void;
  /** Built-in roles are shown, not changed. */
  readOnly: boolean;
}

/**
 * What a role can do, in words: one switch per permission, grouped by area like the
 * sections of the admin. Permissions this screen doesn't show (from a plugin that is
 * switched off) are kept as they are.
 */
export function PermissionEditor({
  groups,
  permissions,
  onChange,
  readOnly,
}: PermissionEditorProps) {
  function toggle(permission: string, on: boolean) {
    onChange(on ? [...permissions, permission] : permissions.filter((held) => held !== permission));
  }

  return (
    <div className="flex flex-col gap-8">
      {groups.map((group) => (
        <GroupedList
          key={group.id}
          header={group.pluginId ? t("roles.pluginGroup", { name: group.name }) : group.name}
          footer={group.description}
        >
          {group.permissions.map((entry) => {
            const isOn = hasPermission(permissions, entry.permission as Permission);
            return (
              <li key={entry.permission}>
                <div className="flex items-center gap-3 pl-4">
                  <span className="flex min-h-11 min-w-0 flex-1 items-center gap-3 py-2.5 pr-4 [li+li>*>&]:hairline-top">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-body text-label">{entry.name}</span>
                      {entry.description && (
                        <span className="text-footnote text-label-secondary">
                          {entry.description}
                        </span>
                      )}
                    </span>
                    <Toggle
                      label={entry.name}
                      labelVisibility="hidden"
                      checked={isOn}
                      disabled={readOnly}
                      onCheckedChange={(on) => toggle(entry.permission, on)}
                    />
                  </span>
                </div>
              </li>
            );
          })}
        </GroupedList>
      ))}
    </div>
  );
}
