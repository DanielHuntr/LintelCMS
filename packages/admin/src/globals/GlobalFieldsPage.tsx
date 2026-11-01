import { LoadError } from "../api/LoadError.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { GlobalFieldsEditor } from "./GlobalFieldsEditor.js";
import { useGlobalSet } from "./globals.queries.js";
import { Page } from "../design/Page.js";

/** /content/globals/:handle/fields: loads the set, then hands over to the fields builder. */
export function GlobalFieldsPage(props: { handle: string }) {
  return (
    <Page width="readable">
      <LoadedGlobalFieldsPage {...props} />
    </Page>
  );
}

function LoadedGlobalFieldsPage({ handle }: { handle: string }) {
  const globalSet = useGlobalSet(handle, undefined);

  if (globalSet.isError) {
    return <LoadError error={globalSet.error} onRetry={() => void globalSet.refetch()} />;
  }
  if (!globalSet.data) {
    return (
      <LoadingRegion label={t("globals.loading")}>
        <Skeleton className="mb-8 h-10 w-56" />
        <Skeleton className="h-48 rounded-card" />
      </LoadingRegion>
    );
  }
  return <GlobalFieldsEditor globalSet={globalSet.data} />;
}
