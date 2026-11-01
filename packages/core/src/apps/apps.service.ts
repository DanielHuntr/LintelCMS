import type { AuthenticatedApiToken } from "../api-tokens/api-tokens.service.js";
import type { SignedIn } from "../auth/auth.schema.js";
import type { Database, DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { hasPermission } from "../roles/permissions.js";
import { findPermissionsForUser } from "../roles/roles.service.js";
import { findUserById } from "../users/users.repository.js";
import {
  checkWebhookAddress,
  type SenderOptions,
  WebhookSendError,
} from "../webhooks/webhook-sender.js";
import type { WebhookEventName } from "../webhooks/webhook-events.js";
import { insertWebhook } from "../webhooks/webhooks.repository.js";
import {
  generateClientId,
  generateClientSecret,
  hashClientSecret,
  visibleStartOfSecret,
} from "./app-credentials.js";
import type { AppManifest } from "./app-manifest.schema.js";
import { checkAppManifest, fetchAppManifest } from "./app-manifest-reader.js";
import { permissionsForScopes } from "./app-scopes.js";
import { signSessionToken } from "./app-session-tokens.js";
import {
  AppAlreadyInstalledError,
  AppNotFoundError,
  AppOriginNotAllowedError,
  AppScopesChangedError,
  AppWebhookAddressError,
} from "./apps.errors.js";
import {
  type AppWithInstaller,
  deleteAppRow,
  findAppRow,
  findAppRowByHandle,
  findAppRowBySecretHash,
  insertApp,
  listAppRows,
  recordAppUse,
} from "./apps.repository.js";
import type {
  AppExtensions,
  AppPreview,
  AppResponse,
  AppSessionToken,
  InstallAppRequest,
  InstalledApp,
  PreviewAppRequest,
} from "./apps.schema.js";
import type { AppRow } from "./apps.table.js";

/**
 * Installing, listing and uninstalling apps, the session tokens their admin pages get, and
 * recognising them when they call the API.
 */

/** Where this Lintel lives, so apps can't be hosted on it and tokens say who issued them. */
export interface LintelAddresses {
  adminOrigin: string;
  publicApiUrl: string;
}

export interface AppInstallContext {
  sender: SenderOptions;
  addresses: LintelAddresses;
}

/** "Last used" is only written when it is this stale, as for API tokens. */
const LAST_USED_ACCURACY_MILLISECONDS = 60_000;

export async function previewApp(
  database: DatabaseOrTransaction,
  source: PreviewAppRequest,
  context: AppInstallContext,
): Promise<AppPreview> {
  const manifest = await readManifest(source, context);
  const existing = await findAppRowByHandle(database, DEFAULT_TENANT_ID, manifest.handle);
  return { manifest, manifestUrl: source.manifestUrl ?? null, alreadyInstalled: Boolean(existing) };
}

export async function installApp(
  database: Database,
  request: InstallAppRequest,
  installer: { id: string; name: string },
  context: AppInstallContext,
): Promise<InstalledApp> {
  const manifest = await readManifest(request, context);
  if (!sameScopes(manifest.scopes, request.approvedScopes)) {
    throw new AppScopesChangedError();
  }
  if (await findAppRowByHandle(database, DEFAULT_TENANT_ID, manifest.handle)) {
    throw new AppAlreadyInstalledError(manifest.handle);
  }
  const webhookGroups = groupWebhooksByAddress(manifest, context.sender);

  const clientSecret = generateClientSecret();
  const app = await database.transaction(async (transaction) => {
    const inserted = await insertApp(transaction, {
      tenantId: DEFAULT_TENANT_ID,
      handle: manifest.handle,
      name: manifest.name,
      manifest,
      manifestUrl: request.manifestUrl ?? null,
      scopes: manifest.scopes,
      clientId: generateClientId(),
      clientSecret,
      clientSecretHash: hashClientSecret(clientSecret),
      clientSecretStart: visibleStartOfSecret(clientSecret),
      installedBy: installer.id,
    });
    for (const [url, events] of webhookGroups) {
      await insertWebhook(transaction, {
        tenantId: DEFAULT_TENANT_ID,
        name: manifest.name,
        url,
        events,
        // One secret for everything the app checks: session tokens and webhooks alike.
        secret: clientSecret,
        createdBy: installer.id,
        appId: inserted.id,
      });
    }
    return inserted;
  });
  return { app: describeApp({ ...app, installerName: installer.name }), clientSecret };
}

export async function listApps(database: DatabaseOrTransaction): Promise<{ apps: AppResponse[] }> {
  const rows = await listAppRows(database, DEFAULT_TENANT_ID);
  return { apps: rows.map(describeApp) };
}

export async function findApp(
  database: DatabaseOrTransaction,
  appId: string,
): Promise<AppResponse> {
  const row = await findAppRow(database, DEFAULT_TENANT_ID, appId);
  if (!row) {
    throw new AppNotFoundError();
  }
  return describeApp(row);
}

/**
 * Uninstalling revokes everything at once: the credential stops working on the next
 * request, its webhooks (and their log) are deleted, and its parts leave the admin. Session
 * tokens already handed out can't be recalled, but they expire within five minutes and the
 * secret that signed them no longer opens the API.
 */
export async function uninstallApp(database: DatabaseOrTransaction, appId: string): Promise<void> {
  if (!(await deleteAppRow(database, DEFAULT_TENANT_ID, appId))) {
    throw new AppNotFoundError();
  }
}

/** Every installed app's parts of the admin. Who may use them is decided by what they do. */
export async function listAppExtensions(
  database: DatabaseOrTransaction,
): Promise<{ apps: AppExtensions[] }> {
  const rows = await listAppRows(database, DEFAULT_TENANT_ID);
  return {
    apps: rows.map((row) => ({
      id: row.id,
      handle: row.handle,
      name: row.name,
      iconUrl: row.manifest.icon ?? null,
      origin: new URL(row.manifest.appUrl).origin,
      admin: row.manifest.admin,
    })),
  };
}

/**
 * A session token for one person looking at one of the app's pages. Its permissions are
 * the app's, cut down to what that person may do, so an app can hide buttons they can't use.
 */
export async function issueSessionToken(
  database: DatabaseOrTransaction,
  appId: string,
  signedIn: SignedIn,
  addresses: LintelAddresses,
  now = new Date(),
): Promise<AppSessionToken> {
  const app = await findAppRow(database, DEFAULT_TENANT_ID, appId);
  if (!app) {
    throw new AppNotFoundError();
  }
  const { token, expiresAt } = signSessionToken(
    app.clientSecret,
    {
      iss: addresses.publicApiUrl,
      dest: addresses.adminOrigin,
      aud: app.clientId,
      sub: signedIn.user.id,
      appId: app.id,
      permissions: allowedPermissions(app, signedIn.permissions),
    },
    now,
  );
  return { token, expiresAt: expiresAt.toISOString() };
}

export type AuthenticatedApp = AuthenticatedApiToken & { app: { id: string; name: string } };

/**
 * Who an app's request acts for and what it may do, or undefined for an unknown secret. It
 * acts for its installer, with its scopes' permissions that the installer also has, worked
 * out on every request so a change to their role applies straight away.
 */
export async function authenticateApp(
  database: Database,
  clientSecret: string,
  now = new Date(),
): Promise<AuthenticatedApp | undefined> {
  const app = await findAppRowBySecretHash(database, hashClientSecret(clientSecret));
  if (!app) {
    return undefined;
  }
  const installer = await findUserById(database, app.installedBy);
  if (!installer) {
    return undefined;
  }
  const lastUsed = app.lastUsedAt?.getTime() ?? 0;
  if (now.getTime() - lastUsed > LAST_USED_ACCURACY_MILLISECONDS) {
    await recordAppUse(database, app.id, now);
  }
  const installerPermissions = await findPermissionsForUser(database, installer.id);
  return {
    tokenId: app.id,
    access: app.scopes.includes("write_content") ? "readWrite" : "read",
    app: { id: app.id, name: app.name },
    signedIn: {
      user: { id: installer.id, email: installer.email, name: installer.name },
      permissions: allowedPermissions(app, installerPermissions),
      enabledPlugins: await findEnabledPluginIds(database),
    },
  };
}

function allowedPermissions(app: AppRow, personPermissions: readonly string[]): string[] {
  return permissionsForScopes(app.scopes).filter((permission) =>
    hasPermission(personPermissions, permission),
  );
}

async function readManifest(
  source: PreviewAppRequest,
  context: AppInstallContext,
): Promise<AppManifest> {
  const manifest =
    source.manifestUrl === undefined
      ? checkAppManifest(source.manifest)
      : await fetchAppManifest(source.manifestUrl, context.sender);
  refuseLintelsOwnOrigin(manifest, context.addresses);
  return manifest;
}

/**
 * The admin sandboxes app frames with `allow-same-origin`, which is safe only while the
 * app's origin differs from the admin's: on the same origin, the frame could reach into
 * the admin and lift the sandbox. So apps can't live on Lintel's own addresses.
 */
function refuseLintelsOwnOrigin(manifest: AppManifest, addresses: LintelAddresses): void {
  const appOrigin = new URL(manifest.appUrl).origin;
  const lintelOrigins = [addresses.adminOrigin, addresses.publicApiUrl].map(
    (address) => new URL(address).origin,
  );
  if (lintelOrigins.includes(appOrigin)) {
    throw new AppOriginNotAllowedError(appOrigin);
  }
}

/** One webhook per address, with every event the app wants sent there. */
function groupWebhooksByAddress(
  manifest: AppManifest,
  sender: SenderOptions,
): Map<string, WebhookEventName[]> {
  const groups = new Map<string, WebhookEventName[]>();
  for (const { event, url } of manifest.webhooks) {
    const address = new URL(url);
    try {
      checkWebhookAddress(address, sender);
    } catch (error) {
      if (error instanceof WebhookSendError) {
        throw new AppWebhookAddressError(address.hostname);
      }
      throw error;
    }
    const events = groups.get(address.href) ?? [];
    if (!events.includes(event)) {
      events.push(event);
    }
    groups.set(address.href, events);
  }
  return groups;
}

function sameScopes(wanted: readonly string[], approved: readonly string[]): boolean {
  return (
    wanted.length === new Set(approved).size && wanted.every((scope) => approved.includes(scope))
  );
}

function describeApp(row: AppWithInstaller): AppResponse {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    manifest: row.manifest,
    manifestUrl: row.manifestUrl,
    scopes: row.scopes,
    clientId: row.clientId,
    clientSecretStart: row.clientSecretStart,
    installedAt: row.createdAt.toISOString(),
    installedBy:
      row.installerName === null ? null : { id: row.installedBy, name: row.installerName },
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
  };
}
