import type { DatabaseOrTransaction } from "../database/client.js";
import { DEFAULT_TENANT_ID } from "../database/columns.js";
import { readCookieNoticeSettings } from "../cookie-notice/cookie-notice.service.js";
import { findPrivacyPage } from "./privacy.repository.js";
import type { PolicyHelperResponse, PolicySection } from "./privacy.schema.js";
import type { SiteServices } from "./site-services.service.js";

/**
 * A starting point for the "What this site collects" part of a privacy policy, written from
 * what the site actually uses. It is not legal advice and the admin says so; the owner reads
 * it, changes it to fit, and puts it on their privacy page. A simple word check then warns
 * when that page doesn't mention something the site uses.
 */

interface DraftSection extends PolicySection {
  /** Each thing the page should mention: its name, and the words that count as mentioning it. */
  checks: Array<{ label: string; words: string[] }>;
}

const DRAFT_TITLE = "What this site collects";

const monthsOrYears = (days: number) =>
  days >= 730
    ? `${Math.round(days / 365)} years`
    : days >= 365
      ? "a year"
      : `${Math.round(days / 30)} months`;

function listOf(names: readonly string[]): string {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}

function formsSection(
  forms: NonNullable<SiteServices["forms"]>,
  services: SiteServices,
): DraftSection {
  const rule = services.retention.formEntries;
  const sentences = [
    "When you fill in a form on this site, we keep what you type, any files you attach, the page you sent it from and the time, so we can reply.",
    forms.hasConsentBoxes
      ? "If you tick a box to agree to something, we keep the exact words you agreed to and when."
      : null,
    rule.enabled
      ? `We delete form messages after ${monthsOrYears(rule.days)}.`
      : "We keep form messages only as long as we need them.",
    forms.spamCheck
      ? "To keep out spam, forms are checked by Cloudflare Turnstile, which sees your IP address."
      : null,
  ];
  return {
    id: "forms",
    heading: "Forms",
    text: sentences.filter(Boolean).join(" "),
    checks: [
      { label: "Forms", words: ["form"] },
      ...(forms.spamCheck
        ? [{ label: "Cloudflare Turnstile", words: ["cloudflare", "turnstile"] }]
        : []),
    ],
  };
}

function shopSection(
  shop: NonNullable<SiteServices["shop"]>,
  services: SiteServices,
): DraftSection {
  const rule = services.retention.orders;
  const providers = shop.paymentProviders;
  const sentences = [
    "When you buy something, we keep your name, email address, delivery address and phone number, and what you bought, to send your order and for our tax records.",
    providers.length > 0
      ? `Payments are handled by ${listOf(providers)}. We never see or keep your card details.`
      : null,
    rule.enabled
      ? `After ${monthsOrYears(rule.days)} we remove your name and contact details from the order.`
      : null,
  ];
  return {
    id: "shop",
    heading: "Orders",
    text: sentences.filter(Boolean).join(" "),
    checks: [
      { label: "Orders", words: ["order", "purchase", "buy"] },
      ...providers.map((name) => ({ label: name, words: [name.toLowerCase()] })),
    ],
  };
}

function servicesSections(services: SiteServices): DraftSection[] {
  const sections: DraftSection[] = [];
  if (services.visitors) {
    sections.push({
      id: "visitors",
      heading: "Counting visits",
      text: "We count visits to see which pages people read. This doesn't use cookies, doesn't keep your IP address and can't identify you.",
      checks: [{ label: "Counting visits", words: ["visit", "analytics", "statistic"] }],
    });
  }
  if (services.tests) {
    sections.push({
      id: "tests",
      heading: "Trying different versions of a page",
      text: "Sometimes we show different versions of a page to see which works better. Your browser remembers which version you saw, on your own device; we only keep totals.",
      checks: [{ label: "Testing versions of pages", words: ["version", "test"] }],
    });
  }
  if (services.embeds.length > 0) {
    const names = services.embeds.map((service) => service.name);
    sections.push({
      id: "embeds",
      heading: "Content from other websites",
      text: `Some pages show content from ${listOf(names)}. These services may set cookies and see your IP address, so they only load after you agree in the cookie notice.`,
      checks: names.map((name) => ({ label: name, words: [name.toLowerCase()] })),
    });
  }
  if (services.adobeFonts || services.hostedGoogleFonts) {
    sections.push({
      id: "fonts",
      heading: "Fonts",
      text: services.adobeFonts
        ? "Some text uses fonts from Adobe Fonts, which your browser loads from Adobe, so Adobe sees your IP address."
        : "Our fonts are served from this site, so your browser doesn't contact anyone else for them.",
      checks: services.adobeFonts ? [{ label: "Adobe Fonts", words: ["adobe"] }] : [],
    });
  }
  if (services.emailService) {
    sections.push({
      id: "email",
      heading: "Emails we send",
      text: `Emails from this site, such as replies and order confirmations, are sent through ${services.emailService}.`,
      checks: [{ label: services.emailService, words: [services.emailService.toLowerCase()] }],
    });
  }
  for (const addon of services.addons) {
    if (!addon.description && addon.services.length === 0) continue;
    sections.push({
      id: `addon:${addon.id}`,
      heading: addon.name,
      text: [
        addon.description,
        addon.services.length > 0
          ? `It loads content from ${listOf(addon.services)}, only after you agree in the cookie notice.`
          : null,
      ]
        .filter(Boolean)
        .join(" "),
      checks: addon.services.map((name) => ({ label: name, words: [name.toLowerCase()] })),
    });
  }
  return sections;
}

const rightsSection: DraftSection = {
  id: "rights",
  heading: "Your rights",
  text: "You can ask to see the personal data we hold about you, to have it corrected or deleted, or to get a copy to take elsewhere. Contact us and we'll reply within a month.",
  checks: [],
};

export function draftPolicySections(services: SiteServices): DraftSection[] {
  return [
    ...(services.forms ? [formsSection(services.forms, services)] : []),
    ...(services.shop ? [shopSection(services.shop, services)] : []),
    ...servicesSections(services),
    rightsSection,
  ];
}

/** Every piece of text in a page's published content, lowercased, for a simple word check. */
export function pageText(content: unknown): string {
  const texts: string[] = [];
  const visit = (value: unknown) => {
    if (typeof value === "string") texts.push(value.replace(/<[^>]*>/g, " "));
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(content);
  return texts.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * Whether a word appears at the start of a word in the text, so "form" finds "forms" but not
 * "platform", and "order" not "border", which a page's design is full of.
 */
export function mentions(text: string, word: string): boolean {
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(text);
}

export async function describePolicyHelper(
  database: DatabaseOrTransaction,
  services: SiteServices,
): Promise<PolicyHelperResponse> {
  const sections = draftPolicySections(services);
  const { privacyPageId } = await readCookieNoticeSettings(database);
  const page = await findPrivacyPage(database, DEFAULT_TENANT_ID, privacyPageId);
  const text = page ? pageText(page.publishedData) : "";
  const notMentioned = page
    ? sections
        .flatMap((section) => section.checks)
        .filter((check) => !check.words.some((word) => mentions(text, word)))
        .map((check) => check.label)
    : [];
  return {
    sections: sections.map(({ id, heading, text: body }) => ({ id, heading, text: body })),
    draft: [DRAFT_TITLE, ...sections.map((section) => `${section.heading}\n${section.text}`)].join(
      "\n\n",
    ),
    privacyPage: page ? { id: page.id, title: pageTitle(page) } : null,
    notMentioned: [...new Set(notMentioned)],
  };
}

function pageTitle(page: { slug: string; publishedData: unknown }): string {
  const data = page.publishedData as { title?: unknown } | null;
  return typeof data?.title === "string" && data.title ? data.title : page.slug;
}
