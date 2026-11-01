import type { Permission } from "@lintel/core/permissions";
import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { FieldEditorProps } from "../fields/fieldEditorProps.js";
import type { FieldLabelling } from "../fields/FieldShell.js";
import type { Field } from "../fields/field.types.js";

/**
 * The admin half of a plugin: what it adds to the admin's screens. Its `id` is the same as
 * the plugin's `definePlugin` id on the server, and nothing here shows while that plugin is
 * switched off. Every contribution can also name a permission; people without it don't
 * see it at all.
 *
 * Labels are plain text: a plugin brings its own words (see `createTranslator`).
 */

/** Something only some people should see. */
interface Restricted {
  permission?: Permission;
}

/** A link in the main sidebar, shown after Lintel's own content sections. */
export interface SidebarItem extends Restricted {
  path: string;
  label: string;
  icon: LucideIcon;
}

/** What a plugin screen is given: the values of `$name` parts of its path. */
export interface PluginScreenProps {
  params: Readonly<Record<string, string>>;
}

/**
 * A screen at an address. `$name` in the path matches one part of an address and is handed
 * to the screen as `params.name`: "/bookings/$bookingId".
 */
export interface PluginScreen extends Restricted {
  path: string;
  component: ComponentType<PluginScreenProps>;
}

/** A row on the Settings screen, in a group with its own header. */
export interface SettingsRow extends Restricted {
  group: string;
  label: string;
  description: string;
  icon: LucideIcon;
  to: string;
}

export type WidgetSize = "small" | "medium" | "large";

/** What a widget is given: its size, so it can show more when it has room. */
export interface WidgetProps {
  size: WidgetSize;
}

/** A card people can put on their home dashboard. */
export interface DashboardWidget extends Restricted {
  /** Unique within the plugin; the full id is "<plugin id>:<id>". */
  id: string;
  title: string;
  /** One sentence for the widget gallery. */
  description: string;
  icon: LucideIcon;
  component: ComponentType<WidgetProps>;
  defaultSize: WidgetSize;
  /** Whether new dashboards start with it. Defaults to false. */
  onDefaultDashboard?: boolean;
}

/**
 * A tab on a section's landing screen: "/" is the home dashboard, "/content" the content
 * overview. The section's own screen is always the first tab.
 */
export interface DashboardTab extends Restricted {
  section: string;
  /** Unique within the plugin. */
  id: string;
  label: string;
  component: ComponentType;
}

/** The entry being edited, as an editor panel sees it. */
export interface EditorPanelProps {
  /** Undefined until the entry has been saved for the first time. */
  entryId: string | undefined;
  /** As they are on screen, so a panel can follow typing. */
  entryTitle: string;
  slug: string;
  collection: { handle: string; name: string; routePattern: string | null };
}

/** A section in the entry editor's side panel, above the history. */
export interface EditorPanel extends Restricted {
  id: string;
  component: ComponentType<EditorPanelProps>;
}

/** The editor for one of the plugin's fieldtypes (its `type` matches the server's). */
export interface FieldEditorContribution {
  type: string;
  Editor: ComponentType<FieldEditorProps>;
  /** How the field's label sits: above the control, beside it, or as a group's legend. */
  labelling?: (field: Field) => FieldLabelling;
}

export interface AdminPluginDefinition {
  id: string;
  sidebarItems?: readonly SidebarItem[];
  screens?: readonly PluginScreen[];
  settingsRows?: readonly SettingsRow[];
  dashboardWidgets?: readonly DashboardWidget[];
  dashboardTabs?: readonly DashboardTab[];
  editorPanels?: readonly EditorPanel[];
  fieldEditors?: readonly FieldEditorContribution[];
}

/** Defines the admin half of a plugin. Returns what it is given, checked by TypeScript. */
export function defineAdminPlugin(definition: AdminPluginDefinition): AdminPluginDefinition {
  return definition;
}
