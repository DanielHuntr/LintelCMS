import { LogOut, Monitor } from "lucide-react";
import { describeFormError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useEndSession, useSessions, useSignOutOtherDevices } from "./account.queries.js";
import { AccountSection } from "./AccountSection.js";

/** Where you're signed in, and signing out of the others (say, a lost laptop). */
export function SessionsSection() {
  const sessions = useSessions();
  const endSession = useEndSession();
  const signOutOthers = useSignOutOtherDevices();
  const now = useNow();
  const others = sessions.data?.filter((session) => !session.current) ?? [];

  return (
    <AccountSection
      title={t("account.sessions.title")}
      description={t("account.sessions.description")}
    >
      {sessions.isError && (
        <LoadError error={sessions.error} onRetry={() => void sessions.refetch()} />
      )}
      {sessions.isPending && <Skeleton className="h-24 rounded-card" />}
      {sessions.data && (
        <GroupedList>
          {sessions.data.map((session) => (
            <GroupedListRow
              key={session.id}
              icon={Monitor}
              iconTone={session.current ? "success" : "neutral"}
              label={session.browser}
              description={t("account.sessions.lastUsed", {
                when: formatRelativeTime(session.lastUsedAt, now),
              })}
              accessory={
                session.current ? (
                  <Badge tone="success">{t("account.sessions.thisDevice")}</Badge>
                ) : (
                  <Button
                    variant="plain"
                    size="small"
                    aria-label={t("account.sessions.signOutOne", { browser: session.browser })}
                    icon={<LogOut aria-hidden="true" strokeWidth={2} />}
                    onClick={() => endSession.mutate(session.id)}
                  />
                )
              }
            />
          ))}
        </GroupedList>
      )}
      <div className="flex items-center justify-between gap-4">
        <p role="status" className="text-footnote text-label-secondary">
          {signOutOthers.isSuccess
            ? t("account.sessions.signedOutOthers")
            : signOutOthers.isError
              ? describeFormError(signOutOthers.error)
              : ""}
        </p>
        <Button
          variant="tinted"
          disabled={others.length === 0 || signOutOthers.isPending}
          onClick={() => signOutOthers.mutate()}
        >
          {t("account.sessions.signOutOthers")}
        </Button>
      </div>
    </AccountSection>
  );
}
