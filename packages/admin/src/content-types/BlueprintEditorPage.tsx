import { LoadError } from "../api/LoadError.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import { PreviewAddressSettings } from "../preview/PreviewAddressSettings.js";
import { BlueprintEditor } from "./BlueprintEditor.js";
import { ContentTypePlacement } from "./ContentTypePlacement.js";
import { useBlueprint } from "./blueprints.queries.js";
import { Page } from "../design/Page.js";

/** /settings/content-types/:handle: loads the blueprint, then shows the builder. */
export function BlueprintEditorPage(props: { handle: string }) {
  return (
    <Page width="readable">
      <LoadedBlueprintEditorPage {...props} />
    </Page>
  );
}

function LoadedBlueprintEditorPage({ handle }: { handle: string }) {
  const blueprint = useBlueprint(handle);

  if (blueprint.isError) {
    return <LoadError error={blueprint.error} onRetry={() => void blueprint.refetch()} />;
  }

  if (!blueprint.data) {
    return (
      <LoadingRegion label={t("builder.loading")}>
        <Skeleton className="mb-3 h-5 w-32" />
        <Skeleton className="mb-10 h-10 w-56" />
        <Skeleton className="mb-8 h-24 rounded-card" />
        <Skeleton className="h-72 rounded-card" />
      </LoadingRegion>
    );
  }

  return (
    <>
      <BlueprintEditor key={blueprint.data.handle} blueprint={blueprint.data} />
      <ContentTypePlacement blueprint={blueprint.data} />
      <PreviewAddressSettings blueprintHandle={blueprint.data.handle} />
    </>
  );
}
