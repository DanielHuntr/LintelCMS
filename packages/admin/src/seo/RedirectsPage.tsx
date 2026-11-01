import { ArrowRight, ArrowRightLeft, Check, FileUp, Plus, Sparkles, Trash2, X } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { PluginBackLink } from "../plugins/PluginLink.js";
import { Button } from "../design/Button.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { useCan } from "../session/SessionContext.js";
import { AddRedirectDialog } from "./AddRedirectDialog.js";
import { ImportRedirectsDialog } from "./ImportRedirectsDialog.js";
import type { Redirect } from "./seo.api.js";
import { useAcceptRedirect, useDeleteRedirect, useRedirects } from "./seo.queries.js";

/**
 * /settings/seo/redirects: rules that send visitors from old addresses to new ones, and
 * the ones Lintel suggests when a live page's address changes.
 */
export function RedirectsPage() {
  const redirects = useRedirects();
  const accept = useAcceptRedirect();
  const remove = useDeleteRedirect();
  const canChange = useCan("settings:update");
  const [dialog, setDialog] = useState<"add" | "import" | null>(null);

  const suggested = redirects.data?.filter((redirect) => redirect.status === "suggested") ?? [];
  const active = redirects.data?.filter((redirect) => redirect.status === "active") ?? [];
  const actions = canChange && (
    <>
      <Button
        variant="tinted"
        icon={<FileUp aria-hidden="true" strokeWidth={2} className="size-4" />}
        onClick={() => setDialog("import")}
      >
        {t("redirects.import")}
      </Button>
      <Button icon={<Plus aria-hidden="true" />} onClick={() => setDialog("add")}>
        {t("redirects.add")}
      </Button>
    </>
  );

  return (
    <>
      <PluginBackLink to="/settings/seo">{t("seo.settingsTitle")}</PluginBackLink>
      <LargeTitle
        title={t("redirects.title")}
        subtitle={t("redirects.subtitle")}
        actions={actions}
      />

      {redirects.isError && (
        <LoadError error={redirects.error} onRetry={() => void redirects.refetch()} />
      )}
      {redirects.isPending && (
        <LoadingRegion label={t("redirects.loading")}>
          <Skeleton className="h-28 max-w-2xl rounded-card" />
        </LoadingRegion>
      )}
      {redirects.data && (
        <div className="flex max-w-2xl flex-col gap-8">
          {suggested.length > 0 && (
            <GroupedList
              header={t("redirects.suggestedHeader")}
              footer={t("redirects.suggestedFooter")}
            >
              {suggested.map((redirect) => (
                <GroupedListRow
                  key={redirect.id}
                  icon={Sparkles}
                  iconTone="warning"
                  label={describePaths(redirect)}
                  description={t("redirects.suggestedDescription")}
                  accessory={
                    canChange && (
                      <>
                        <Button
                          variant="tinted"
                          size="small"
                          icon={
                            <Check aria-hidden="true" strokeWidth={2.25} className="size-3.5" />
                          }
                          aria-label={t("redirects.acceptLabel", { path: redirect.fromPath })}
                          disabled={accept.isPending}
                          onClick={() => accept.mutate(redirect.id)}
                        >
                          {t("redirects.accept")}
                        </Button>
                        <Button
                          variant="plain"
                          size="small"
                          icon={<X aria-hidden="true" strokeWidth={2.25} className="size-3.5" />}
                          aria-label={t("redirects.dismissLabel", { path: redirect.fromPath })}
                          onClick={() => remove.mutate(redirect.id)}
                        >
                          {t("redirects.dismiss")}
                        </Button>
                      </>
                    )
                  }
                />
              ))}
            </GroupedList>
          )}

          {active.length === 0 ? (
            <div className="rounded-card bg-surface">
              <EmptyState
                icon={ArrowRightLeft}
                title={t("redirects.emptyTitle")}
                description={t("redirects.emptyDescription")}
              />
            </div>
          ) : (
            <GroupedList header={t("redirects.activeHeader")}>
              {active.map((redirect) => (
                <GroupedListRow
                  key={redirect.id}
                  icon={ArrowRight}
                  label={describePaths(redirect)}
                  description={
                    redirect.statusCode === 301
                      ? t("redirects.permanent")
                      : t("redirects.temporary")
                  }
                  accessory={
                    canChange && (
                      <Button
                        variant="plain"
                        size="small"
                        aria-label={t("redirects.deleteLabel", { path: redirect.fromPath })}
                        icon={<Trash2 aria-hidden="true" strokeWidth={2} className="size-3.5" />}
                        onClick={() => remove.mutate(redirect.id)}
                      />
                    )
                  }
                />
              ))}
            </GroupedList>
          )}
        </div>
      )}

      {dialog === "add" && <AddRedirectDialog onClose={() => setDialog(null)} />}
      {dialog === "import" && <ImportRedirectsDialog onClose={() => setDialog(null)} />}
    </>
  );
}

function describePaths(redirect: Redirect): string {
  return `${redirect.fromPath} → ${redirect.toPath}`;
}
