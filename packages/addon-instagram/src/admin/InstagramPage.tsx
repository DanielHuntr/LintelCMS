import { LargeTitle, LoadError, LoadingRegion, Skeleton } from "@lintel/admin/plugin";
import { useQuery } from "@tanstack/react-query";
import { ConnectedAccount } from "./ConnectedAccount.js";
import { ConnectInstagram } from "./ConnectInstagram.js";
import { accountKey, readAccount } from "./instagram.api.js";
import { t } from "./strings.js";

/** /instagram: connect an account, or see what the website shows and when it last checked. */
export function InstagramPage() {
  const account = useQuery({ queryKey: accountKey, queryFn: readAccount });

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-6">
      <LargeTitle title={t("instagram.title")} subtitle={t("instagram.subtitle")} />
      {account.isError && (
        <LoadError error={account.error} onRetry={() => void account.refetch()} />
      )}
      {account.isPending && (
        <LoadingRegion label={t("instagram.loading")}>
          <Skeleton className="h-64" />
        </LoadingRegion>
      )}
      {account.data &&
        (account.data.connected ? (
          <ConnectedAccount account={account.data} />
        ) : (
          <ConnectInstagram />
        ))}
    </div>
  );
}
