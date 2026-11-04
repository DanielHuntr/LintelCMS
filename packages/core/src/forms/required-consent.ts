import type { DatabaseOrTransaction } from "../database/client.js";
import { findEnabledPluginIds } from "../plugins/plugins.service.js";
import type { FormField } from "./form-fields.schema.js";

/**
 * Consent boxes a plugin needs on a form for the moment. A plugin that passes people on to
 * someone else can say a form has to ask first, and the form asks however it was set up: the
 * box is added while the form is drawn and checked, so the saved form isn't changed. Declared
 * with `formConsent` in `definePlugin`, and read only while the plugin is switched on.
 */

/** The words for a box the form must have, or null when it needs none. */
export type PluginFormConsent = (
  form: { handle: string },
  database: DatabaseOrTransaction,
) => Promise<string | null>;

const readersByPlugin = new Map<string, PluginFormConsent>();

export function registerPluginFormConsent(
  pluginId: string,
  read: PluginFormConsent | undefined,
): void {
  if (read) readersByPlugin.set(pluginId, read);
}

/**
 * A form's fields with what plugins ask for: a consent box the form already has becomes
 * required, and a form without one gets one at the end.
 */
export async function withRequiredConsent(
  database: DatabaseOrTransaction,
  form: { handle: string; fields: readonly FormField[] },
): Promise<readonly FormField[]> {
  if (readersByPlugin.size === 0) return form.fields;
  const wording = await findRequiredWording(database, form.handle);
  if (wording === null) return form.fields;

  const box = form.fields.find((field) => field.type === "consent");
  if (box) {
    return form.fields.map((field) => (field === box ? { ...field, required: true } : field));
  }
  const handle = freeHandle(form.fields);
  return [
    ...form.fields,
    {
      id: handle,
      type: "consent",
      handle,
      label: wording,
      helpText: "",
      placeholder: "",
      required: true,
      options: {},
    },
  ];
}

async function findRequiredWording(
  database: DatabaseOrTransaction,
  handle: string,
): Promise<string | null> {
  for (const pluginId of await findEnabledPluginIds(database)) {
    const wording = await readersByPlugin.get(pluginId)?.({ handle }, database);
    if (wording) return wording;
  }
  return null;
}

function freeHandle(fields: readonly FormField[]): string {
  const taken = new Set(fields.map((field) => field.handle));
  let handle = "consent";
  while (taken.has(handle)) handle = `${handle}_box`;
  return handle;
}
