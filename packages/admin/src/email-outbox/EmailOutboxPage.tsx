import { useQuery } from "@tanstack/react-query";
import { Inbox } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { formatDateTime } from "../content/relativeTime.js";
import { BackLink } from "../design/BackLink.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { getOutbox } from "./emailOutbox.api.js";

/**
 * Users → Security log → Emails sent: the emails Lintel would have sent, while no mail service is set
 * up. Links in invitations and password resets can be opened from here.
 */
export function EmailOutboxPage() {
  const outbox = useQuery({ queryKey: ["email-outbox"], queryFn: getOutbox });

  return (
    <>
      <BackLink to="/users">{t("people.title")}</BackLink>
      <LargeTitle
        title={t("emailOutbox.title")}
        subtitle={t("emailOutbox.subtitle")}
        actions={
          <Button variant="tinted" onClick={() => void outbox.refetch()}>
            {t("emailOutbox.refresh")}
          </Button>
        }
      />
      <div className="flex max-w-3xl flex-col gap-4">
        {outbox.isError && <LoadError error={outbox.error} onRetry={() => void outbox.refetch()} />}
        {outbox.isPending && (
          <LoadingRegion label={t("emailOutbox.loading")}>
            <Skeleton className="h-40 rounded-card" />
          </LoadingRegion>
        )}
        {outbox.data && !outbox.data.enabled && (
          <p className="rounded-card bg-surface p-5 text-body text-label-secondary">
            {t("emailOutbox.notInUse")}
          </p>
        )}
        {outbox.data?.enabled && outbox.data.messages.length === 0 && (
          <div className="rounded-card bg-surface">
            <EmptyState
              icon={Inbox}
              title={t("emailOutbox.emptyTitle")}
              description={t("emailOutbox.emptyDescription")}
            />
          </div>
        )}
        {outbox.data?.messages.map((message) => (
          <article key={message.id} className="rounded-card bg-surface p-5">
            <header className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-headline text-label">{message.subject}</h2>
              <p className="text-footnote text-label-secondary">{formatDateTime(message.sentAt)}</p>
            </header>
            <p className="mt-1 text-footnote text-label-secondary">
              {t("emailOutbox.to", { email: message.to })}
            </p>
            <div className="mt-4 text-body break-words whitespace-pre-wrap text-label">
              {linkify(message.text)}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}

/** Makes the links in a plain-text email clickable. */
function linkify(text: string) {
  return text.split(/(https?:\/\/\S+)/g).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a key={index} href={part} className="text-accent underline focus-visible:focus-ring">
        {part}
      </a>
    ) : (
      part
    ),
  );
}
