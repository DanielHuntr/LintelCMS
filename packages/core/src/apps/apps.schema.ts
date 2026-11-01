import { z } from "zod";
import type { AppManifest } from "./app-manifest.schema.js";
import { appScopeNames } from "./app-scopes.js";

/**
 * Where the app's `lintel-app.json` comes from: a web address Lintel reads, or the file's
 * contents pasted in. The manifest itself is checked by `appManifestSchema` afterwards, so
 * its mistakes come back one by one, in words the developer can act on.
 */
const manifestSourceSchema = z
  .object({
    manifestUrl: z
      .url({
        error: "This should be a full web address, like https://app.example.com/lintel-app.json",
      })
      .max(2000)
      .optional(),
    manifest: z.unknown().optional(),
  })
  .refine((source) => (source.manifestUrl === undefined) !== (source.manifest === undefined), {
    error: "Send either the manifest's web address or its contents, not both",
  });

/** `POST /apps/preview` */
export const previewAppRequestSchema = manifestSourceSchema;

/**
 * `POST /apps`. `approvedScopes` are what the person saw and agreed to; the manifest is
 * read again, and if it now asks for anything else the install stops.
 */
export const installAppRequestSchema = manifestSourceSchema.and(
  z.object({
    approvedScopes: z.array(z.enum(appScopeNames), { error: "Please list the approved scopes" }),
  }),
);

export const appIdParamsSchema = z.object({ id: z.uuid() });

const manifestSchema = z.custom<AppManifest>();

/** What the admin shows before anything is installed. */
export const appPreviewSchema = z.object({
  manifest: manifestSchema,
  manifestUrl: z.string().nullable(),
  /** An app with this handle is installed already; it has to be uninstalled first. */
  alreadyInstalled: z.boolean(),
});

/** An installed app, as Settings → Apps shows it. Its secret is never shown again. */
export const appSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  manifest: manifestSchema,
  manifestUrl: z.string().nullable(),
  scopes: z.array(z.enum(appScopeNames)),
  clientId: z.string(),
  /** The first characters of the client secret, like "lintelapp_3fA9". */
  clientSecretStart: z.string(),
  installedAt: z.iso.datetime(),
  installedBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  lastUsedAt: z.iso.datetime().nullable(),
});

export const appListSchema = z.object({ apps: z.array(appSchema) });

/** What `POST /apps` answers: the app, with its client secret shown this once. */
export const installedAppSchema = z.object({ app: appSchema, clientSecret: z.string() });

/** One app's parts of the admin, for everyone signed in (`GET /apps/extensions`). */
export const appExtensionsSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  name: z.string(),
  iconUrl: z.string().nullable(),
  /** The only origin the admin accepts messages from, and sends session tokens to. */
  origin: z.string(),
  admin: z.custom<AppManifest["admin"]>(),
});

export const appSessionTokenSchema = z.object({
  token: z.string(),
  expiresAt: z.iso.datetime(),
});

export type PreviewAppRequest = z.infer<typeof previewAppRequestSchema>;
export type InstallAppRequest = z.infer<typeof installAppRequestSchema>;
export type AppPreview = z.infer<typeof appPreviewSchema>;
export type AppResponse = z.infer<typeof appSchema>;
export type InstalledApp = z.infer<typeof installedAppSchema>;
export type AppExtensions = z.infer<typeof appExtensionsSchema>;
export type AppSessionToken = z.infer<typeof appSessionTokenSchema>;
