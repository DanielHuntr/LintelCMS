import type { AdminPluginDefinition, DashboardWidget } from "../plugins/adminPlugin.js";
import { mayUse, type Viewer, visibleContributions } from "../plugins/pluginContributions.js";
import type { PlaceableWidget } from "./dashboardLayout.js";
import { builtInWidgets } from "./widgets/builtInWidgets.js";

/** A widget someone may put on their dashboard, with its full id. */
export type AvailableWidget = DashboardWidget & PlaceableWidget & { pluginId: string };

/**
 * Every widget this person may use: Lintel's own (those they have the permission for),
 * then those of switched-on plugins. A widget that isn't here is hidden from them.
 */
export function availableWidgets(
  plugins: readonly AdminPluginDefinition[],
  viewer: Viewer,
): AvailableWidget[] {
  const own = builtInWidgets
    .filter((widget) => mayUse(viewer.permissions, widget.permission))
    .map((widget) => ({ ...widget, pluginId: "core" }));
  const fromPlugins = visibleContributions(plugins, "dashboardWidgets", viewer);
  return [...own, ...fromPlugins].map((widget) => ({
    ...widget,
    fullId: `${widget.pluginId}:${widget.id}`,
    onDefaultDashboard: widget.onDefaultDashboard ?? false,
  }));
}
