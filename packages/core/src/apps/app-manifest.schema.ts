import { z } from "zod";
import { webhookEventNames } from "../webhooks/webhook-events.js";
import { appScopeNames, scopeNeededForEvent } from "./app-scopes.js";

/**
 * `lintel-app.json`: how an app describes itself. Lintel reads it when someone adds the
 * app, shows it to them in plain English, and keeps the copy they approved. Changing the
 * file later changes nothing until the app is installed again, so an app can't quietly
 * give itself more access.
 *
 * Every page, widget and panel the app shows in the admin is on the app's own address
 * (`appUrl`), so the admin knows exactly which origin may talk to it.
 */

const HANDLE_PATTERN = /^[a-z][a-z0-9-]{1,39}$/;
const PART_ID_PATTERN = /^[a-z][a-z0-9-]{0,39}$/;
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** Secure addresses only, apart from this computer, where apps are developed. */
export function isSecureAppAddress(url: URL): boolean {
  return url.protocol === "https:" || (url.protocol === "http:" && LOCAL_HOSTS.has(url.hostname));
}

const appAddressSchema = z
  .url({ error: "This should be a full web address, like https://app.example.com/page" })
  .max(2000, { error: "Web addresses can be at most 2000 characters" })
  .refine((address) => isSecureAppAddress(new URL(address)), {
    error: "Addresses need to start with https:// (http:// only works for localhost)",
  });

const shortText = (what: string, max: number) =>
  z
    .string({ error: `Please give the ${what}` })
    .trim()
    .min(1, { error: `Please give the ${what}` })
    .max(max, { error: `The ${what} can be at most ${max} characters` });

const partIdSchema = z.string({ error: "Each part needs an id" }).regex(PART_ID_PATTERN, {
  error: "Ids are lowercase letters, numbers and dashes, like low-stock",
});

export const appPageSchema = z.object({
  label: shortText("page's label", 40),
  url: appAddressSchema,
});

export const appSettingsPageSchema = z.object({ url: appAddressSchema });

export const appDashboardWidgetSchema = z.object({
  id: partIdSchema,
  title: shortText("widget's title", 60),
  description: shortText("widget's description", 200),
  url: appAddressSchema,
  size: z.enum(["small", "medium", "large"]).default("medium"),
});

export const appEditorPanelSchema = z.object({
  id: partIdSchema,
  title: shortText("panel's title", 60),
  url: appAddressSchema,
  /** Collection handles the panel shows for; leave it out to show it for every collection. */
  collections: z.array(z.string().min(1).max(64)).max(50).optional(),
});

export const appWebhookSubscriptionSchema = z.object({
  event: z.enum(webhookEventNames, {
    error: `Webhook events are one of: ${webhookEventNames.join(", ")}`,
  }),
  url: appAddressSchema,
});

export const appManifestSchema = z
  .object({
    name: shortText("app's name", 60),
    handle: z
      .string({ error: "Please give the app a handle, like stock-sync" })
      .regex(HANDLE_PATTERN, {
        error: "The handle is 2 to 40 lowercase letters, numbers and dashes, like stock-sync",
      }),
    description: shortText("app's description", 500),
    icon: appAddressSchema.optional(),
    /** The app's home: every admin page, widget and panel must be on this origin. */
    appUrl: appAddressSchema,
    developer: z
      .object({ name: shortText("developer's name", 100), url: appAddressSchema.optional() })
      .optional(),
    scopes: z
      .array(z.enum(appScopeNames, { error: `Scopes are one of: ${appScopeNames.join(", ")}` }))
      .max(appScopeNames.length)
      .default([]),
    webhooks: z.array(appWebhookSubscriptionSchema).max(20).default([]),
    admin: z
      .object({
        page: appPageSchema.optional(),
        dashboardWidgets: z.array(appDashboardWidgetSchema).max(10).default([]),
        editorPanels: z.array(appEditorPanelSchema).max(10).default([]),
        settingsPage: appSettingsPageSchema.optional(),
      })
      .default({ dashboardWidgets: [], editorPanels: [] }),
  })
  .superRefine((manifest, context) => {
    const origin = new URL(manifest.appUrl).origin;
    const embedded = [
      ["icon", manifest.icon],
      ["admin.page.url", manifest.admin.page?.url],
      ["admin.settingsPage.url", manifest.admin.settingsPage?.url],
      ...manifest.admin.dashboardWidgets.map((widget) => [`widget ${widget.id}`, widget.url]),
      ...manifest.admin.editorPanels.map((panel) => [`panel ${panel.id}`, panel.url]),
    ] as const;
    for (const [where, address] of embedded) {
      if (address !== undefined && new URL(address).origin !== origin) {
        context.addIssue({
          code: "custom",
          message: `The ${where} address must be on ${origin}, the app's own address`,
        });
      }
    }
    const repeated = (ids: string[]) => ids.find((id, index) => ids.indexOf(id) !== index);
    const widgetId = repeated(manifest.admin.dashboardWidgets.map((widget) => widget.id));
    const panelId = repeated(manifest.admin.editorPanels.map((panel) => panel.id));
    for (const id of [widgetId, panelId]) {
      if (id !== undefined) {
        context.addIssue({ code: "custom", message: `The id "${id}" is used twice` });
      }
    }
    if (new Set(manifest.scopes).size !== manifest.scopes.length) {
      context.addIssue({ code: "custom", message: "Each scope only needs to be listed once" });
    }
    // Being told about an entry is reading it, so it needs the scope that allows that.
    for (const { event } of manifest.webhooks) {
      const needed = scopeNeededForEvent(event);
      if (!manifest.scopes.includes(needed)) {
        context.addIssue({
          code: "custom",
          message: `The ${event} webhook needs the ${needed} scope`,
        });
      }
    }
  });

export type AppManifest = z.output<typeof appManifestSchema>;
export type AppManifestInput = z.input<typeof appManifestSchema>;
