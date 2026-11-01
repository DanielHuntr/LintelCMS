import { apiRequest } from "../api/client.js";
import type { Field } from "../fields/field.types.js";
import type { Blueprint, FieldtypeDescription } from "./blueprints.types.js";

/** Calls to the content API's blueprint and fieldtype routes. */

export async function listBlueprints(): Promise<Blueprint[]> {
  const { blueprints } = await apiRequest<{ blueprints: Blueprint[] }>("/blueprints");
  return blueprints;
}

export function getBlueprint(handle: string): Promise<Blueprint> {
  return apiRequest<Blueprint>(`/blueprints/${encodeURIComponent(handle)}`);
}

export function createBlueprint(blueprint: {
  handle: string;
  name: string;
  fields: Field[];
}): Promise<Blueprint> {
  return apiRequest<Blueprint>("/blueprints", { method: "POST", body: blueprint });
}

export function updateBlueprint(
  handle: string,
  changes: { name: string; fields: Field[] },
): Promise<Blueprint> {
  return apiRequest<Blueprint>(`/blueprints/${encodeURIComponent(handle)}`, {
    method: "PUT",
    body: changes,
  });
}

export async function listFieldtypes(): Promise<FieldtypeDescription[]> {
  const { fieldtypes } = await apiRequest<{ fieldtypes: FieldtypeDescription[] }>("/fieldtypes");
  return fieldtypes;
}
