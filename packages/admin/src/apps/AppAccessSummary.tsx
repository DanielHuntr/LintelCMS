import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Check,
  LayoutGrid,
  PanelRight,
  Settings,
  ShieldCheck,
  SquareMenu,
} from "lucide-react";
import type { ReactNode } from "react";
import { t, type StringKey } from "../i18n/strings.js";
import type { AppManifest, AppScope } from "./apps.api.js";

type EventName = AppManifest["webhooks"][number]["event"];

/** What each scope lets an app do, finishing "This app will be able to…". */
const scopeWords: Record<AppScope, StringKey> = {
  read_content: "apps.scope.read_content",
  write_content: "apps.scope.write_content",
  publish_content: "apps.scope.publish_content",
  read_media: "apps.scope.read_media",
  write_media: "apps.scope.write_media",
  read_forms: "apps.scope.read_forms",
  read_orders: "apps.scope.read_orders",
  write_orders: "apps.scope.write_orders",
};

const eventWords: Record<EventName, StringKey> = {
  "entry.published": "apps.event.entryPublished",
  "entry.unpublished": "apps.event.entryUnpublished",
  "entry.deleted": "apps.event.entryDeleted",
  "asset.uploaded": "apps.event.assetUploaded",
  "asset.deleted": "apps.event.assetDeleted",
  "form.submitted": "apps.event.formSubmitted",
};

const pageRoleNames = {
  owner: "apps.role.owner",
  admin: "apps.role.admin",
  editor: "apps.role.editor",
  author: "apps.role.author",
  "client-content-only": "apps.role.client",
  viewer: "apps.role.viewer",
} as const;

/** Who a page shows for: the Owner always, so they aren't named twice. */
function pageSummary({ label, roles }: NonNullable<AppManifest["admin"]["page"]>): string {
  if (!roles) return t("apps.adds.page", { label });
  const others = roles.filter((role) => role !== "owner");
  const names = [t(pageRoleNames.owner), ...others.map((role) => t(pageRoleNames[role]))];
  return t("apps.adds.pageFor", { label, roles: names.join(", ") });
}

/**
 * Everything an app asks for, in plain English: what it may read and change, what it is
 * told about, and what it adds to the admin. Shown before installing and on the app's page,
 * so the person approving it and anyone checking later read the same words.
 */
export function AppAccessSummary({ manifest }: { manifest: AppManifest }) {
  const events = [...new Set(manifest.webhooks.map((webhook) => webhook.event))];
  const { page, dashboardWidgets, editorPanels, settingsPage } = manifest.admin;
  const parts = [
    ...(page ? [{ icon: SquareMenu, text: pageSummary(page) }] : []),
    ...dashboardWidgets.map((widget) => ({
      icon: LayoutGrid,
      text: t("apps.adds.widget", { title: widget.title }),
    })),
    ...editorPanels.map((panel) => ({
      icon: PanelRight,
      text: panel.collections
        ? t("apps.adds.panelFor", { title: panel.title, collections: panel.collections.join(", ") })
        : t("apps.adds.panel", { title: panel.title }),
    })),
    ...(settingsPage ? [{ icon: Settings, text: t("apps.adds.settings") }] : []),
  ];

  return (
    <div className="flex flex-col gap-5">
      <Group title={t("apps.access.scopesTitle")}>
        {manifest.scopes.length === 0 ? (
          <Item icon={ShieldCheck} text={t("apps.access.noScopes")} />
        ) : (
          manifest.scopes.map((scope) => (
            <Item key={scope} icon={Check} text={t(scopeWords[scope])} />
          ))
        )}
      </Group>
      {events.length > 0 && (
        <Group title={t("apps.access.eventsTitle")}>
          {events.map((event) => (
            <Item key={event} icon={Bell} text={t(eventWords[event])} />
          ))}
        </Group>
      )}
      {parts.length > 0 && (
        <Group title={t("apps.access.addsTitle")}>
          {parts.map((part) => (
            <Item key={part.text} icon={part.icon} text={part.text} />
          ))}
        </Group>
      )}
      <p className="flex items-start gap-2 text-footnote text-label-secondary">
        <ShieldCheck
          aria-hidden="true"
          strokeWidth={2}
          className="mt-0.5 size-4 shrink-0 text-success"
        />
        {t("apps.access.never")}
      </p>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-footnote font-semibold text-label-secondary">{title}</h3>
      <ul className="flex flex-col gap-1.5">{children}</ul>
    </section>
  );
}

function Item({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <li className="flex items-start gap-2.5 text-body text-label">
      <Icon aria-hidden="true" strokeWidth={2} className="mt-0.5 size-4 shrink-0 text-accent" />
      <span>{text}</span>
    </li>
  );
}
