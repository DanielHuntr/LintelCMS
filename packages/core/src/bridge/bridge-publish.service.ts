import type { FastifyInstance } from "fastify";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { listMarketRows } from "../commerce/markets/markets.repository.js";
import { findMollieCredentials } from "../commerce/payments/mollie/mollie-provider.js";
import { answerFields } from "../forms/form-fields.schema.js";
import { listFormRows } from "../forms/forms.repository.js";
import { isPluginEnabled } from "../plugins/plugins.service.js";
import type { PublishTargetSecrets } from "../publishing/publishing.schema.js";
import type { PublishTargetRow } from "../publishing/publishing.table.js";
import type { ExtraFile, ExtraPage } from "../static-site/static-export.service.js";
import { apiFormEndpoints, type FormEndpoints } from "../website/site-forms.service.js";
import {
  BRIDGE_CATALOGUE_FILE,
  BRIDGE_CONFIG_FILE,
  BRIDGE_FILE,
  BRIDGE_FORMS_FILE,
  buildBridgeConfig,
  guardPrivateFile,
  privateFolderGuards,
  readBridgeScript,
} from "./bridge-files.js";
import { signEnvelope } from "./bridge-signing.js";
import { buildShopCatalogue } from "./shop-catalogue.service.js";
import { buildShopPages, SHOP_SCRIPT_FILE, shopScript } from "./shop-pages.js";

/**
 * What a target's publish adds for forms and the shop: where forms post, the companion
 * and its private files, and the shop's pages. A bucket can't run PHP, so a target set to
 * "bridge" that is a bucket posts to Lintel's API instead.
 */

export interface BridgePublishFiles {
  formEndpoints: FormEndpoints;
  extraFiles: ExtraFile[];
  extraPages: ExtraPage[];
  /** Relative to the companion's private folder. Never part of the website. */
  privateFiles: ExtraFile[];
  usesBridge: boolean;
}

export const bridgeFormEndpoints: FormEndpoints = {
  action: (handle) => `/${BRIDGE_FILE}?action=form&form=${encodeURIComponent(handle)}`,
  tokenUrl: (handle) => `/${BRIDGE_FILE}?action=token&form=${encodeURIComponent(handle)}`,
  plainPost: true,
};

export function targetUsesBridge(target: Pick<PublishTargetRow, "kind" | "formDelivery">): boolean {
  return target.kind !== "s3" && target.formDelivery === "bridge";
}

export async function prepareBridgePublish(
  api: FastifyInstance,
  target: PublishTargetRow,
  secrets: PublishTargetSecrets,
  testing: { stripeApiBase?: string; mollieApiBase?: string } = {},
): Promise<BridgePublishFiles> {
  const usesBridge = targetUsesBridge(target);
  // A shop that doesn't sell anywhere yet has nothing to publish.
  const shopEnabled =
    (await isPluginEnabled(api.database, "commerce")) &&
    (await listMarketRows(api.database, DEFAULT_TENANT_ID)).length > 0;
  const extraPages = shopEnabled && usesBridge ? await buildShopPages(api.shop) : [];
  const extraFiles: ExtraFile[] =
    extraPages.length > 0 ? [{ path: SHOP_SCRIPT_FILE, content: shopScript }] : [];
  if (!usesBridge) {
    return {
      formEndpoints: apiFormEndpoints(api.publicApiUrl),
      extraFiles,
      extraPages,
      privateFiles: [],
      usesBridge,
    };
  }
  const secret = secrets.bridgeSecret ?? "";
  const keys = shopEnabled ? await api.shop.stripeKeys() : null;
  const mollie = shopEnabled ? await findMollieCredentials(api.shop) : null;
  const privateFiles: ExtraFile[] = [
    ...privateFolderGuards(),
    {
      path: BRIDGE_CONFIG_FILE,
      content: buildBridgeConfig({
        secret,
        siteAddress: target.options.siteAddress ?? "",
        stripeSecretKey: keys?.secretKey?.value ?? null,
        stripeWebhookSecret: secrets.stripeWebhookSecret ?? null,
        mollieApiKey: mollie?.apiKey ?? null,
        emailFromHost: false,
        emailFrom: "",
        ...testing,
      }),
    },
    {
      path: BRIDGE_FORMS_FILE,
      content: guardPrivateFile(signEnvelope(secret, await describeFormsForBridge(api))),
    },
  ];
  if (shopEnabled) {
    privateFiles.push({
      path: BRIDGE_CATALOGUE_FILE,
      content: guardPrivateFile(signEnvelope(secret, await buildShopCatalogue(api.shop))),
    });
  }
  return {
    formEndpoints: bridgeFormEndpoints,
    extraFiles: [...extraFiles, { path: BRIDGE_FILE, content: readBridgeScript() }],
    extraPages,
    privateFiles,
    usesBridge,
  };
}

/** Each form's questions, as the companion checks them before keeping an answer. */
async function describeFormsForBridge(api: FastifyInstance) {
  const enabled = await isPluginEnabled(api.database, "forms");
  const rows = enabled ? await listFormRows(api.database, DEFAULT_TENANT_ID) : [];
  return {
    forms: Object.fromEntries(
      rows.map((row) => [
        row.handle,
        {
          name: row.name,
          acceptingSubmissions: row.acceptingSubmissions,
          confirmation: row.confirmation,
          notify: row.notifications.recipients,
          fields: answerFields(row.fields).map((field) => ({
            handle: field.handle,
            label: field.label,
            type: field.type,
            required: field.required,
            choices: Array.isArray(field.options.choices) ? field.options.choices : [],
          })),
        },
      ]),
    ),
  };
}
