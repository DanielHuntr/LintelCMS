import { ScrollText, ShieldHalf, UserPlus, Users } from "lucide-react";
import { useDeferredValue, useEffect, useRef, useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { useNow } from "../content/useNow.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { SearchField } from "../design/SearchField.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan, useSession } from "../session/SessionContext.js";
import { grantableRoles } from "./grantableRoles.js";
import { InvitationList } from "./InvitationList.js";
import { InviteDialog } from "./InviteDialog.js";
import type { SentInvitation } from "./people.api.js";
import { useInvitations, usePeople, useRoles } from "./people.queries.js";
import { PersonRow } from "./PersonRow.js";
import { PersonSheet } from "./PersonSheet.js";

/**
 * /users: everyone who can sign in, the invitations still waiting, and a way to invite
 * someone new. Selecting a person opens their details.
 */
export function UsersPage({
  startInviting = false,
  onInvitingStarted,
}: {
  /** Opens the invitation straight away, as "Invite someone" in the command palette asks. */
  startInviting?: boolean;
  /** Called once it has, so the address can forget the request. */
  onInvitingStarted?: () => void;
} = {}) {
  const canSeeSecurityLog = useCan("security:read");
  const session = useSession();
  const canInvite = useCan("users:invite");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const people = usePeople(deferredSearch);
  const everyone = usePeople("");
  const invitations = useInvitations();
  const roles = useRoles();
  const now = useNow();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(startInviting && canInvite);
  // Once, on arrival: the address is cleared, so a reload doesn't ask again.
  const hasStartedInviting = useRef(false);
  useEffect(() => {
    if (!startInviting || hasStartedInviting.current) return;
    hasStartedInviting.current = true;
    onInvitingStarted?.();
  }, [startInviting, onInvitingStarted]);
  const [sent, setSent] = useState<SentInvitation | null>(null);

  const offeredRoles = grantableRoles(roles.data ?? [], session.permissions);
  const selected = everyone.data?.find((person) => person.id === selectedId) ?? null;

  const inviteButton = canInvite && (
    <Button
      icon={<UserPlus aria-hidden="true" strokeWidth={2} />}
      onClick={() => {
        setSent(null);
        setIsInviting(true);
      }}
      disabled={offeredRoles.length === 0}
    >
      {t("people.inviteButton")}
    </Button>
  );

  return (
    // One column, so the title, its button and the lists line up, as in iOS.
    <Page width="readable">
      <LargeTitle
        title={t("people.title")}
        subtitle={t("people.subtitle")}
        actions={inviteButton}
      />
      <div className="flex flex-col gap-8">
        <SearchField label={t("people.search")} value={search} onValueChange={setSearch} />

        {invitations.data && search === "" && (
          <InvitationList
            invitations={invitations.data}
            canInvite={canInvite}
            now={now}
            onResent={(resent) => {
              setSent(resent);
              setIsInviting(true);
            }}
          />
        )}

        {people.isError && <LoadError error={people.error} onRetry={() => void people.refetch()} />}
        {people.isPending && (
          <LoadingRegion label={t("people.loading")}>
            <Skeleton className="h-40 rounded-card" />
          </LoadingRegion>
        )}
        {people.data?.length === 0 && (
          <div className="rounded-card bg-surface">
            <EmptyState
              icon={Users}
              title={t("people.noMatchesTitle", { search })}
              description={t("people.noMatchesDescription")}
            />
          </div>
        )}
        {people.data && people.data.length > 0 && (
          <GroupedList
            header={t("people.listHeader")}
            footer={
              people.data.length === 1 && search === "" && canInvite
                ? t("people.onlyYou")
                : undefined
            }
          >
            {people.data.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                isYou={person.id === session.user.id}
                now={now}
                onSelect={() => setSelectedId(person.id)}
              />
            ))}
          </GroupedList>
        )}
        {search === "" && (
          <GroupedList header={t("people.accessHeader")}>
            <GroupedListRow
              icon={ShieldHalf}
              label={t("roles.title")}
              description={t("people.rolesRow")}
              to="/users/roles"
            />
            {canSeeSecurityLog && (
              <GroupedListRow
                icon={ScrollText}
                iconTone="neutral"
                label={t("securityLog.title")}
                description={t("people.securityLogRow")}
                to="/users/activity"
              />
            )}
          </GroupedList>
        )}
      </div>

      <InviteDialog
        open={isInviting}
        roles={offeredRoles}
        sent={sent}
        onSent={setSent}
        onClose={() => {
          setIsInviting(false);
          setSent(null);
        }}
      />
      {selected && roles.data && (
        <PersonSheet
          person={selected}
          people={everyone.data ?? []}
          roles={roles.data}
          onClose={() => setSelectedId(null)}
        />
      )}
    </Page>
  );
}
