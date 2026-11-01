import { listAllFieldtypes } from "./fieldtypes.registry.js";
import type { FieldtypeList } from "./fieldtypes.schema.js";

/**
 * Fieldtypes are code, not data, so there is no repository: the list comes straight
 * from the registry.
 */
export function listFieldtypes(): FieldtypeList {
  return {
    fieldtypes: listAllFieldtypes().map(({ fieldtype, pluginId }) => ({
      type: fieldtype.type,
      name: fieldtype.name,
      description: fieldtype.description,
      category: fieldtype.category,
      keywords: [...fieldtype.keywords],
      holdsValue: fieldtype.holdsValue,
      canBeInside: fieldtype.canBeInside,
      plugin: pluginId,
    })),
  };
}
