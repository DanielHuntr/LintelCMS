import { AppWindow } from "lucide-react";
import { useMemo } from "react";
import { PanelSection } from "../content/PanelSection.js";
import { BackLink } from "../design/BackLink.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { t } from "../i18n/strings.js";
import type {
  AdminPluginDefinition,
  DashboardWidget,
  EditorPanel,
  EditorPanelProps,
  WidgetProps,
} from "../plugins/adminPlugin.js";
import type { AppExtensions } from "./apps.api.js";
import { AppFrame } from "./AppFrame.js";

/**
 * Installed apps take part in the admin through the same extension points as plugins: each
 * app becomes an admin plugin definition whose sidebar item, screens, Settings row, widgets
 * and editor panels draw the app's pages in frames. Apps are on while they are installed,
 * so they are kept in their own list rather than in `enabledPlugins` (see
 * `InstalledAppsContext`).
 */
export function appAsAdminPlugin(app: AppExtensions): AdminPluginDefinition {
  const { page, settingsPage, dashboardWidgets, editorPanels } = app.admin;
  const pagePath = `/apps/${app.handle}`;
  const settingsPath = `/apps/${app.handle}/settings`;

  return {
    // The dashboard stores widgets as "<plugin id>:<widget id>", so this must be a plain id.
    id: `app-${app.handle}`,
    sidebarItems: page ? [{ path: pagePath, label: page.label, icon: AppWindow }] : [],
    screens: [
      ...(page
        ? [
            {
              path: pagePath,
              component: function AppPage() {
                return (
                  <>
                    <LargeTitle title={page.label} subtitle={app.name} />
                    <AppFrame
                      app={app}
                      url={page.url}
                      extension="page"
                      title={t("apps.frame.title", { app: app.name, part: page.label })}
                      initialHeight={560}
                    />
                  </>
                );
              },
            },
          ]
        : []),
      ...(settingsPage
        ? [
            {
              path: settingsPath,
              permission: "settings:read" as const,
              component: function AppSettingsPage() {
                return (
                  <>
                    <BackLink to="/settings">{t("nav.settings")}</BackLink>
                    <LargeTitle title={app.name} subtitle={t("apps.settingsPageSubtitle")} />
                    <AppFrame
                      app={app}
                      url={settingsPage.url}
                      extension="settings"
                      title={t("apps.frame.title", { app: app.name, part: t("nav.settings") })}
                      initialHeight={480}
                    />
                  </>
                );
              },
            },
          ]
        : []),
    ],
    settingsRows: settingsPage
      ? [
          {
            group: t("apps.settingsGroup"),
            label: app.name,
            description: t("apps.settingsRowDescription"),
            icon: AppWindow,
            to: settingsPath,
            permission: "settings:read",
          },
        ]
      : [],
    dashboardWidgets: dashboardWidgets.map((widget): DashboardWidget => ({
      id: widget.id,
      title: widget.title,
      description: widget.description,
      icon: AppWindow,
      defaultSize: widget.size,
      component: function AppWidget({ size }: WidgetProps) {
        return (
          <AppFrame
            app={app}
            url={widget.url}
            extension="widget"
            extensionId={widget.id}
            widgetSize={size}
            title={t("apps.frame.title", { app: app.name, part: widget.title })}
            initialHeight={180}
          />
        );
      },
    })),
    editorPanels: editorPanels.map((panel): EditorPanel => ({
      id: panel.id,
      component: function AppEditorPanel(props: EditorPanelProps) {
        const { entryId, slug, entryTitle } = props;
        const collection = props.collection.handle;
        const entry = useMemo(
          () => ({ id: entryId ?? null, collection, slug, title: entryTitle }),
          [entryId, collection, slug, entryTitle],
        );
        if (panel.collections && !panel.collections.includes(collection)) {
          return null;
        }
        return (
          <PanelSection title={panel.title}>
            <AppFrame
              app={app}
              url={panel.url}
              extension="panel"
              extensionId={panel.id}
              entry={entry}
              title={t("apps.frame.title", { app: app.name, part: panel.title })}
              initialHeight={160}
            />
          </PanelSection>
        );
      },
    })),
  };
}
