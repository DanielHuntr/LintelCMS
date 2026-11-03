/**
 * The builder's words for content-only editing: the designer's "What clients can change"
 * and the client's own view of a page. Part of `builderStrings`.
 */
export const builderClientEditingStrings = {
  "pageBuilder.clientAccess.title": "What clients can change",
  "pageBuilder.clientAccess.words": "Words",
  "pageBuilder.clientAccess.pictures": "Pictures",
  "pageBuilder.clientAccess.links": "Links",
  "pageBuilder.clientAccess.nothing": "Nothing",
  "pageBuilder.clientAccess.summary.nothing": "Nothing",
  "pageBuilder.clientAccess.reset": "Use the usual",
  "pageBuilder.clientAccess.repeats": "Clients can add more of these",
  "pageBuilder.clientAccess.repeatsHint": "They can copy and remove {name} items here.",
  "pageBuilder.clientAccess.history": "Changed what clients can change on {name}",

  "pageBuilder.clientView.badge": "Editing content",
  "pageBuilder.clientView.panelLabel": "Content",
  "pageBuilder.clientView.empty.title": "Change what you see",
  "pageBuilder.clientView.empty.text":
    "Double-click any words on the page to type. Click a picture or a button to change it.",
  "pageBuilder.clientView.locked":
    "{name} is part of the design, so it stays as it is. Ask your designer if it needs to change.",
  "pageBuilder.clientView.replacePicture": "Replace picture",
  "pageBuilder.clientView.items": "Items",
  "pageBuilder.clientView.addAnother": "Add another",
  "pageBuilder.clientView.remove": "Remove this one",
  "pageBuilder.clientView.added": "Added another {name}",
  "pageBuilder.clientView.removed": "Removed {name}",
  "pageBuilder.clientView.keepOne": "One has to stay, so there’s something to copy.",
  "pageBuilder.clientView.emptyPage":
    "This page hasn’t been designed yet. Your designer will lay it out first.",

  "pageBuilder.clientTour.page.title": "This is your page",
  "pageBuilder.clientTour.page.text":
    "It looks just as visitors will see it. Double-click any words to change them, and click a picture to replace it.",
  "pageBuilder.clientTour.panel.title": "Everything you can change",
  "pageBuilder.clientTour.panel.text":
    "Pick something on the page and its words, picture or link show here. Parts of the design stay as they are.",
  "pageBuilder.clientTour.history.title": "Changed your mind?",
  "pageBuilder.clientTour.history.text":
    "Undo takes back your last change, and History lists them all. Changes save by themselves.",
  "pageBuilder.clientTour.publish.title": "When you’re ready",
  "pageBuilder.clientTour.publish.text":
    "Publish puts your changes on the site. If your site team checks changes first, you’ll see Send for review instead.",
} as const;
