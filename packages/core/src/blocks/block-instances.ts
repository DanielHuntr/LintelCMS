import {
  currentValues,
  customBlockType,
  instanceBlockHandle,
  instanceValues,
  type PageDocument,
  type PageNode,
} from "@lintel/builder-model";
import type { FieldMessages } from "../http/http-errors.js";
import type {
  BlockCheckLibrary,
  CheckFieldValues,
  NestedCheckResult,
} from "../fieldtypes/fieldtype.js";

/**
 * Checks every instance of the site's blocks in a page design when it is saved: its block
 * must exist, and its values must pass the block's properties with the same rules as an
 * entry's fields (required, validation, conditions...). Values are stored under the
 * properties' current handles, and values of properties the block no longer has are dropped.
 *
 * Problems name the instance the way Layers does: `Design: Team card 2: Name is required`.
 */
export async function checkBlockInstances(
  document: PageDocument,
  label: string,
  checkFieldValues: CheckFieldValues,
  library: BlockCheckLibrary | undefined,
): Promise<NestedCheckResult> {
  if (!library) return { value: document, messages: {} };
  const messages: FieldMessages = {};
  const counts = new Map<string, number>();

  const visit = async (node: PageNode): Promise<PageNode> => {
    const children = await Promise.all(node.children.map(visit));
    const checked = children.some((child, index) => child !== node.children[index])
      ? { ...node, children }
      : node;
    if (node.type !== customBlockType) return checked;
    const handle = instanceBlockHandle(node) ?? "";
    const block = library.find(handle);
    const count = (counts.get(handle) ?? 0) + 1;
    counts.set(handle, count);
    const where = `${node.name || block?.name || handle} ${count}`;
    if (!block) {
      messages[node.id] = `${where}: the site has no “${handle}” block any more`;
      return checked;
    }
    const values = currentValues(instanceValues(node), block.renamedProperties);
    const result = await checkFieldValues(block.properties, values);
    const [first] = Object.entries(result.messages);
    if (first) messages[`${node.id}.${first[0]}`] = `${where}: ${first[1]}`;
    return { ...checked, props: { ...checked.props, values: result.values } };
  };

  const root = await visit(document.root);
  const [summary, ...others] = Object.values(messages);
  if (summary) {
    messages[""] =
      others.length === 0
        ? `${label}: ${summary}`
        : `${label}: ${summary}, and ${others.length} more`;
  }
  return { value: { ...document, root }, messages };
}
