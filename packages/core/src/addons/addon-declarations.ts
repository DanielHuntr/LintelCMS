import { z } from "zod";

/**
 * What an add-on (or a plugin) says about itself so site owners can see what it does before
 * and after installing it: the data it keeps, the addresses it adds to the website, the work
 * it does by itself and who it talks to. An add-on writes this in its package.json's
 * `lintel-addon` section, so it can be read before any of its code runs; a plugin from
 * lintel.config.ts gives the same thing to `definePlugin` as `declares`.
 *
 * Lintel checks what it can at runtime (the tables really in the database, the jobs, events
 * and permissions the code registers) and the Add-ons screen marks each item "Checked by
 * Lintel" or "Says the add-on". `tables` is also what backups use to include an add-on's
 * own data, and what the privacy tools read to find a person's data.
 */

const plainText = z.string().trim().min(1).max(300);
const handle = z.string().trim().min(1).max(120);

/** One column: its database name, what it holds, and whether that is personal data. */
export const declaredColumnSchema = z.object({
  name: handle,
  purpose: plainText,
  /** Names, email addresses, phone numbers, notes about a person, addresses (IP too). */
  personalData: z.boolean().optional(),
});

/** One of the add-on's own tables: its name in the database, what it is for, its columns. */
export const declaredTableSchema = z.object({
  name: z
    .string()
    .regex(/^[a-z][a-z0-9_]*$/, { error: "table names are lowercase letters, numbers and _" }),
  purpose: plainText,
  columns: z.array(declaredColumnSchema).default([]),
});

/** An address the add-on answers on without signing in, under the API: "/bookings/slots". */
export const declaredRouteSchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  path: z.string().trim().startsWith("/").max(300),
  purpose: plainText,
});

/** Background work, by the job's id in `definePlugin`'s `jobs`. */
export const declaredJobSchema = z.object({ id: handle, purpose: plainText });

/** Something it does when something happens, by event name: "form.submitted". */
export const declaredEventSchema = z.object({ event: handle, purpose: plainText });

/** Another company or server it sends to or loads from: "api.stripe.com". */
export const declaredHostSchema = z.object({
  host: z
    .string()
    .trim()
    .regex(/^[a-z0-9.-]+$/i, { error: "hosts are written like api.example.com" }),
  purpose: plainText,
});

export const addonDeclarationsSchema = z.object({
  tables: z.array(declaredTableSchema).default([]),
  publicRoutes: z.array(declaredRouteSchema).default([]),
  jobs: z.array(declaredJobSchema).default([]),
  events: z.array(declaredEventSchema).default([]),
  hosts: z.array(declaredHostSchema).default([]),
});

export type DeclaredColumn = z.output<typeof declaredColumnSchema>;
export type DeclaredTable = z.output<typeof declaredTableSchema>;
export type DeclaredRoute = z.output<typeof declaredRouteSchema>;
export type AddonDeclarations = z.output<typeof addonDeclarationsSchema>;
/** As written by hand, with every list optional. */
export type AddonDeclarationsInput = z.input<typeof addonDeclarationsSchema>;

export const noDeclarations: AddonDeclarations = addonDeclarationsSchema.parse({});
