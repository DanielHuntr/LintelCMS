import { ScrollText, ShieldHalf, UserPlus, Users } from "lucide-react";
import { useDeferredValue, useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { useNow } from "../content/useNow.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
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
export function UsersPage() {
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
  const [isInviting, setIsInviting] = useState(false);
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
    <>
      <LargeTitle
        title={t("people.title")}
        subtitle={t("people.subtitle")}
        actions={
          <>
            {canSeeSecurityLog && (
              <LinkButton
                to="/users/activity"
                variant="tinted"
                icon={<ScrollText aria-hidden="true" strokeWidth={2} />}
              >
                {t("securityLog.title")}
              </LinkButton>
            )}
            <LinkButton
              to="/users/roles"
              variant="tinted"
              icon={<ShieldHalf aria-hidden="true" strokeWidth={2} />}
            >
              {t("roles.title")}
            </LinkButton>
            {inviteButton}
          </>
        }
      />
      <div className="flex max-w-3xl flex-col gap-8">
        <SearchField
          label={t("people.search")}
          value={search}
          onValueChange={setSearch}
          className="max-w-sm"
        />

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
          <GroupedList header={t("people.listHeader")}>
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
        {people.data?.length === 1 && search === "" && canInvite && (
          <p className="px-4 text-footnote text-label-secondary">{t("people.onlyYou")}</p>
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
    </>
  );
}
