import { LoadError } from "../api/LoadError.js";
import { BackLink } from "../design/BackLink.js";
import { Badge } from "../design/Badge.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Page } from "../design/Page.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import type { PersonalDataKind } from "./privacy.api.js";
import { usePersonalDataMap } from "./privacy.queries.js";

/**
 * Settings → Privacy → Where personal data is kept: each kind in a plain sentence, with the
 * technical detail (tables and columns) folded away for whoever looks after the site.
 */
export function PersonalDataMapPage() {
  const map = usePersonalDataMap();
  const kinds = map.data?.kinds ?? [];
  const inUse = kinds.filter((kind) => kind.inUse);
  const off = kinds.filter((kind) => !kind.inUse);

  return (
    <Page width="readable">
      <BackLink to="/settings/privacy">{t("privacy.title")}</BackLink>
      <LargeTitle title={t("privacy.map.title")} subtitle={t("privacy.map.subtitle")} />
      {map.isError && <LoadError error={map.error} onRetry={() => void map.refetch()} />}
      {map.isPending && (
        <LoadingRegion label={t("privacy.map.loading")}>
          <Skeleton className="h-64 rounded-card" />
        </LoadingRegion>
      )}
      {map.data && (
        <div className="flex flex-col gap-8">
          <KindGroup header={t("privacy.map.inUseHeader")} kinds={inUse} />
          {off.length > 0 && (
            <KindGroup
              header={t("privacy.map.offHeader")}
              footer={t("privacy.map.offFooter")}
              kinds={off}
            />
          )}
        </div>
      )}
    </Page>
  );
}

function KindGroup({
  header,
  footer,
  kinds,
}: {
  header: string;
  footer?: string;
  kinds: PersonalDataKind[];
}) {
  return (
    <section className="flex flex-col gap-1.5">
      <h2 className="px-4 text-footnote font-medium text-label-secondary">{header}</h2>
      <ul className="divide-y divide-separator overflow-hidden rounded-card bg-surface">
        {kinds.map((kind) => (
          <KindRow key={kind.id} kind={kind} />
        ))}
      </ul>
      {footer && <p className="px-4 text-footnote text-label-secondary">{footer}</p>}
    </section>
  );
}

function KindRow({ kind }: { kind: PersonalDataKind }) {
  const hasDetails = kind.tables.length > 0 || kind.erasure !== null;
  return (
    <li className="flex flex-col gap-1 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-body font-medium text-label">{kind.name}</h3>
        {kind.from !== "core" && <Badge>{t("privacy.map.addon")}</Badge>}
        {!kind.searchable && kind.notSearchableReason && kind.from !== "core" && (
          <Badge tone="warning">{t("privacy.map.notSearchable")}</Badge>
        )}
      </div>
      <p className="text-footnote text-label-secondary">{kind.description}</p>
      {kind.notSearchableReason && kind.from !== "core" && (
        <p className="text-footnote text-warning">{kind.notSearchableReason}</p>
      )}
      {hasDetails && (
        <details className="mt-1 text-footnote">
          <summary className="cursor-pointer text-accent">{t("privacy.map.details")}</summary>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-label-secondary">
            {kind.erasure && (
              <>
                <dt className="font-medium text-label">{t("privacy.map.whenErased")}</dt>
                <dd>{kind.erasure}</dd>
              </>
            )}
            {kind.tables.length > 0 && (
              <>
                <dt className="font-medium text-label">{t("privacy.map.where")}</dt>
                <dd className="flex flex-col gap-0.5">
                  {kind.tables.map((table) => (
                    <code key={table.name} className="break-all">
                      {table.name}: {table.columns.join(", ")}
                    </code>
                  ))}
                </dd>
              </>
            )}
          </dl>
        </details>
      )}
    </li>
  );
}
