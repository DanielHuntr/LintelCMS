import { useId, useState } from "react";
import { describeError } from "../api/describeError.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { controlClasses } from "../design/controlStyles.js";
import { Dialog } from "../design/Dialog.js";
import { t } from "../i18n/strings.js";
import type { WidgetPlacement } from "./dashboardLayout.js";
import { useClearRoleLayout, useRoleLayouts, useSaveRoleLayout } from "./dashboard.queries.js";

interface RoleDefaultDialogProps {
  open: boolean;
  /** The layout on screen, which becomes the role's default. */
  layout: readonly WidgetPlacement[];
  onClose: () => void;
}

/**
 * For admins: make the layout on screen the one everyone with a role starts from, or take
 * a role's default away again. People who have arranged their own keep it.
 */
export function RoleDefaultDialog({ open, layout, onClose }: RoleDefaultDialogProps) {
  const roles = useRoleLayouts(open);
  const save = useSaveRoleLayout();
  const clear = useClearRoleLayout();
  const [chosenRoleId, setChosenRoleId] = useState("");
  const [status, setStatus] = useState("");
  const selectId = useId();
  const roleId = chosenRoleId || roles.data?.[0]?.id || "";
  const roleName = (id: string) => roles.data?.find((role) => role.id === id)?.name ?? "";
  const failure = save.error ?? clear.error ?? roles.error;

  function useForRole() {
    save.mutate(
      { roleId, widgets: [...layout] },
      { onSuccess: () => setStatus(t("dashboard.roleDefault.saved", { role: roleName(roleId) })) },
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("dashboard.roleDefault.title")}
      description={t("dashboard.roleDefault.description")}
      footer={
        <>
          <Button variant="plain" onClick={onClose}>
            {t("dashboard.gallery.close")}
          </Button>
          <Button onClick={useForRole} disabled={!roleId || save.isPending}>
            {t("dashboard.roleDefault.save")}
          </Button>
        </>
      }
    >
      {roles.isPending && (
        <p className="text-body text-label-secondary">{t("dashboard.roleDefault.loading")}</p>
      )}
      {roles.data?.length === 0 && (
        <p className="text-body text-label-secondary">{t("dashboard.roleDefault.noRoles")}</p>
      )}
      {roles.data && roles.data.length > 0 && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={selectId} className="text-footnote font-medium text-label">
              {t("dashboard.roleDefault.role")}
            </label>
            <select
              id={selectId}
              data-autofocus
              value={roleId}
              onChange={(event) => setChosenRoleId(event.target.value)}
              className={controlClasses()}
            >
              {roles.data.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>
          <ul className="flex flex-col gap-1">
            {roles.data
              .filter((role) => role.widgets !== null)
              .map((role) => (
                <li key={role.id} className="flex items-center gap-3">
                  <span className="flex-1 text-body text-label">{role.name}</span>
                  <Badge tone="accent">{t("dashboard.roleDefault.hasOne")}</Badge>
                  <Button
                    variant="destructive"
                    size="small"
                    aria-label={t("dashboard.roleDefault.remove", { role: role.name })}
                    disabled={clear.isPending}
                    onClick={() =>
                      clear.mutate(role.id, {
                        onSuccess: () =>
                          setStatus(t("dashboard.roleDefault.removed", { role: role.name })),
                      })
                    }
                  >
                    {t("dashboard.roleDefault.removeShort")}
                  </Button>
                </li>
              ))}
          </ul>
        </div>
      )}
      {failure && (
        <p role="alert" className="mt-4 text-footnote text-danger">
          {describeError(failure)}
        </p>
      )}
      <p role="status" className="mt-4 text-footnote text-label-secondary">
        {status}
      </p>
    </Dialog>
  );
}
