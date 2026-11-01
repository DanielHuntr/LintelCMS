import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { describeError } from "../api/describeError.js";
import { LoadError } from "../api/LoadError.js";
import { t } from "../i18n/strings.js";
import { SiteChecklist } from "./SiteChecklist.js";
import { setRoleSiteAccess } from "./sites.api.js";
import { siteKeys, useRoleSiteAccess } from "./sites.queries.js";
import type { RoleSiteAccess, Site } from "./sites.types.js";

/** "Who works on which site": each role open to every site, or kept to some. Saved as you tick. */
export function RoleSitesSection({ sites }: { sites: readonly Site[] }) {
  const roles = useRoleSiteAccess();

  return (
    <section aria-labelledby="role-sites-heading" className="flex flex-col gap-2">
      <div className="px-1">
        <h2 id="role-sites-heading" className="text-headline text-label">
          {t("sites.access.title")}
        </h2>
        <p className="text-footnote text-label-secondary">{t("sites.access.description")}</p>
      </div>
      {roles.isError && <LoadError error={roles.error} onRetry={() => void roles.refetch()} />}
      <div className="flex flex-col divide-y divide-separator rounded-card bg-surface">
        {roles.data?.map((role) => (
          <RoleRow key={role.handle} role={role} sites={sites} />
        ))}
      </div>
    </section>
  );
}

function RoleRow({ role, sites }: { role: RoleSiteAccess; sites: readonly Site[] }) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | undefined>();
  const [isSaving, setIsSaving] = useState(false);

  async function save(siteHandles: string[] | null) {
    setIsSaving(true);
    setError(undefined);
    try {
      await setRoleSiteAccess(role.handle, siteHandles);
      await queryClient.invalidateQueries({ queryKey: siteKeys.roleAccess() });
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <p className="text-body font-medium text-label">{role.name}</p>
      <SiteChecklist
        legend={t("sites.access.legend", { name: role.name })}
        sites={sites}
        chosen={role.siteHandles}
        disabled={isSaving}
        onChange={(chosen) => void save(chosen)}
      />
      {error && (
        <p role="alert" className="text-footnote font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
