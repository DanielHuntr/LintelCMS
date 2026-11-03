import type { Permission } from "../roles/permissions.js";
import type { WebhookEventName } from "../webhooks/webhook-events.js";

/**
 * What an app can ask to do, in one visible list. Each scope is a few permissions, worded
 * for the person approving it, and no scope reaches settings, users or roles: those stay
 * with people signed in to the admin, as they do for API tokens. No scope includes
 * `builder:design` either, so an app changes content, never a page's design.
 *
 * The names follow "<action>_<thing>" so they read well in a manifest, and so they can't
 * be mistaken for Lintel's own "area:action" permissions.
 */
export const appScopeNames = [
  "read_content",
  "write_content",
  "publish_content",
  "read_media",
  "write_media",
  "read_forms",
  "read_orders",
  "write_orders",
] as const;

export type AppScope = (typeof appScopeNames)[number];

/**
 * The permissions behind each scope, and the feature (plugin) it needs switched on. The
 * admin words each one for the person approving it (`apps.scope.*` in its strings), so a
 * new scope needs a sentence there too.
 */
interface ScopeDefinition {
  permissions: readonly Permission[];
  /** An app asking for this scope can only be installed while this plugin is on. */
  plugin?: string;
}

export const appScopes: Readonly<Record<AppScope, ScopeDefinition>> = {
  read_content: {
    permissions: [
      "entries:read",
      "blueprints:read",
      "collections:read",
      "taxonomies:read",
      "globals:read",
      "navigation:read",
    ],
  },
  write_content: {
    permissions: ["entries:create", "entries:update", "entries:delete"],
  },
  publish_content: {
    permissions: ["entries:publish"],
  },
  read_media: {
    permissions: ["media:read"],
  },
  write_media: {
    permissions: ["media:upload", "media:update", "media:delete"],
  },
  // Forms and the entries people send through them. Not changing or deleting either.
  read_forms: {
    permissions: ["forms:read"],
    plugin: "forms",
  },
  // Orders only (see src/commerce/orders): not products, prices, payments or shop settings.
  read_orders: {
    permissions: ["commerce:read-orders"],
    plugin: "commerce",
  },
  // Marking orders as sent and adding notes. Refunds and cancelling move money, so they
  // stay with people (`commerce:refund`).
  write_orders: {
    permissions: ["commerce:handle-orders"],
    plugin: "commerce",
  },
};

/** The scope an app needs before it may be told about an event. */
const scopeForEvent: Readonly<Record<WebhookEventName, AppScope>> = {
  "entry.published": "read_content",
  "entry.unpublished": "read_content",
  "entry.deleted": "read_content",
  "asset.uploaded": "read_media",
  "asset.deleted": "read_media",
  "form.submitted": "read_forms",
};

export function scopeNeededForEvent(event: WebhookEventName): AppScope {
  return scopeForEvent[event];
}

export function isAppScope(name: string): name is AppScope {
  return (appScopeNames as readonly string[]).includes(name);
}

/** Every permission the scopes add up to, without repeats. */
export function permissionsForScopes(scopes: readonly AppScope[]): Permission[] {
  return [...new Set(scopes.flatMap((scope) => appScopes[scope].permissions))];
}

/** The plugins these scopes need that aren't switched on, without repeats. */
export function pluginsMissingForScopes(
  scopes: readonly AppScope[],
  enabledPlugins: readonly string[],
): string[] {
  const needed = scopes.flatMap((scope) => appScopes[scope].plugin ?? []);
  return [...new Set(needed)].filter((plugin) => !enabledPlugins.includes(plugin));
}
