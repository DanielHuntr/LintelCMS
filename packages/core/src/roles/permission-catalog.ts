import type { LintelPlugin } from "../plugins/plugin-definition.js";
import type { Permission } from "./permissions.js";

/**
 * Every permission Lintel knows, grouped by area and described in plain words, for the
 * role editor. People choose from "Publish anyone's content", never "entries:publish".
 *
 * Plugin permissions come from each plugin's `definePlugin` (built in or installed), which
 * the plugin catalogue registers here when the server starts (see src/plugins). A plugin's
 * group appears when it is switched on, without this file changing.
 */
export interface CatalogPermission {
  permission: `${string}:${string}`;
  name: string;
  description: string;
}

export interface PermissionGroup {
  id: string;
  name: string;
  description: string;
  /** Set for groups that come from a plugin. */
  pluginId?: string;
  permissions: CatalogPermission[];
}

export const corePermissionGroups: readonly PermissionGroup[] = [
  {
    id: "content",
    name: "Content",
    description: "Pages, posts and every other entry.",
    permissions: [
      { permission: "entries:read", name: "See content", description: "Including drafts." },
      { permission: "entries:create", name: "Create content", description: "Start new drafts." },
      {
        permission: "entries:update-own",
        name: "Edit their own content",
        description: "Only what they created.",
      },
      {
        permission: "entries:update",
        name: "Edit anyone's content",
        description: "Including other people's drafts and live pages.",
      },
      {
        permission: "entries:publish-own",
        name: "Publish their own content",
        description: "Put what they created on the site, or take it down.",
      },
      {
        permission: "entries:publish",
        name: "Publish anyone's content",
        description: "Put any entry on the site, take it down, or schedule it.",
      },
      {
        permission: "entries:delete-own",
        name: "Delete their own content",
        description: "Only what they created.",
      },
      { permission: "entries:delete", name: "Delete anyone's content", description: "" },
    ],
  },
  {
    id: "media",
    name: "Media",
    description: "Images, documents and other files.",
    permissions: [
      { permission: "media:read", name: "See media", description: "Browse and pick files." },
      { permission: "media:upload", name: "Upload files", description: "" },
      {
        permission: "media:update",
        name: "Edit file details",
        description: "Alt text, focal points and names.",
      },
      { permission: "media:delete", name: "Delete files", description: "" },
    ],
  },
  {
    id: "site-content",
    name: "Menus, tags and site-wide content",
    description: "Navigation menus, categories and tags, and content shared across pages.",
    permissions: [
      { permission: "navigation:read", name: "See menus", description: "" },
      { permission: "navigation:update", name: "Change menus", description: "" },
      { permission: "taxonomies:read", name: "See categories and tags", description: "" },
      {
        permission: "terms:update",
        name: "Add and change tags",
        description: "The terms inside each list.",
      },
      {
        permission: "taxonomies:update",
        name: "Create and change tag lists",
        description: "Such as a new Categories list.",
      },
      { permission: "globals:read", name: "See site-wide content", description: "" },
      {
        permission: "globals:update",
        name: "Change site-wide content",
        description: "Such as the footer or contact details.",
      },
    ],
  },
  {
    id: "content-model",
    name: "Content types",
    description: "The kinds of content the site has, and their fields.",
    permissions: [
      { permission: "collections:read", name: "See collections", description: "" },
      { permission: "collections:update", name: "Change collections", description: "" },
      { permission: "blueprints:read", name: "See fields", description: "" },
      {
        permission: "blueprints:update",
        name: "Change fields",
        description: "Add, remove and rearrange fields.",
      },
    ],
  },
  {
    id: "page-designs",
    name: "Page designs",
    description: "Pages laid out in the visual page builder.",
    permissions: [
      {
        permission: "builder:code",
        name: "Write code in page designs",
        description: "Code blocks and Developer mode. Anyone who can edit a page can design it.",
      },
    ],
  },
  {
    id: "people",
    name: "People",
    description: "Who can sign in, and what they can do.",
    permissions: [
      { permission: "users:read", name: "See people", description: "The Users screen." },
      {
        permission: "users:invite",
        name: "Invite people",
        description: "Send invitations, and resend or cancel them.",
      },
      {
        permission: "users:update",
        name: "Manage people",
        description: "Change roles, and deactivate or reactivate accounts.",
      },
      {
        permission: "users:delete",
        name: "Remove people",
        description: "Their content moves to someone else.",
      },
      {
        permission: "roles:update",
        name: "Manage roles",
        description: "Create roles and choose what they can do.",
      },
    ],
  },
  {
    id: "settings",
    name: "Settings",
    description: "How the site is set up.",
    permissions: [
      { permission: "settings:read", name: "See settings", description: "" },
      {
        permission: "settings:update",
        name: "Change settings",
        description: "Including API tokens, webhooks and plugins.",
      },
      {
        permission: "security:read",
        name: "See the security log",
        description: "Sign-ins, failures and account changes.",
      },
      { permission: "backups:read", name: "See backups", description: "" },
      {
        permission: "backups:manage",
        name: "Make and restore backups",
        description: "Restoring replaces everything on the site with the backup.",
      },
      {
        permission: "updates:read",
        name: "See updates",
        description: "New versions of Lintel and its plugins. Only owners can install them.",
      },
      {
        permission: "content:transfer",
        name: "Export and import content",
        description: "Including importing from WordPress.",
      },
    ],
  },
];

/** Plugins with permissions, by id, as the plugin catalogue registered them. */
const pluginPermissionGroups = new Map<string, PermissionGroup>();

/**
 * Called by the plugin catalogue for every plugin it knows. Registering a plugin again
 * replaces what it registered before.
 */
export function registerPluginPermissions(plugin: LintelPlugin): void {
  const permissions = plugin.permissions ?? [];
  if (permissions.length === 0) {
    pluginPermissionGroups.delete(plugin.id);
    return;
  }
  pluginPermissionGroups.set(plugin.id, {
    id: `plugin-${plugin.id}`,
    name: plugin.name,
    description: plugin.description,
    pluginId: plugin.id,
    permissions: permissions.map(({ permission, name, description }) =>
      name ? { permission, name, description } : { permission, name: description, description: "" },
    ),
  });
}

/** The core groups, plus a group for each switched-on plugin that has permissions. */
export function permissionGroups(enabledPluginIds: readonly string[]): PermissionGroup[] {
  const pluginGroups = [...pluginPermissionGroups.values()].filter((group) =>
    enabledPluginIds.includes(group.pluginId ?? ""),
  );
  return [...corePermissionGroups, ...pluginGroups];
}

/** Every permission a custom role may hold: those in the catalog, from any plugin. */
export function isKnownPermission(permission: string): permission is Permission {
  const all = [
    ...corePermissionGroups.flatMap((group) => group.permissions),
    ...[...pluginPermissionGroups.values()].flatMap((group) => group.permissions),
  ];
  return all.some((known) => known.permission === permission);
}
