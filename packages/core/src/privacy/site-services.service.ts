import type { ConsentService } from "@lintel/builder-model";
import type { ShopContext } from "../commerce/commerce.context.js";
import { listMarketRows } from "../commerce/markets/markets.repository.js";
import {
  marketPaymentProvider,
  PAYMENT_PROVIDER_NAMES,
  type PaymentProviderId,
} from "../commerce/payments/payment-provider.js";
import { readPaymentProviders } from "../commerce/payments/payment-providers.service.js";
import { readPaymentSettings } from "../commerce/payments/payment-settings.service.js";
import { describeCookieNotice } from "../cookie-notice/cookie-notice.service.js";
import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { listFormRows } from "../forms/forms.repository.js";
import type { LintelPlugin } from "../plugins/plugin-definition.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import { pluginRegistry } from "../plugins/plugins.registry.js";
import { readSetting } from "../settings/settings.service.js";
import { listSiteFontRows } from "../site-fonts/site-fonts.repository.js";
import type { Site } from "../sites/sites.table.js";
import type { RetentionRules } from "./privacy.schema.js";

/**
 * What the site actually uses that matters for privacy, worked out from its settings,
 * plugins and published pages. The policy helper and the processors list are both built
 * from this, so they never disagree.
 */
export interface SiteServices {
  forms: { names: string[]; hasConsentBoxes: boolean; spamCheck: boolean } | null;
  shop: { paymentProviders: string[] } | null;
  visitors: boolean;
  tests: boolean;
  /** Embeds and other outside services the cookie notice names (videos, maps...). */
  embeds: ConsentService[];
  adobeFonts: boolean;
  /** Google Fonts downloaded into the site, which visitors' browsers get from the site itself. */
  hostedGoogleFonts: boolean;
  /** The company that sends the site's emails, when it isn't the server itself. */
  emailService: string | null;
  addons: Array<{ id: string; name: string; description: string | null; services: string[] }>;
  retention: RetentionRules;
}

export interface SiteServicesContext {
  database: DatabaseOrTransaction;
  site: Site;
  plugins: readonly LintelPlugin[];
  /** For finding which payment providers are connected. */
  shop: ShopContext;
  /** How the server sends email (src/email): "Postmark", "SMTP (smtp.example.com:587)"... */
  email: { description: string; keepsInOutbox: boolean };
}

const builtInIds: ReadonlySet<string> = new Set(pluginRegistry.map((plugin) => plugin.id));

export async function findSiteServices(context: SiteServicesContext): Promise<SiteServices> {
  const { database, site } = context;
  const [enabledPlugins, cookieNotice, fonts, privacy] = await Promise.all([
    findEnabledPluginIds(database),
    describeCookieNotice(database, site),
    listSiteFontRows(database, DEFAULT_TENANT_ID, site.id),
    readSetting(database, "privacy"),
  ]);
  const on = (pluginId: string) => enabledPlugins.includes(pluginId);
  const addons = context.plugins.filter((plugin) => !builtInIds.has(plugin.id) && on(plugin.id));
  return {
    forms: on("forms") ? await describeForms(database) : null,
    shop: on("commerce") ? await describeShop(context.shop) : null,
    visitors: on("analytics"),
    tests: on("experiments"),
    // Plugins' services are written about under the plugin, or are the site's own.
    embeds: cookieNotice.services.filter(
      (service) => service.id !== "adobe-fonts" && !service.id.startsWith("plugin:"),
    ),
    adobeFonts: fonts.some((font) => font.source === "adobe" && font.sourceId),
    hostedGoogleFonts: fonts.some((font) => font.source === "google"),
    emailService: context.email.keepsInOutbox ? null : emailCompany(context.email.description),
    addons: addons.map((plugin) => ({
      id: plugin.id,
      name: plugin.name,
      description: plugin.personalData?.description ?? null,
      services: cookieNotice.services
        .filter((service) => isServiceOfPlugin(service, plugin.id))
        .map((service) => service.name),
    })),
    retention: privacy.retention,
  };
}

function isServiceOfPlugin(service: ConsentService, pluginId: string): boolean {
  return service.id === `plugin:${pluginId}` || service.id.startsWith(`plugin:${pluginId}:`);
}

async function describeForms(database: DatabaseOrTransaction): Promise<SiteServices["forms"]> {
  const [forms, spam] = await Promise.all([
    listFormRows(database, DEFAULT_TENANT_ID),
    readSetting(database, "formsSpamProtection"),
  ]);
  return {
    names: forms.map((form) => form.name),
    hasConsentBoxes: forms.some((form) => form.fields.some((field) => field.type === "consent")),
    spamCheck: Boolean(spam.turnstileSiteKey && spam.turnstileSecretKey),
  };
}

/** The providers the shop's markets use and that are connected, so it takes real payments. */
async function describeShop(shop: ShopContext): Promise<SiteServices["shop"]> {
  const [markets, stripe, others] = await Promise.all([
    listMarketRows(shop.database, DEFAULT_TENANT_ID),
    readPaymentSettings(shop),
    readPaymentProviders(shop),
  ]);
  const connected: Record<PaymentProviderId, boolean> = {
    stripe: stripe.connected,
    paypal: others.paypal.connected,
    mollie: others.mollie.connected,
  };
  const providers = new Set(markets.map((market) => marketPaymentProvider(market)));
  return {
    paymentProviders: [...providers]
      .filter((id) => connected[id])
      .map((id) => PAYMENT_PROVIDER_NAMES[id]),
  };
}

/** "Postmark" stays "Postmark"; "SMTP (smtp.example.com:587)" becomes "smtp.example.com". */
function emailCompany(description: string): string {
  const smtpHost = /^SMTP \(([^:)]+)/.exec(description)?.[1];
  return smtpHost ?? description;
}
