import { Check } from "lucide-react";
import { useState, type FormEvent } from "react";
import { describeFormError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { CopyButton } from "../design/CopyButton.js";
import { Dialog } from "../design/Dialog.js";
import { EmailField } from "../design/EmailField.js";
import { SelectField } from "../design/SelectField.js";
import { t } from "../i18n/strings.js";
import type { Role, SentInvitation } from "./people.api.js";
import { useInvitePerson } from "./people.queries.js";

interface InviteDialogProps {
  open: boolean;
  onClose: () => void;
  /** The roles the signed-in person may hand out. */
  roles: Role[];
  /** Set to show the "sent" step straight away, after a resend. */
  sent: SentInvitation | null;
  onSent: (sent: SentInvitation) => void;
}

/**
 * Inviting someone: their email and a role, then a confirmation with the link, which can
 * be passed on by hand while email isn't set up.
 */
export function InviteDialog({ open, onClose, roles, sent, onSent }: InviteDialogProps) {
  const [email, setEmail] = useState("");
  // Editor is the usual choice. Worked out on each render, as the roles may still be loading.
  const defaultRole = roles.find((role) => role.handle === "editor") ?? roles[0];
  const [chosenRoleId, setRoleId] = useState<string | null>(null);
  const roleId = chosenRoleId ?? defaultRole?.id ?? "";
  const invite = useInvitePerson();
  const chosenRole = roles.find((role) => role.id === roleId);

  function close() {
    setEmail("");
    invite.reset();
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      onSent(await invite.mutateAsync({ email: email.trim(), roleId }));
      setEmail("");
    } catch {
      // Shown under the email field.
    }
  }

  if (sent) {
    return (
      <Dialog
        open={open}
        onClose={close}
        title={t("people.invite.sentTitle")}
        description={t("people.invite.sentDescription", { email: sent.invitation.email })}
        footer={
          <Button onClick={close} data-autofocus>
            {t("common.done")}
          </Button>
        }
      >
        <div className="flex flex-col gap-3">
          <p className="flex items-start gap-2 text-footnote text-label-secondary">
            <Check
              aria-hidden="true"
              strokeWidth={2.5}
              className="mt-0.5 size-4 shrink-0 text-success"
            />
            {t("people.invite.linkHint")}
          </p>
          <div className="flex items-center gap-2 rounded-control bg-fill p-2 ps-3">
            <code
              aria-label={t("people.invite.linkLabel")}
              className="min-w-0 flex-1 font-mono text-footnote break-all text-label select-all"
            >
              {sent.invitationUrl}
            </code>
            <CopyButton value={sent.invitationUrl} label={t("people.invite.copyLink")} />
          </div>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={close}
      title={t("people.invite.title")}
      description={t("people.invite.description")}
      footer={
        <>
          <Button variant="plain" onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="invite-form" disabled={invite.isPending}>
            {invite.isPending ? t("people.invite.sending") : t("people.invite.send")}
          </Button>
        </>
      }
    >
      <form
        id="invite-form"
        onSubmit={(event) => void submit(event)}
        className="flex flex-col gap-5"
      >
        <EmailField
          label={t("people.invite.email")}
          value={email}
          onValueChange={setEmail}
          error={invite.isError ? describeFormError(invite.error) : undefined}
          autoComplete="off"
          required
          data-autofocus
        />
        <SelectField
          label={t("people.invite.role")}
          options={roles.map((role) => ({ value: role.id, label: role.name }))}
          value={roleId}
          onValueChange={setRoleId}
          hint={chosenRole?.description}
        />
      </form>
    </Dialog>
  );
}
