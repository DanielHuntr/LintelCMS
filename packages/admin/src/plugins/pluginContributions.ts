import { hasPermission, type Permission } from "@lintel/core/permissions";
import type {
  AdminPluginDefinition,
  DashboardTab,
  DashboardWidget,
  EditorPanel,
  FieldEditorContribution,
  PluginScreen,
  SettingsRow,
  SidebarItem,
} from "./adminPlugin.js";

/** Who is looking: what they may do and which plugins are on. */
export interface Viewer {
  permissions: readonly string[];
  enabledPlugins: readonly string[];
}

/** A contribution with the id of the plugin it came from. */
export type FromPlugin<Contribution> = Contribution & { pluginId: string };

export type ContributionKind =
  | "sidebarItems"
  | "screens"
  | "settingsRows"
  | "dashboardWidgets"
  | "dashboardTabs"
  | "editorPanels";

export interface Contributions {
  sidebarItems: SidebarItem;
  screens: PluginScreen;
  settingsRows: SettingsRow;
  dashboardWidgets: DashboardWidget;
  dashboardTabs: DashboardTab;
  editorPanels: EditorPanel;
}

/**
 * One kind of contribution from every plugin the viewer may see: the plugin is switched
 * on, and they have the permission the contribution names (if any). In plugin order.
 */
export function visibleContributions<Kind extends ContributionKind>(
  plugins: readonly AdminPluginDefinition[],
  kind: Kind,
  viewer: Viewer,
): Array<FromPlugin<Contributions[Kind]>> {
  return plugins
    .filter((plugin) => viewer.enabledPlugins.includes(plugin.id))
    .flatMap((plugin) => {
      // TypeScript can't follow `kind` from the list to the item type, so it is spelled out.
      const contributions = (plugin[kind] ?? []) as ReadonlyArray<Contributions[Kind]>;
      return contributions.map((contribution) => ({ ...contribution, pluginId: plugin.id }));
    })
    .filter((contribution) => mayUse(viewer.permissions, contribution.permission));
}

export function mayUse(granted: readonly string[], permission: Permission | undefined): boolean {
  return permission === undefined || hasPermission(granted, permission);
}

/**
 * The editor for a plugin's fieldtype. Not limited to switched-on plugins: content that
 * already uses a field should stay editable, as the server keeps accepting it.
 */
export function findPluginFieldEditor(
  plugins: readonly AdminPluginDefinition[],
  type: string,
): FieldEditorContribution | undefined {
  return plugins
    .flatMap((plugin) => plugin.fieldEditors ?? [])
    .find((editor) => editor.type === type);
}
