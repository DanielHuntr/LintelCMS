import type { Permission } from "../roles/permissions.js";
import type { WebhookEventName } from "../webhooks/webhook-events.js";

/**
 * What an app can ask to do, in one visible list. Each scope is a few permissions, worded
 * for the person approving it, and no scope reaches settings, users or roles: those stay
 * with people signed in to the admin, as they do for API tokens.
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
] as const;

export type AppScope = (typeof appScopeNames)[number];

/**
 * The permissions behind each scope. The admin words each one for the person approving it
 * (`apps.scope.*` in its strings), so a new scope needs a sentence there too.
 */
interface ScopeDefinition {
  permissions: readonly Permission[];
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
};

/** The scope an app needs before it may be told about an event. */
const scopeForEvent: Readonly<Record<WebhookEventName, AppScope>> = {
  "entry.published": "read_content",
  "entry.unpublished": "read_content",
  "entry.deleted": "read_content",
  "asset.uploaded": "read_media",
  "asset.deleted": "read_media",
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
