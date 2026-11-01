import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { describeFormError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { TextField } from "../design/TextField.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import type { PermissionGroup, Role } from "./people.api.js";
import { useDeleteRole, usePermissionGroups, useRoles, useSaveRole } from "./people.queries.js";
import { PermissionEditor } from "./PermissionEditor.js";

/** /users/roles/$roleId, or /users/roles/new for a new custom role. */
export function RoleEditorPage({ roleId }: { roleId: string }) {
  const roles = useRoles();
  const groups = usePermissionGroups();
  const isNew = roleId === "new";
  const role = roles.data?.find((candidate) => candidate.id === roleId);

  if (roles.isError || groups.isError) {
    return <LoadError error={roles.error ?? groups.error} onRetry={() => void roles.refetch()} />;
  }
  if (!roles.data || !groups.data) {
    return (
      <LoadingRegion label={t("roles.loading")}>
        <Skeleton className="h-96 max-w-2xl rounded-card" />
      </LoadingRegion>
    );
  }
  if (!isNew && !role) {
    return <LoadError error={new Error("missing")} onRetry={() => void roles.refetch()} />;
  }
  return <RoleForm key={roleId} role={role ?? null} groups={groups.data} />;
}

function RoleForm({ role, groups }: { role: Role | null; groups: PermissionGroup[] }) {
  const navigate = useNavigate();
  const canManage = useCan("roles:update");
  const save = useSaveRole();
  const remove = useDeleteRole();
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? ["entries:read"]);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(role?.requiresTwoFactor ?? false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [saved, setSaved] = useState(false);
  const isBuiltIn = role?.isBuiltIn ?? false;
  const isOwner = role?.handle === "owner";

  async function submit() {
    setSaved(false);
    const changes = isBuiltIn
      ? { requiresTwoFactor }
      : { name, description, permissions, requiresTwoFactor };
    try {
      const result = await save.mutateAsync({ roleId: role?.id ?? null, changes });
      setSaved(true);
      if (!role) await navigate({ to: "/users/roles/$roleId", params: { roleId: result.id } });
    } catch {
      // Shown below the form.
    }
  }

  return (
    <>
      <BackLink to="/users/roles">{t("roles.title")}</BackLink>
      <LargeTitle
        title={role ? role.name : t("roles.newTitle")}
        subtitle={isBuiltIn ? t("roles.builtInSubtitle") : t("roles.customSubtitle")}
        actions={
          canManage && (
            <Button
              onClick={() => void submit()}
              disabled={save.isPending || (!isBuiltIn && name.trim() === "")}
            >
              {save.isPending ? t("roles.saving") : role ? t("roles.save") : t("roles.create")}
            </Button>
          )
        }
      />
      <div className="flex max-w-2xl flex-col gap-8">
        <p role="status" className="text-footnote empty:hidden">
          {save.isError ? (
            <span className="text-danger">{describeFormError(save.error)}</span>
          ) : saved ? (
            <span className="text-success">{t("roles.saved")}</span>
          ) : null}
        </p>

        {!isBuiltIn && (
          <div className="flex flex-col gap-5 rounded-card bg-surface p-5">
            <TextField
              label={t("roles.name")}
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={!canManage}
              maxLength={60}
              required
            />
            <TextField
              label={t("roles.description")}
              hint={t("roles.descriptionHint")}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              disabled={!canManage}
              maxLength={200}
            />
          </div>
        )}

        <GroupedList header={t("roles.securityHeader")} footer={t("roles.requiresTwoFactorFooter")}>
          <GroupedListRow
            label={t("roles.requiresTwoFactor")}
            accessory={
              <Toggle
                label={t("roles.requiresTwoFactor")}
                labelVisibility="hidden"
                checked={requiresTwoFactor}
                disabled={!canManage}
                onCheckedChange={setRequiresTwoFactor}
              />
            }
          />
        </GroupedList>

        {isOwner ? (
          <p className="rounded-card bg-surface p-5 text-body text-label-secondary">
            {t("roles.ownerExplanation")}
          </p>
        ) : (
          <section aria-labelledby="role-permissions-heading" className="flex flex-col gap-4">
            <h2 id="role-permissions-heading" className="px-4 text-headline text-label">
              {t("roles.permissionsHeader")}
            </h2>
            <PermissionEditor
              groups={groups}
              permissions={permissions}
              onChange={setPermissions}
              readOnly={isBuiltIn || !canManage}
            />
          </section>
        )}

        {role && !isBuiltIn && canManage && (
          <div>
            <Button variant="destructive" onClick={() => setIsConfirmingDelete(true)}>
              {t("roles.delete")}
            </Button>
            {remove.isError && (
              <p role="alert" className="mt-2 text-footnote text-danger">
                {describeFormError(remove.error)}
              </p>
            )}
          </div>
        )}
      </div>
      <ConfirmDialog
        open={isConfirmingDelete}
        title={t("roles.deleteTitle", { name: role?.name ?? "" })}
        message={t("roles.deleteMessage")}
        confirmLabel={t("roles.delete")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={remove.isPending}
        onCancel={() => setIsConfirmingDelete(false)}
        onConfirm={() => {
          if (!role) return;
          remove.mutate(role.id, {
            onSuccess: () => void navigate({ to: "/users/roles" }),
            onSettled: () => setIsConfirmingDelete(false),
          });
        }}
      />
    </>
  );
}
