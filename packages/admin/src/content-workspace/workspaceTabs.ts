/**
 * What an entry shows, from the address (`?tab=children`): its own fields, or the items
 * listed under it (a Blog page's posts). Settings, history and details live in the editor's
 * side panel and menu now, so older addresses with those tabs just open the fields.
 */
export const workspaceTabs = ["content", "children"] as const;
export type WorkspaceTab = (typeof workspaceTabs)[number];

/** A tab name from the address, or undefined for one that isn't a tab. */
export function readWorkspaceTab(value: unknown): WorkspaceTab | undefined {
  return workspaceTabs.find((tab) => tab === value);
}
