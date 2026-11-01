import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { useVisibleContributions } from "./AdminPluginsContext.js";

/**
 * Plugins' rows on the Settings screen, one group per header, in the order the groups
 * first appear. Rows that name the same header share a group, even across plugins.
 */
export function PluginSettingsRows() {
  const rows = useVisibleContributions("settingsRows");
  const groups = [...new Set(rows.map((row) => row.group))];
  return groups.map((group) => (
    <GroupedList key={group} header={group}>
      {rows
        .filter((row) => row.group === group)
        .map((row) => (
          <GroupedListRow
            key={`${row.pluginId}:${row.to}`}
            icon={row.icon}
            iconTone="success"
            label={row.label}
            description={row.description}
            to={row.to}
          />
        ))}
    </GroupedList>
  ));
}
