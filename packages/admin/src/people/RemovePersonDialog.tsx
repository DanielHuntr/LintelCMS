import { useState } from "react";
import { describeFormError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { Dialog } from "../design/Dialog.js";
import { SelectField } from "../design/SelectField.js";
import { t } from "../i18n/strings.js";
import { useSession } from "../session/SessionContext.js";
import type { Person } from "./people.api.js";
import { useRemovePerson } from "./people.queries.js";

interface RemovePersonDialogProps {
  open: boolean;
  person: Person;
  people: Person[];
  onClose: () => void;
  onRemoved: () => void;
}

/**
 * Removing someone asks who gets their content first, so every page keeps an author.
 * It suggests the person doing the removing, since they are the one who'll know.
 */
export function RemovePersonDialog({
  open,
  person,
  people,
  onClose,
  onRemoved,
}: RemovePersonDialogProps) {
  const session = useSession();
  const remove = useRemovePerson();
  const candidates = people.filter((other) => other.id !== person.id && other.status === "active");
  const [reassignTo, setReassignTo] = useState(
    candidates.find((other) => other.id === session.user.id)?.id ?? candidates[0]?.id ?? "",
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("people.remove.title", { name: person.name })}
      description={t("people.remove.description")}
      footer={
        <>
          <Button variant="tinted" onClick={onClose} disabled={remove.isPending}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending || reassignTo === ""}
            onClick={() =>
              remove.mutate(
                { userId: person.id, reassignToUserId: reassignTo },
                { onSuccess: onRemoved },
              )
            }
          >
            {t("people.remove.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <SelectField
          label={t("people.remove.reassignLabel")}
          hint={t("people.remove.reassignHint")}
          options={candidates.map((other) => ({
            value: other.id,
            label: `${other.name} (${other.email})`,
          }))}
          value={reassignTo}
          onValueChange={setReassignTo}
          data-autofocus
        />
        {remove.isError && (
          <p role="alert" className="text-footnote text-danger">
            {describeFormError(remove.error)}
          </p>
        )}
      </div>
    </Dialog>
  );
}
