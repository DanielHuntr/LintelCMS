import { CircleCheck, ChevronRight, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { formatDateTime } from "../i18n/formatting.js";
import { type StringKey, t } from "../i18n/strings.js";
import { formatFileSize } from "../media/formatting.js";
import type { Addon, AddonDetails } from "./addons.api.js";

/**
 * What an add-on keeps and does, in folded sections with what it stores first: each item
 * marked "Checked by Lintel" when Lintel found it for itself, or "Says the add-on" when
 * only the add-on's own description says so.
 */
export function AddonAbout({ addon, details }: { addon: Addon; details: AddonDetails }) {
  return (
    <div className="flex flex-col gap-2">
      <StoresSection details={details} />
      <AddsSection addon={addon} details={details} />
      <RunsSection details={details} />
      <TalksSection details={details} />
      <OriginSection details={details} />
    </div>
  );
}

/** A section that opens on a press; `open` only for the first. */
export function Fold({
  title,
  summary,
  open = false,
  children,
}: {
  title: string;
  summary?: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details open={open} className="group rounded-card bg-fill/60">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-card px-3 py-2.5 focus-visible:focus-ring">
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-label-secondary transition-transform group-open:rotate-90 motion-reduce:transition-none"
        />
        <span className="text-headline text-label">{title}</span>
        {summary && (
          <span className="ms-auto truncate text-footnote text-label-secondary">{summary}</span>
        )}
      </summary>
      <div className="flex flex-col gap-3 px-3 pt-1 pb-3">{children}</div>
    </details>
  );
}

/** Where an item's word comes from. */
function Source({ checked }: { checked: boolean }) {
  return checked ? (
    <span className="inline-flex shrink-0 items-center gap-1 text-caption text-label-secondary">
      <CircleCheck aria-hidden="true" className="size-3.5 text-success" />
      {t("addons.checked")}
    </span>
  ) : (
    <span className="shrink-0 text-caption text-label-tertiary">{t("addons.says")}</span>
  );
}

function Item({
  title,
  checked,
  children,
}: {
  title: ReactNode;
  checked: boolean;
  children?: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-0.5 py-2 not-first:hairline-top">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="min-w-0 text-body text-label">{title}</span>
        <Source checked={checked} />
      </div>
      {children}
    </li>
  );
}

function Note({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "warning" }) {
  return tone === "warning" ? (
    <p className="flex items-start gap-2 rounded-control bg-warning/14 p-3 text-footnote text-label">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
      <span>{children}</span>
    </p>
  ) : (
    <p className="text-footnote text-label-secondary">{children}</p>
  );
}

function sizeOf(rows: number | null, bytes: number | null): string {
  if (rows === null) return t("addons.stores.missing");
  return bytes === null
    ? t("addons.stores.rows", { rows })
    : t("addons.stores.size", { rows, size: formatFileSize(bytes) });
}

function StoresSection({ details }: { details: AddonDetails }) {
  const { tables, undeclared, settings } = details.stores;
  const rows = tables.reduce((total, table) => total + (table.rows ?? 0), 0);
  return (
    <Fold
      title={t("addons.stores")}
      summary={tables.length > 0 ? t("addons.stores.rows", { rows }) : undefined}
      open
    >
      {tables.length === 0 ? (
        <Note>{t("addons.stores.nothing")}</Note>
      ) : (
        <ul>
          {tables.map((table) => (
            <Item
              key={table.name}
              checked={table.checked}
              title={<span className="font-mono text-footnote">{table.name}</span>}
            >
              <p className="text-footnote text-label">{table.purpose}</p>
              <p
                className={`text-caption ${table.checked ? "text-label-secondary" : "text-warning"}`}
              >
                {sizeOf(table.rows, table.bytes)}
              </p>
              {table.columns.length > 0 && (
                <ul className="mt-1 flex flex-col gap-1">
                  {table.columns.map((column) => (
                    <li key={column.name} className="text-caption text-label-secondary">
                      <span className="font-mono text-label">{column.name}</span> {column.purpose}
                      {column.personalData && (
                        <span className="ms-1.5 rounded-full bg-accent/14 px-1.5 py-px font-semibold text-accent">
                          {t("addons.stores.personal")}
                        </span>
                      )}
                      {!column.checked && table.checked && (
                        <span className="ms-1.5 text-warning">
                          ({t("addons.stores.columnMissing")})
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Item>
          ))}
        </ul>
      )}
      {undeclared.length > 0 && (
        <Note tone="warning">
          {t("addons.stores.undeclared", {
            names: undeclared
              .map((table) => `${table.name} (${sizeOf(table.rows, table.bytes)})`)
              .join(", "),
          })}
        </Note>
      )}
      {settings && <Note>{t("addons.stores.settings")}</Note>}
    </Fold>
  );
}

function AddsSection({ addon, details }: { addon: Addon; details: AddonDetails }) {
  const { publicRoutes, otherRoutes, blocks } = details.website;
  // Settings, tables and jobs have places of their own here.
  const parts = addon.adds.filter(
    (part) => !["settings", "tables", "jobs", "events", "routes", "blocks"].includes(part),
  );
  return (
    <Fold title={t("addons.website")}>
      {parts.length > 0 && (
        <ul className="list-disc ps-5 text-body text-label">
          {parts.map((part) => (
            <li key={part}>{t(`addons.part.${part}` as StringKey)}</li>
          ))}
        </ul>
      )}
      {blocks.length > 0 && <Note>{t("addons.website.blocks", { names: blocks.join(", ") })}</Note>}
      <div>
        <h4 className="text-footnote font-semibold text-label-secondary">
          {t("addons.website.public")}
        </h4>
        {publicRoutes.length === 0 ? (
          <Note>{t("addons.website.publicNone")}</Note>
        ) : (
          <ul>
            {publicRoutes.map((route) => (
              <Item
                key={`${route.method} ${route.path}`}
                checked={route.checked}
                title={
                  <span className="font-mono text-footnote">
                    {route.method} {route.path}
                  </span>
                }
              >
                <p className="text-footnote text-label-secondary">
                  {route.purpose}
                  {!route.checked && (
                    <span className="ms-1.5 text-warning">({t("addons.website.notFound")})</span>
                  )}
                </p>
              </Item>
            ))}
          </ul>
        )}
      </div>
      {otherRoutes > 0 && <Note>{t("addons.website.otherRoutes", { count: otherRoutes })}</Note>}
    </Fold>
  );
}

function interval(minutes: number): string {
  if (minutes % (60 * 24) === 0) return t("addons.runs.days", { count: minutes / (60 * 24) });
  if (minutes % 60 === 0) return t("addons.runs.hours", { count: minutes / 60 });
  return t("addons.runs.minutes", { count: minutes });
}

function RunsSection({ details }: { details: AddonDetails }) {
  const { jobs, events } = details.runs;
  return (
    <Fold title={t("addons.runs")}>
      {jobs.length === 0 && events.length === 0 && <Note>{t("addons.runs.nothing")}</Note>}
      {(jobs.length > 0 || events.length > 0) && (
        <ul>
          {jobs.map((job) => (
            <Item key={job.id} checked={job.checked} title={job.purpose ?? job.name}>
              <p className="text-caption text-label-secondary">
                {[
                  job.everyMinutes !== null &&
                    t("addons.runs.every", { interval: interval(job.everyMinutes) }),
                  !job.checked
                    ? t("addons.runs.notRegistered")
                    : job.lastRunAt
                      ? t("addons.runs.lastRun", { when: formatDateTime(job.lastRunAt) })
                      : t("addons.runs.notYet"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {job.lastError && (
                <p className="text-caption text-danger">
                  {t("addons.runs.lastError", { message: job.lastError })}
                </p>
              )}
            </Item>
          ))}
          {events.map((event) => (
            <Item
              key={event.event}
              checked={event.checked}
              title={event.purpose ?? t("addons.runs.event", { event: event.event })}
            >
              <p className="text-caption text-label-secondary">
                {t("addons.runs.event", { event: event.event })}
                {!event.checked && ` · ${t("addons.runs.notRegistered")}`}
              </p>
            </Item>
          ))}
        </ul>
      )}
    </Fold>
  );
}

function TalksSection({ details }: { details: AddonDetails }) {
  const { hosts, consentServices, consentFromSettings } = details.talksTo;
  return (
    <Fold title={t("addons.talks")}>
      {hosts.length === 0 ? (
        <Note>{t("addons.talks.nobody")}</Note>
      ) : (
        <ul>
          {hosts.map((host) => (
            <Item
              key={host.host}
              checked={false}
              title={<span className="font-mono text-footnote">{host.host}</span>}
            >
              <p className="text-footnote text-label-secondary">{host.purpose}</p>
            </Item>
          ))}
        </ul>
      )}
      {consentServices.length > 0 && (
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <Note>{t("addons.talks.consent", { names: consentServices.join(", ") })}</Note>
          <Source checked />
        </div>
      )}
      {consentFromSettings && <Note>{t("addons.talks.consentFromSettings")}</Note>}
    </Fold>
  );
}

function OriginSection({ details }: { details: AddonDetails }) {
  const { origin } = details;
  const rows: Array<[StringKey, ReactNode, boolean]> = [
    ["addons.origin.version", origin.version, false],
    ["addons.origin.publisher", origin.publisher, false],
    ["addons.origin.licence", origin.licence, false],
    [
      "addons.origin.source",
      origin.source && (
        <a href={origin.source} target="_blank" rel="noreferrer" className="text-accent">
          {origin.source.replace(/^https?:\/\//, "")}
        </a>
      ),
      false,
    ],
    ["addons.origin.integrity", origin.integrity, true],
    ["addons.origin.fingerprint", origin.fingerprint, true],
  ];
  return (
    <Fold title={t("addons.origin")} summary={origin.version ?? undefined}>
      <dl className="flex flex-col">
        {rows.map(([label, value, checked]) => (
          <div
            key={label}
            className="flex flex-col gap-0.5 py-2 not-first:hairline-top sm:flex-row sm:items-baseline sm:gap-3"
          >
            <dt className="w-36 shrink-0 text-footnote text-label-secondary">{t(label)}</dt>
            <dd className="min-w-0 flex-1 text-footnote break-all text-label">
              {value || <span className="text-label-tertiary">{t("addons.origin.unknown")}</span>}
            </dd>
            {value ? <Source checked={checked} /> : null}
          </div>
        ))}
      </dl>
    </Fold>
  );
}
