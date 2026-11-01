import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { LoadError } from "../api/LoadError.js";
import { formatRelativeTime } from "../content/relativeTime.js";
import { useNow } from "../content/useNow.js";
import { Button } from "../design/Button.js";
import { ConfirmDialog } from "../design/ConfirmDialog.js";
import { EmptyState } from "../design/EmptyState.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import type { ApiToken } from "./apiAccess.api.js";
import { useApiTokens, useDeleteApiToken } from "./apiAccess.queries.js";
import { CreateTokenDialog } from "./CreateTokenDialog.js";

interface TokenListProps {
  canChange: boolean;
}

/** The API tokens, with a way to make one and to delete them. */
export function TokenList({ canChange }: TokenListProps) {
  const tokens = useApiTokens();
  const deleteToken = useDeleteApiToken();
  const [isCreating, setIsCreating] = useState(false);
  const [deleting, setDeleting] = useState<ApiToken | null>(null);
  const now = useNow();

  const newButton = canChange && (
    <Button
      variant="tinted"
      size="small"
      icon={<Plus aria-hidden="true" strokeWidth={2.25} className="size-3.5" />}
      onClick={() => setIsCreating(true)}
    >
      {t("apiAccess.newToken")}
    </Button>
  );

  function describeToken(token: ApiToken): string {
    const access =
      token.access === "read" ? t("apiAccess.access.read") : t("apiAccess.access.readWrite");
    const used = token.lastUsedAt
      ? t("apiAccess.lastUsed", { when: formatRelativeTime(token.lastUsedAt, now) })
      : t("apiAccess.neverUsed");
    return `${access} · ${used}`;
  }

  return (
    <section aria-labelledby="api-tokens-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-4">
        <h2 id="api-tokens-heading" className="text-headline text-label">
          {t("apiAccess.tokensHeader")}
        </h2>
        {tokens.data && tokens.data.length > 0 && newButton}
      </div>

      {tokens.isError && <LoadError error={tokens.error} onRetry={() => void tokens.refetch()} />}
      {tokens.isPending && (
        <LoadingRegion label={t("apiAccess.loadingTokens")}>
          <Skeleton className="h-14 rounded-card" />
        </LoadingRegion>
      )}
      {tokens.data?.length === 0 && (
        <div className="rounded-card bg-surface">
          <EmptyState
            icon={KeyRound}
            title={t("apiAccess.noTokensTitle")}
            description={t("apiAccess.noTokensDescription")}
            action={newButton}
          />
        </div>
      )}
      {tokens.data && tokens.data.length > 0 && (
        <GroupedList footer={t("apiAccess.tokensFooter")}>
          {tokens.data.map((token) => (
            <GroupedListRow
              key={token.id}
              icon={KeyRound}
              iconTone={token.access === "read" ? "neutral" : "warning"}
              label={token.name}
              description={describeToken(token)}
              detail={`${token.tokenStart}…`}
              accessory={
                canChange && (
                  <Button
                    variant="plain"
                    size="small"
                    aria-label={t("apiAccess.deleteToken", { name: token.name })}
                    icon={<Trash2 aria-hidden="true" strokeWidth={2} className="size-3.5" />}
                    onClick={() => setDeleting(token)}
                  />
                )
              }
            />
          ))}
        </GroupedList>
      )}

      <CreateTokenDialog open={isCreating} onClose={() => setIsCreating(false)} />
      <ConfirmDialog
        open={deleting !== null}
        title={t("apiAccess.deleteTitle", { name: deleting?.name ?? "" })}
        message={t("apiAccess.deleteMessage")}
        confirmLabel={t("apiAccess.deleteConfirm")}
        cancelLabel={t("common.cancel")}
        isDestructive
        isWorking={deleteToken.isPending}
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (!deleting) return;
          deleteToken.mutate(deleting.id, { onSuccess: () => setDeleting(null) });
        }}
      />
    </section>
  );
}
