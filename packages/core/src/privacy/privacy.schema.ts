import { z } from "zod";
import type { PrivacyRequestKind, PrivacyRequestPart } from "./privacy.table.js";

/**
 * Settings → Privacy: the retention rules and the companies the owner has added by hand,
 * saved as the `privacy` setting. docs/decisions/0065-privacy-tools.md explains the defaults.
 */

export const retentionRuleIds = [
  "formEntries",
  "abandonedCarts",
  "activityLogs",
  "orders",
] as const;
export type RetentionRuleId = (typeof retentionRuleIds)[number];

const ruleSchema = (choices: readonly number[]) =>
  z.object({
    enabled: z.boolean({ error: "Choose on or off" }),
    days: z
      .number({ error: "Choose how long to keep it" })
      .int()
      .refine((days) => choices.includes(days), { error: "Choose one of the lengths offered" }),
  });

/** The lengths each rule offers, in days, so the screen shows a short list, never a number box. */
export const retentionChoices: Readonly<Record<RetentionRuleId, readonly number[]>> = {
  formEntries: [90, 180, 365, 730],
  abandonedCarts: [7, 14, 30, 90],
  activityLogs: [30, 90, 180, 365],
  orders: [2190, 2555, 3650],
};

/**
 * The defaults. Leftovers nobody expects to keep (abandoned baskets, old sign-in records) are
 * tidied away from the start; what a person sent or bought is kept until the owner chooses,
 * because deleting it unasked could surprise them.
 */
export const defaultRetentionRules = {
  formEntries: { enabled: false, days: 365 },
  abandonedCarts: { enabled: true, days: 30 },
  activityLogs: { enabled: true, days: 90 },
  orders: { enabled: false, days: 2555 },
} as const satisfies Record<RetentionRuleId, { enabled: boolean; days: number }>;

const ruleSchemas = {
  formEntries: ruleSchema(retentionChoices.formEntries),
  abandonedCarts: ruleSchema(retentionChoices.abandonedCarts),
  activityLogs: ruleSchema(retentionChoices.activityLogs),
  orders: ruleSchema(retentionChoices.orders),
};

export const retentionRulesSchema = z.object({
  formEntries: ruleSchemas.formEntries.default(defaultRetentionRules.formEntries),
  abandonedCarts: ruleSchemas.abandonedCarts.default(defaultRetentionRules.abandonedCarts),
  activityLogs: ruleSchemas.activityLogs.default(defaultRetentionRules.activityLogs),
  orders: ruleSchemas.orders.default(defaultRetentionRules.orders),
});
export type RetentionRules = z.output<typeof retentionRulesSchema>;

const shortText = (label: string, max: number) =>
  z
    .string({ error: `${label} should be text` })
    .trim()
    .max(max, { error: `${label} can be at most ${max} characters` });

/** A company the owner adds by hand, such as their host or newsletter service. */
export const addedProcessorSchema = z.object({
  id: z.string().trim().min(1).max(60),
  name: shortText("The name", 120).min(1, { error: "Give the company's name" }),
  purpose: shortText("What it's for", 300).default(""),
  location: shortText("Where it is", 120).default(""),
  link: shortText("The link", 500).default(""),
});
export type AddedProcessor = z.output<typeof addedProcessorSchema>;

export const privacySettingsSchema = z.object({
  retention: retentionRulesSchema.default(defaultRetentionRules),
  processors: z.array(addedProcessorSchema).max(100).default([]),
});
export type PrivacySettings = z.output<typeof privacySettingsSchema>;

export const defaultPrivacySettings: PrivacySettings = {
  retention: { ...defaultRetentionRules },
  processors: [],
};

/**
 * Built from the rules without their defaults: Zod fills in a default even inside an optional
 * field, so a change to one rule would otherwise put every other rule back to its default.
 */
export const updateRetentionRequestSchema = z.object(ruleSchemas).partial();
export const updateProcessorsRequestSchema = z.object({
  processors: z.array(addedProcessorSchema).max(100),
});

/** `POST /privacy/people/...`: an email address, a whole name, or both. */
export const personRequestSchema = z
  .object({
    email: z
      .string()
      .trim()
      .toLowerCase()
      .transform((email) => (email === "" ? null : email))
      .pipe(z.email({ error: "That doesn't look like an email address" }).nullable())
      .nullable()
      .default(null),
    name: z
      .string()
      .trim()
      .max(200, { error: "Names can be at most 200 characters" })
      .transform((name) => (name === "" ? null : name))
      .nullable()
      .default(null),
  })
  .refine((person) => person.email !== null || person.name !== null, {
    error: "Give an email address or a name to look for",
    path: ["email"],
  });

/** One kind of personal data, as the map and the search list it. */
export interface PersonalDataKind {
  id: string;
  name: string;
  /** What is kept, in a plain sentence. */
  description: string;
  /** "core" for Lintel's own, or the plugin's id. */
  from: string;
  /** False when the feature is switched off: listed, because switching off deletes nothing. */
  inUse: boolean;
  /** Whether Find a person can look in it. */
  searchable: boolean;
  /** Why it can't be searched, when it can't. */
  notSearchableReason: string | null;
  /** What erasing does to it, in a plain sentence. */
  erasure: string | null;
  tables: Array<{ name: string; columns: string[] }>;
}

export interface PersonalDataMapResponse {
  kinds: PersonalDataKind[];
}

export interface FoundKind {
  kindId: string;
  name: string;
  erasure: string | null;
  items: Array<{ id: string; summary: string; date: string | null }>;
}

export interface PersonSearchResponse {
  found: FoundKind[];
  /** Kinds of data that may hold the person but can't be searched (add-ons without hooks). */
  notSearched: Array<{ kindId: string; name: string; reason: string }>;
}

export interface ErasureResponse {
  parts: PrivacyRequestPart[];
  /** Why anything was kept or only anonymised, in plain sentences. */
  explanations: string[];
}

export interface PrivacyRequestResponse {
  id: string;
  kind: PrivacyRequestKind;
  actorName: string;
  parts: PrivacyRequestPart[];
  createdAt: string;
}

export interface RetentionRuleResponse {
  id: RetentionRuleId;
  enabled: boolean;
  days: number;
  choices: number[];
  /** False when the feature it tidies isn't switched on: the rule still shows, dimmed. */
  applies: boolean;
  /** How many items the next run would delete (or anonymise, for orders) right now. */
  dueNow: number;
  /** When the next item after those becomes due, as an ISO date, or null. */
  nextDueAt: string | null;
}

export interface RetentionResponse {
  rules: RetentionRuleResponse[];
}

export interface ProcessorResponse {
  id: string;
  name: string;
  purpose: string;
  location: string;
  link: string;
  /** "detected" when Lintel found it in what the site uses; "added" when the owner typed it. */
  origin: "detected" | "added";
}

export interface ProcessorsResponse {
  detected: ProcessorResponse[];
  added: ProcessorResponse[];
}

export interface PolicySection {
  id: string;
  heading: string;
  text: string;
}

export interface PolicyHelperResponse {
  sections: PolicySection[];
  /** The whole draft as plain text, for the copy button. */
  draft: string;
  privacyPage: { id: string; title: string } | null;
  /**
   * Things in use the privacy page doesn't seem to mention, by name: "Stripe", "YouTube".
   * A simple check for the words, so it can miss things; empty without a page.
   */
  notMentioned: string[];
}
