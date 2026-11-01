import { Lock, Plus, ShieldHalf } from "lucide-react";
import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t, tCount } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import type { Role } from "./people.api.js";
import { useRoles } from "./people.queries.js";

/** /users/roles: Lintel's own roles, then the site's custom ones. */
export function RolesPage() {
  const roles = useRoles();
  const canManage = useCan("roles:update");

  const describe = (role: Role) =>
    [
      role.description,
      tCount({ one: "roles.memberCount.one", other: "roles.memberCount.other" }, role.memberCount),
      role.requiresTwoFactor ? t("roles.requiresTwoFactorShort") : undefined,
    ]
      .filter(Boolean)
      .join(" · ");

  const builtIn = roles.data?.filter((role) => role.isBuiltIn) ?? [];
  const custom = roles.data?.filter((role) => !role.isBuiltIn) ?? [];

  return (
    <>
      <BackLink to="/users">{t("people.title")}</BackLink>
      <LargeTitle
        title={t("roles.title")}
        subtitle={t("roles.subtitle")}
        actions={
          canManage && (
            <LinkButton
              to="/users/roles/$roleId"
              params={{ roleId: "new" }}
              icon={<Plus aria-hidden="true" strokeWidth={2.25} />}
            >
              {t("roles.new")}
            </LinkButton>
          )
        }
      />
      <div className="flex max-w-2xl flex-col gap-8">
        {roles.isError && <LoadError error={roles.error} onRetry={() => void roles.refetch()} />}
        {roles.isPending && (
          <LoadingRegion label={t("roles.loading")}>
            <Skeleton className="h-64 rounded-card" />
          </LoadingRegion>
        )}
        {roles.data && (
          <>
            <GroupedList header={t("roles.builtInHeader")} footer={t("roles.builtInFooter")}>
              {builtIn.map((role) => (
                <GroupedListRow
                  key={role.id}
                  icon={role.handle === "owner" ? Lock : ShieldHalf}
                  iconTone={role.handle === "owner" ? "warning" : "accent"}
                  label={role.name}
                  description={describe(role)}
                  wrapsText
                  to={`/users/roles/${role.id}`}
                />
              ))}
            </GroupedList>
            <GroupedList
              header={t("roles.customHeader")}
              footer={custom.length === 0 ? t("roles.customEmpty") : undefined}
            >
              {custom.map((role) => (
                <GroupedListRow
                  key={role.id}
                  icon={ShieldHalf}
                  iconTone="success"
                  label={role.name}
                  description={describe(role)}
                  wrapsText
                  to={`/users/roles/${role.id}`}
                />
              ))}
            </GroupedList>
          </>
        )}
      </div>
    </>
  );
}
