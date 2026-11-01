import { MailPlus, RotateCw, X } from "lucide-react";
import { useState } from "react";
import { describeFormError } from "../api/describeError.js";
import { formatRelativeTime } from "../content/relativeTime.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { t } from "../i18n/strings.js";
import type { Invitation, SentInvitation } from "./people.api.js";
import { useResendInvitation, useRevokeInvitation } from "./people.queries.js";

interface InvitationListProps {
  invitations: Invitation[];
  canInvite: boolean;
  now: number;
  onResent: (sent: SentInvitation) => void;
}

/** Invitations nobody has accepted yet, with resend and cancel. */
export function InvitationList({ invitations, canInvite, now, onResent }: InvitationListProps) {
  const resend = useResendInvitation();
  const revoke = useRevokeInvitation();
  const [cancelling, setCancelling] = useState<Invitation | null>(null);

  if (invitations.length === 0) return null;

  function describe(invitation: Invitation): string {
    const expiry = invitation.expired
      ? t("people.invitation.expired")
      : t("people.invitation.expires", { when: formatRelativeTime(invitation.expiresAt, now) });
    return `${invitation.role.name} · ${expiry}`;
  }

  return (
    <>
      <GroupedList header={t("people.invitationsHeader")} footer={t("people.invitationsFooter")}>
        {invitations.map((invitation) => (
          <GroupedListRow
            key={invitation.id}
            icon={MailPlus}
            iconTone={invitation.expired ? "neutral" : "accent"}
            label={invitation.email}
            description={describe(invitation)}
            accessory={
              <span className="flex items-center gap-1">
                {invitation.expired && (
                  <Badge tone="warning">{t("people.invitation.expiredBadge")}</Badge>
                )}
                {canInvite && (
                  <>
                    <Button
                      variant="plain"
                      size="small"
                      icon={<RotateCw aria-hidden="true" strokeWidth={2} />}
                      aria-label={t("people.invitation.resendLabel", { email: invitation.email })}
                      disabled={resend.isPending}
                      onClick={() => resend.mutate(invitation.id, { onSuccess: onResent })}
                    >
                      {t("people.invitation.resend")}
                    </Button>
                    <Button
                      variant="plain"
                      size="small"
                      aria-label={t("people.invitation.cancelLabel", { email: invitation.email })}
                      icon={<X aria-hidden="true" strokeWidth={2} />}
                      onClick={() => setCancelling(invitation)}
                    />
                  </>
                )}
              </span>
            }
          />
        ))}
      </GroupedList>
      {resend.isError && (
        <p role="alert" className="px-4 text-footnote text-danger">
          {describeFormError(resend.error)}
        </p>
      )}
      <ConfirmDialog
        open={cancelling !== null}
        title={t("people.invitation.cancelTitle", { email: cancelling?.email ?? "" })}
        message={t("people.invitation.cancelMessage")}
        confirmLabel={t("people.invitation.cancelConfirm")}
        cancelLabel={t("people.invitation.keep")}
        isDestructive
        isWorking={revoke.isPending}
        onCancel={() => setCancelling(null)}
        onConfirm={() => {
          if (!cancelling) return;
          revoke.mutate(cancelling.id, { onSuccess: () => setCancelling(null) });
        }}
      />
    </>
  );
}
