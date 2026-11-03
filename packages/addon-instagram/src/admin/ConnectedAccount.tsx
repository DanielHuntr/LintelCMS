import {
  Button,
  ConfirmDialog,
  formatRelativeTime,
  GroupedList,
  GroupedListRow,
  useCan,
} from "@lintel/admin/plugin";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import { useState } from "react";
import type { InstagramAccountSummary } from "../server/instagram.schema.js";
import { accountKey, disconnectAccount, postsKey, syncNow } from "./instagram.api.js";
import { PostGrid } from "./PostGrid.js";
import { t } from "./strings.js";

/** Connected: the account, when it last checked, a problem if there was one, and the posts. */
export function ConnectedAccount({ account }: { account: InstagramAccountSummary }) {
  const queryClient = useQueryClient();
  const canChange = useCan("settings:update");
  const [isConfirmingDisconnect, setConfirmingDisconnect] = useState(false);

  const sync = useMutation({
    mutationFn: syncNow,
    onSuccess: (updated) => {
      queryClient.setQueryData(accountKey, updated);
      void queryClient.invalidateQueries({ queryKey: postsKey });
    },
  });
  const disconnect = useMutation({
    mutationFn: disconnectAccount,
    onSuccess: () => {
      setConfirmingDisconnect(false);
      void queryClient.invalidateQueries({ queryKey: accountKey });
      queryClient.removeQueries({ queryKey: postsKey });
    },
  });

  const synced = account.lastSyncedAt
    ? t("account.syncedAgo", { when: formatRelativeTime(account.lastSyncedAt, Date.now()) })
    : t("account.notSynced");

  return (
    <>
      <GroupedList footer={t("account.everyHour")}>
        <GroupedListRow
          label={t("account.username", { username: account.username ?? "" })}
          description={synced}
          accessory={
            canChange ? (
              <Button
                variant="tinted"
                size="small"
                disabled={sync.isPending}
                onClick={() => sync.mutate()}
              >
                {sync.isPending ? t("account.syncing") : t("account.syncNow")}
              </Button>
            ) : undefined
          }
        />
        {account.lastError && (
          <GroupedListRow
            icon={AlertCircle}
            iconTone="warning"
            label={t("account.problem")}
            description={account.lastError}
            wrapsText
          />
        )}
        {account.tokenHint && (
          <GroupedListRow
            label={t("account.token")}
            detail={t("account.tokenDetail", { hint: account.tokenHint })}
          />
        )}
      </GroupedList>

      <PostGrid canDescribe={canChange} />

      {canChange && (
        <div>
          <Button variant="destructive" onClick={() => setConfirmingDisconnect(true)}>
            {t("account.disconnect")}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={isConfirmingDisconnect}
        title={t("disconnect.title")}
        message={t("disconnect.message")}
        confirmLabel={t("disconnect.confirm")}
        cancelLabel={t("disconnect.cancel")}
        isDestructive
        isWorking={disconnect.isPending}
        onConfirm={() => disconnect.mutate()}
        onCancel={() => setConfirmingDisconnect(false)}
      />
    </>
  );
}
