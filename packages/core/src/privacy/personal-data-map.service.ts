import {
  isSourceInUse,
  listPersonalDataSources,
  type PrivacyContext,
} from "./personal-data-sources.js";
import type { PersonalDataMapResponse } from "./privacy.schema.js";

/**
 * Where personal data lives on this site, worked out from what it actually has: Lintel's own
 * kinds, and each plugin's and add-on's from what they declare. Kinds whose feature is
 * switched off are still listed, last, because switching a feature off deletes nothing.
 */
export function describePersonalDataMap(context: PrivacyContext): PersonalDataMapResponse {
  const kinds = listPersonalDataSources(context).map((source) => ({
    id: source.id,
    name: source.name,
    description: source.description,
    from: source.from,
    inUse: isSourceInUse(source, context.enabledPlugins),
    searchable: source.hooks !== null,
    notSearchableReason: source.notSearchableReason,
    erasure: source.erasure,
    tables: source.tables,
  }));
  return {
    kinds: [...kinds.filter((kind) => kind.inUse), ...kinds.filter((kind) => !kind.inUse)],
  };
}
