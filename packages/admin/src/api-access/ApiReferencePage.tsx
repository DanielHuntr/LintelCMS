import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { apiRequest, apiUrl } from "../api/client.js";
import { LoadError } from "../api/LoadError.js";
import { Badge } from "../design/Badge.js";
import { BackLink } from "../design/BackLink.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { LoadingRegion } from "../design/LoadingRegion.js";
import { Skeleton } from "../design/Skeleton.js";
import { t } from "../i18n/strings.js";
import {
  listOperations,
  type OpenApiDocument,
  type ReferenceOperation,
} from "./openApiReference.js";
import { Page } from "../design/Page.js";

/**
 * /settings/api/reference: the REST API's endpoints, read from the API's own OpenAPI
 * document, so this page is always as up to date as the server it talks to.
 */
export function ApiReferencePage() {
  const document = useQuery({
    queryKey: ["openapi"],
    queryFn: () => apiRequest<OpenApiDocument>("/openapi.json"),
    staleTime: Infinity,
  });
  const documentUrl = `${apiUrl}/openapi.json`;

  return (
    <Page width="readable">
      <BackLink to="/settings/api">{t("apiAccess.title")}</BackLink>
      <LargeTitle
        title={t("apiReference.title")}
        subtitle={t("apiReference.subtitle")}
        actions={
          <a
            href={documentUrl}
            download="openapi.json"
            className="inline-flex h-9 items-center gap-2 rounded-control bg-accent/12 px-4 text-body font-medium text-accent transition-colors duration-150 ease-standard hover:bg-accent/18 focus-visible:focus-ring"
          >
            <Download aria-hidden="true" strokeWidth={2} className="size-4" />
            {t("apiReference.download")}
          </a>
        }
      />

      {document.isError && (
        <LoadError error={document.error} onRetry={() => void document.refetch()} />
      )}
      {document.isPending && (
        <LoadingRegion label={t("apiReference.loading")}>
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-16 rounded-card" />
            ))}
          </div>
        </LoadingRegion>
      )}
      {document.data && (
        <div className="flex flex-col gap-10">
          <p className="text-body text-label-secondary">{document.data.info.description}</p>
          {groupByTag(listOperations(document.data)).map(([tag, operations]) => (
            <section key={tag} aria-labelledby={`tag-${tag}`} className="flex flex-col gap-3">
              <h2 id={`tag-${tag}`} className="text-title text-label">
                {tag}
              </h2>
              <ul className="flex flex-col gap-2">
                {operations.map((operation) => (
                  <li key={`${operation.method} ${operation.path}`}>
                    <OperationDetails operation={operation} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}

function OperationDetails({ operation }: { operation: ReferenceOperation }) {
  return (
    <details className="group rounded-card bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-card px-4 py-3 focus-visible:focus-ring">
        <Badge
          tone={
            operation.method === "GET"
              ? "accent"
              : operation.method === "DELETE"
                ? "danger"
                : "success"
          }
        >
          {operation.method}
        </Badge>
        <code className="font-mono text-footnote text-label">{operation.path}</code>
        <span className="ml-auto truncate text-footnote text-label-secondary">
          {operation.summary}
        </span>
      </summary>
      <div className="flex flex-col gap-3 px-4 pb-4 text-footnote text-label">
        {operation.description && <p className="text-label-secondary">{operation.description}</p>}
        <p>
          <span className="font-semibold">{t("apiReference.access")} </span>
          {operation.permission
            ? t("apiReference.needsPermission", { permission: operation.permission })
            : t("apiReference.public")}
        </p>
        {operation.parameters.length > 0 && (
          <table className="w-full text-left">
            <caption className="sr-only">{t("apiReference.parameters")}</caption>
            <thead className="text-label-secondary">
              <tr>
                <th scope="col" className="py-1 font-medium">
                  {t("apiReference.parameter")}
                </th>
                <th scope="col" className="py-1 font-medium">
                  {t("apiReference.where")}
                </th>
                <th scope="col" className="py-1 font-medium">
                  {t("apiReference.type")}
                </th>
              </tr>
            </thead>
            <tbody>
              {operation.parameters.map((parameter) => (
                <tr key={`${parameter.in} ${parameter.name}`} className="hairline-top">
                  <td className="py-1.5 font-mono">
                    {parameter.name}
                    {parameter.required && <span className="text-danger"> *</span>}
                  </td>
                  <td className="py-1.5 text-label-secondary">{parameter.in}</td>
                  <td className="py-1.5 text-label-secondary">{parameter.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="text-label-secondary">
          {t("apiReference.responses", { codes: operation.responseCodes.join(", ") })}
        </p>
      </div>
    </details>
  );
}

function groupByTag(operations: ReferenceOperation[]): [string, ReferenceOperation[]][] {
  const groups = new Map<string, ReferenceOperation[]>();
  for (const operation of operations) {
    groups.set(operation.tag, [...(groups.get(operation.tag) ?? []), operation]);
  }
  return [...groups];
}
