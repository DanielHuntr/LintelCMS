/** The builder's words for several elements selected at once. */
export const multiSelectStrings = {
  "pageBuilder.multi.count": "{count} selected",
  "pageBuilder.multi.clear": "Select just one",
  "pageBuilder.multi.mixed": "Mixed",
  "pageBuilder.multi.styleNote":
    "Changes here go to all {count}. Values they don’t share show as Mixed.",
  "pageBuilder.multi.contentNote": "Select one to edit its words.",
  "pageBuilder.multi.animateNote": "The motion you choose goes on all {count}.",
  "pageBuilder.multi.actions": "With all of them",
  "pageBuilder.multi.duplicate": "Duplicate",
  "pageBuilder.multi.delete": "Delete",
  "pageBuilder.multi.group": "Group into a box",
  "pageBuilder.multi.moveUp": "Move up together",
  "pageBuilder.multi.moveDown": "Move down together",
  "pageBuilder.multi.sharedStyle": "Use a shared style",
  "pageBuilder.multi.noSharedStyle": "No shared style",
  "pageBuilder.multi.notAlike":
    "These aren’t built the same way, so they can’t share one component design.",
  "pageBuilder.history.changedMany": "Changed {name} on {count}",
  "pageBuilder.history.animatedMany": "Changed the motion of {count} elements",
  "pageBuilder.history.sharedStyleMany": "Changed the shared style of {count} elements",
  "pageBuilder.history.removedMany": "Deleted {count} elements",
  "pageBuilder.history.duplicatedMany": "Duplicated {count} elements",
  "pageBuilder.history.groupedMany": "Grouped {count} elements into a box",
  "pageBuilder.history.movedMany": "Moved {count} elements",
  "pageBuilder.refused.manyWithSiteSection":
    "The site’s navigation and footer can’t be changed along with other elements. Select them on their own.",
  "pageBuilder.refused.groupNeedsSameParent":
    "Only elements side by side in the same place can be grouped or moved together.",
  "pageBuilder.refused.cantMoveFurther": "They can’t move further that way.",
} as const;
