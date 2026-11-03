import type { DatabaseOrTransaction } from "../database/client.js";
import { readSetting, writeSetting } from "../settings/settings.service.js";
import type { AddedProcessor, ProcessorResponse, ProcessorsResponse } from "./privacy.schema.js";
import type { SiteServices } from "./site-services.service.js";

/**
 * The outside companies the site sends personal data to, for the owner's records: those
 * Lintel finds in what the site uses, and those the owner adds (their host, a newsletter
 * service, an accountant). Where a company is and what it does with the data is for the
 * owner to check; Lintel only lists what it can see.
 */

function detected(id: string, name: string, purpose: string): ProcessorResponse {
  return { id, name, purpose, location: "", link: "", origin: "detected" };
}

export function detectProcessors(services: SiteServices): ProcessorResponse[] {
  const found: ProcessorResponse[] = [];
  for (const provider of services.shop?.paymentProviders ?? []) {
    found.push(detected(`payments:${provider}`, provider, "Takes payments for orders."));
  }
  if (services.emailService) {
    found.push(detected("email", services.emailService, "Sends the site's emails."));
  }
  if (services.forms?.spamCheck) {
    found.push(detected("turnstile", "Cloudflare Turnstile", "Checks forms for spam."));
  }
  if (services.adobeFonts) {
    found.push(detected("adobe-fonts", "Adobe Fonts", "Serves some of the site's fonts."));
  }
  for (const embed of services.embeds) {
    found.push(detected(`embed:${embed.id}`, embed.name, "Content shown on the site's pages."));
  }
  for (const addon of services.addons) {
    for (const name of addon.services) {
      found.push(detected(`addon:${addon.id}:${name}`, name, `Used by ${addon.name}.`));
    }
  }
  return found;
}

export async function describeProcessors(
  database: DatabaseOrTransaction,
  services: SiteServices,
): Promise<ProcessorsResponse> {
  const { processors } = await readSetting(database, "privacy");
  return {
    detected: detectProcessors(services),
    added: processors.map((processor) => ({ ...processor, origin: "added" as const })),
  };
}

export async function saveAddedProcessors(
  database: DatabaseOrTransaction,
  processors: AddedProcessor[],
): Promise<void> {
  const settings = await readSetting(database, "privacy");
  await writeSetting(database, "privacy", { ...settings, processors });
}
