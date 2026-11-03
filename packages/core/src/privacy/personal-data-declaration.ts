import { z } from "zod";
import type { DatabaseOrTransaction } from "../database/client.js";

/**
 * How a plugin or add-on says what personal data it keeps, and how Settings → Privacy finds,
 * exports and erases one person's. The same shape is read from two places:
 *
 * - `personalData` in `definePlugin({...})`: the tables, and the `find`, `export` and `erase`
 *   hooks that let Privacy search it;
 * - `personalData` in an add-on's `lintel-addon` section of package.json: the tables only,
 *   for add-ons that declare what they keep without code.
 *
 *   personalData: {
 *     description: "The name and email of each person who books.",
 *     tables: [{ name: "bookings", columns: [
 *       { name: "customer_name", personalData: true },
 *       { name: "customer_email", personalData: true },
 *       { name: "starts_at" },
 *     ] }],
 *   }
 *
 * A plugin with tables that holds personal data but has no hooks is listed in Privacy as
 * one that "can't be searched", so the site owner knows to look there by hand.
 */

export const personalDataColumnSchema = z.object({
  /** The column's name in the database: "customer_email". */
  name: z.string().trim().min(1).max(100),
  /** True for a column that can identify someone: a name, email, address, phone, IP address. */
  personalData: z.boolean().default(false),
  /** What it holds, in a few plain words, when the name doesn't say: "Notes they typed". */
  description: z.string().trim().max(200).optional(),
});

export const personalDataTableSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(200).optional(),
  columns: z.array(personalDataColumnSchema).max(200).default([]),
});

export const personalDataDeclarationSchema = z.object({
  /** One plain sentence about whose data it keeps and why: "People who book an appointment." */
  description: z.string().trim().max(300).optional(),
  tables: z.array(personalDataTableSchema).max(100).default([]),
});

export type PersonalDataColumn = z.input<typeof personalDataColumnSchema>;
export type PersonalDataTable = z.input<typeof personalDataTableSchema>;
export type PersonalDataDeclaration = z.output<typeof personalDataDeclarationSchema>;

/**
 * The person being looked for. At least one is given. Email is matched exactly (ignoring
 * case); a name is matched as a whole name (ignoring case and spaces at the ends), never a
 * part of one, so "Ann" never finds "Anne".
 */
export interface PersonLookup {
  email: string | null;
  name: string | null;
}

/** What a plugin's hooks are given. */
export interface PersonalDataHookContext {
  database: DatabaseOrTransaction;
  tenantId: string;
  person: PersonLookup;
}

/** One thing found about the person, for the list in Privacy. */
export interface FoundPersonalData {
  /** The record's id, so the same thing isn't listed twice. */
  id: string;
  /** A short, plain line the site owner recognises: "Booking on 3 Nov 2026 at 10:00". */
  summary: string;
  /** When it was made, as an ISO date, or null. */
  date: string | null;
}

/** What erasing did: rows deleted, rows kept with the personal parts removed, and why. */
export interface PersonalDataErasure {
  deleted: number;
  anonymised?: number;
  /** Rows deliberately left as they were, such as a staff account. */
  kept?: number;
  /** A plain sentence for anything kept or anonymised: "Orders stay for your tax records." */
  explanation?: string;
}

/** The hooks that let Privacy search a plugin's data. Each must cover every table it declares. */
export interface PersonalDataHooks {
  find(context: PersonalDataHookContext): Promise<FoundPersonalData[]>;
  /** Everything held about the person, as plain rows: each becomes a row of a CSV too. */
  export(context: PersonalDataHookContext): Promise<Record<string, unknown>[]>;
  erase(context: PersonalDataHookContext): Promise<PersonalDataErasure>;
}

/** `personalData` in `definePlugin`: the declaration, and optionally the hooks. */
export type PluginPersonalData = z.input<typeof personalDataDeclarationSchema> &
  Partial<PersonalDataHooks>;

/** Whether a plugin's personal data can be searched: all three hooks are there. */
export function hasPersonalDataHooks(
  personalData: PluginPersonalData | undefined,
): personalData is z.input<typeof personalDataDeclarationSchema> & PersonalDataHooks {
  return (
    typeof personalData?.find === "function" &&
    typeof personalData.export === "function" &&
    typeof personalData.erase === "function"
  );
}
