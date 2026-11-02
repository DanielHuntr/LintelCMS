import { apiRequest } from "../api/client.js";
import type { Field } from "../fields/field.types.js";

/** A saved set of fields reused by Fieldset fields. Matches the API's `Fieldset`. */
export interface Fieldset {
  id: string;
  handle: string;
  name: string;
  fields: Field[];
  /** The content types and global sets that use it, by name. */
  usedBy: string[];
  updatedAt: string;
}

/** Calls to the API's fieldset routes. One function per route. */

export async function listFieldsets(): Promise<Fieldset[]> {
  const { fieldsets } = await apiRequest<{ fieldsets: Fieldset[] }>("/fieldsets");
  return fieldsets;
}

const fieldsetPath = (handle: string) => `/fieldsets/${encodeURIComponent(handle)}`;

export function getFieldset(handle: string): Promise<Fieldset> {
  return apiRequest<Fieldset>(fieldsetPath(handle));
}

export function createFieldset(fieldset: { handle: string; name: string }): Promise<Fieldset> {
  return apiRequest<Fieldset>("/fieldsets", { method: "POST", body: fieldset });
}

export function updateFieldset(
  handle: string,
  changes: { name: string; fields: Field[]; renames?: Array<{ from: string; to: string }> },
): Promise<Fieldset> {
  return apiRequest<Fieldset>(fieldsetPath(handle), { method: "PUT", body: changes });
}

export function deleteFieldset(handle: string): Promise<void> {
  return apiRequest<void>(fieldsetPath(handle), { method: "DELETE" });
}
