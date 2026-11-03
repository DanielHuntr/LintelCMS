import { describeError } from "../api/describeError.js";
import { GroupedList } from "../design/GroupedList.js";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import type { ClientChangesRule } from "./clientEditing.api.js";
import {
  useClientEditingSettings,
  useUpdateClientEditingSettings,
} from "./clientEditing.queries.js";

/**
 * Users and roles: whether clients' changes go live when they publish, or wait for someone
 * to approve them. Shown to people who may change settings.
 */
export function ClientChangesSetting() {
  const canChange = useCan("settings:update");
  const settings = useClientEditingSettings();
  const update = useUpdateClientEditingSettings();
  if (!canChange || !settings.data) return null;
  return (
    <GroupedList
      header={t("clientEditing.setting.title")}
      footer={t("clientEditing.setting.description")}
    >
      <li className="px-4 py-3">
        <SegmentedControl<ClientChangesRule>
          label={t("clientEditing.setting.title")}
          value={
            update.isPending && update.variables ? update.variables : settings.data.clientChanges
          }
          onChange={(rule) => update.mutate(rule)}
          options={[
            { value: "goLive", label: t("clientEditing.setting.goLive") },
            { value: "needsApproval", label: t("clientEditing.setting.needsApproval") },
          ]}
        />
        {update.isError && (
          <p role="alert" className="mt-2 text-footnote text-danger">
            {describeError(update.error)}
          </p>
        )}
      </li>
    </GroupedList>
  );
}
