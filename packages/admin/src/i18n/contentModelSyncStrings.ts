/**
 * The words for content types, taxonomies, global sets and menus that are managed in code
 * (src/content-model-sync). `strings.ts` spreads them in, so they're used through `t()`.
 */
export const contentModelSyncStrings = {
  "modelSync.lockedTitle": "Managed in code",
  "modelSync.lockedDescription":
    "Content types, taxonomies, global settings fields and menus on this site are set up by your developer, in the {folder} folder. You can still write and edit all the content; to add a field or a content type, ask your developer.",
  "modelSync.editableTitle": "Saved to code too",
  "modelSync.editableDescription":
    "Changes you make here are also saved to the {folder} folder, so your developer can keep them with the website’s code.",
  "modelSync.pendingTitle": "Changes waiting for you to confirm",
  "modelSync.pendingDescription":
    "Your developer changed the content model. These changes would delete content that’s already written, so nothing has been changed yet.",
  "modelSync.pendingApply": "Make these changes",
  "modelSync.pendingConfirmTitle": "Delete this content?",
  "modelSync.pendingConfirmMessage":
    "The changes will be made and the content listed will be deleted. Entries’ revision history keeps older versions, but the content will no longer be on the site.",
  "modelSync.pendingConfirm": "Make changes",
  "modelSync.cancel": "Cancel",
  "modelSync.problemsTitle": "The content model files have a problem",
  "modelSync.problemsDescription":
    "Until it’s fixed, changes in the files aren’t applied here. Tell your developer what it says:",
  "modelSync.noticeDismiss": "Dismiss",
  "modelSync.noticesLabel": "Content model notices",
} as const;
