import { Mail } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Dialog } from "../design/Dialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { formatOrderTime } from "./orderDates.js";
import { useOutboxEmail, useOutboxEmails } from "./shopSettings.queries.js";

/**
 * /commerce/settings/emails: the order emails the shop has written. With the outbox (the
 * default) they're kept here instead of being sent, so they can be checked while building.
 */
export function EmailOutboxPage() {
  const emails = useOutboxEmails();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      <BackLink to="/commerce/settings">{t("shop.settings.title")}</BackLink>
      <LargeTitle title={t("shop.emails.title")} subtitle={t("shop.emails.subtitle")} />
      {emails.isError && <LoadError error={emails.error} onRetry={() => void emails.refetch()} />}
      {emails.isPending && (
        <LoadingRegion label={t("shop.emails.loading")}>
          <Skeleton className="h-28 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {emails.data && (
        <div className="flex max-w-2xl flex-col gap-6">
          {!emails.data.provider.deliversEmail && (
            <p role="note" className="rounded-card bg-warning/10 px-4 py-3 text-body text-label">
              {t("shop.emails.outboxNote")}
            </p>
          )}
          {emails.data.total === 0 ? (
            <div className="rounded-card bg-surface">
              <EmptyState
                size="page"
                icon={Mail}
                title={t("shop.emails.emptyTitle")}
                description={t("shop.emails.emptyDescription")}
              />
            </div>
          ) : (
            <GroupedList>
              {emails.data.items.map((email) => (
                <GroupedListRow
                  key={email.id}
                  icon={Mail}
                  iconTone="neutral"
                  label={email.subject}
                  description={`${email.to} · ${formatOrderTime(email.createdAt)}`}
                  onSelect={() => setOpenId(email.id)}
                />
              ))}
            </GroupedList>
          )}
        </div>
      )}
      {openId && <EmailPreview emailId={openId} onClose={() => setOpenId(null)} />}
    </>
  );
}

function EmailPreview({ emailId, onClose }: { emailId: string; onClose: () => void }) {
  const email = useOutboxEmail(emailId);
  return (
    <Dialog
      open
      onClose={onClose}
      title={email.data?.subject ?? t("shop.emails.loading")}
      description={email.data ? t("shop.emails.sentTo", { to: email.data.to }) : undefined}
    >
      {email.data && (
        // The email's own HTML, shown in a sandbox with no scripts, as a mail app would. Emails
        // are written for a white page, so the preview stays white in dark mode too.
        <iframe
          title={t("shop.emails.previewTitle")}
          sandbox=""
          srcDoc={email.data.html}
          style={{ background: "#ffffff", colorScheme: "light" }}
          className="h-[60vh] w-full rounded-control"
        />
      )}
    </Dialog>
  );
}
