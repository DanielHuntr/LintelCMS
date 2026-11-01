import type { Permission } from "@lintel/core/permissions";
import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "../design/Card.js";
import { EmptyState } from "../design/EmptyState.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LinkButton } from "../design/LinkButton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "./SessionContext.js";

/**
 * Shows a screen only to people with `permission`. Anyone else who reaches it by its address
 * is told plainly that it isn't for them, instead of seeing a screen whose every part fails
 * to load. The API checks again; this is about clarity, not security.
 */
export function RequirePermission({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  return useCan(permission) ? children : <NoAccessPage />;
}

function NoAccessPage() {
  return (
    <>
      <LargeTitle title={t("noAccess.title")} />
      <Card>
        <EmptyState
          size="page"
          icon={Lock}
          title={t("noAccess.title")}
          description={t("noAccess.description")}
          action={<LinkButton to="/">{t("noAccess.dashboard")}</LinkButton>}
        />
      </Card>
    </>
  );
}
