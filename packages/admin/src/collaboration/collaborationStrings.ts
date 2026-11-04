/** The words for working together on a page. Spread into `i18n/strings.ts`. */
export const collaborationStrings = {
  "collab.alsoHere.one": "{name} is also on this page",
  "collab.alsoHere.many": "{count} other people are on this page",
  "collab.alsoHere.heading": "Also on this page",
  "collab.where.design": "In the designer",
  "collab.where.content": "Editing content",
  "collab.onThisPage": "On this page now: {names}",
  "collab.reconnecting": "Reconnecting…",
  "collab.reconnecting.more":
    "Your changes are safe on this screen and will be merged when the connection comes back.",
  "collab.editingField": "{name} is editing this",
  "collab.conflict.title": "{name} changed this while you were working",
  "collab.conflict.titleSomeone": "This changed while you were working",
  "collab.conflict.both": "You both changed:",
  "collab.conflict.yours": "Yours",
  "collab.conflict.theirs": "{name}’s",
  "collab.conflict.theirsSomeone": "The saved one",
  "collab.conflict.keepMine": "Keep mine",
  "collab.conflict.useTheirs": "Use {name}’s",
  "collab.conflict.useTheirsSomeone": "Use the saved one",
  "collab.conflict.nothingLost":
    "Everything else you each changed stays. The one you don’t choose is kept in History.",
  "collab.field.slug": "The page’s address",
  "collab.field.parent": "Its place in the tree",
  "collab.merged": "{name}’s changes were added to yours.",
  "collab.mergedSomeone": "Changes saved elsewhere were added to yours.",
} as const;
