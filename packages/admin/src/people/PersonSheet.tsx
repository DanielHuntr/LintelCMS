import { useState } from "react";
import { describeFormError } from "../api/describeError.js";
import { formatDateTime } from "../content/relativeTime.js";
import { Avatar } from "../design/Avatar.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { Dialog } from "../design/Dialog.js";
import { SelectField } from "../design/SelectField.js";
import { t } from "../i18n/strings.js";
import { useCan, useSession } from "../session/SessionContext.js";
import { grantableRoles } from "./grantableRoles.js";
import type { Person, Role } from "./people.api.js";
import { useChangeRole, useSetActive } from "./people.queries.js";
import { RemovePersonDialog } from "./RemovePersonDialog.js";

interface PersonSheetProps {
  person: Person | null;
  people: Person[];
  roles: Role[];
  onClose: () => void;
}

/** One person's details: change their role, deactivate or reactivate them, or remove them. */
export function PersonSheet({ person, people, roles, onClose }: PersonSheetProps) {
  const session = useSession();
  const canUpdate = useCan("users:update");
  const canDelete = useCan("users:delete");
  const changeRole = useChangeRole();
  const setActive = useSetActive();
  const [chosenRoleId, setChosenRoleId] = useState<string | null>(null);
  const [isConfirmingDeactivate, setIsConfirmingDeactivate] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  if (!person) return null;
  const isYou = person.id === session.user.id;
  const currentRoleId = person.roles[0]?.id ?? "";
  const roleId = chosenRoleId ?? currentRoleId;
  // Their current role stays in the list, so it shows even when it can't be given out.
  const offered = grantableRoles(roles, session.permissions);
  const options = roles.filter(
    (role) => role.id === currentRoleId || offered.some((offer) => offer.id === role.id),
  );
  const error = changeRole.error ?? setActive.error;

  function close() {
    setChosenRoleId(null);
    changeRole.reset();
    setActive.reset();
    onClose();
  }

  return (
    <>
      <Dialog
        open
        onClose={close}
        title={person.name}
        description={person.email}
        footer={
          <Button variant="plain" onClick={close}>
            {t("common.done")}
          </Button>
        }
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar name={person.name} imageUrl={person.avatarUrl} size="large" />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-footnote">
              <dt className="text-label-secondary">{t("people.detail.joined")}</dt>
              <dd className="text-label">{formatDateTime(person.createdAt)}</dd>
              <dt className="text-label-secondary">{t("people.detail.lastActive")}</dt>
              <dd className="text-label">
                {person.lastActiveAt
                  ? formatDateTime(person.lastActiveAt)
                  : t("people.neverSignedIn")}
              </dd>
              <dt className="text-label-secondary">{t("people.detail.twoFactor")}</dt>
              <dd className="text-label">
                {person.twoFactorEnabled
                  ? t("people.detail.twoFactorOn")
                  : t("people.detail.twoFactorOff")}
              </dd>
            </dl>
          </div>

          {canUpdate && (
            <form
              className="flex items-end gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                changeRole.mutate(
                  { userId: person.id, roleId },
                  { onSuccess: () => setChosenRoleId(null) },
                );
              }}
            >
              <SelectField
                className="flex-1"
                label={t("people.detail.role")}
                options={options.map((role) => ({ value: role.id, label: role.name }))}
                value={roleId}
                onValueChange={setChosenRoleId}
                hint={roles.find((role) => role.id === roleId)?.description}
                data-autofocus
              />
              <Button
                type="submit"
                variant="tinted"
                disabled={roleId === currentRoleId || changeRole.isPending}
                className="mb-6"
              >
                {t("people.detail.changeRole")}
              </Button>
            </form>
          )}

          {error && (
            <p role="alert" className="text-footnote text-danger">
              {describeFormError(error)}
            </p>
          )}

          {!isYou && (canUpdate || canDelete) && (
            <div className="flex flex-wrap gap-2 pt-4 hairline-top">
              {canUpdate &&
                (person.status === "active" ? (
                  <Button variant="tinted" onClick={() => setIsConfirmingDeactivate(true)}>
                    {t("people.detail.deactivate")}
                  </Button>
                ) : (
                  <Button
                    variant="tinted"
                    disabled={setActive.isPending}
                    onClick={() => setActive.mutate({ userId: person.id, active: true })}
                  >
                    {t("people.detail.reactivate")}
                  </Button>
                ))}
              {canDelete && (
                <Button variant="destructive" onClick={() => setIsRemoving(true)}>
                  {t("people.detail.remove")}
                </Button>
              )}
            </div>
          )}
        </div>
      </Dialog>

      <ConfirmDialog
        open={isConfirmingDeactivate}
        title={t("people.deactivate.title", { name: person.name })}
        message={t("people.deactivate.message")}
        confirmLabel={t("people.deactivate.confirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={setActive.isPending}
        onCancel={() => setIsConfirmingDeactivate(false)}
        onConfirm={() =>
          setActive.mutate(
            { userId: person.id, active: false },
            { onSettled: () => setIsConfirmingDeactivate(false) },
          )
        }
      />
      <RemovePersonDialog
        open={isRemoving}
        person={person}
        people={people}
        onClose={() => setIsRemoving(false)}
        onRemoved={() => {
          setIsRemoving(false);
          close();
        }}
      />
    </>
  );
}
