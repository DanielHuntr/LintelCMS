/**
 * The words for choosing several pages at once (in the tree and in the list), the Tree and
 * List views of a folder, and starting from a template on a site that has pages. Spread into
 * `strings.ts`, so they are used through `t()` like every other string.
 */
export const treeSelectionStrings = {
  "tree.selection.count": "{count, plural, one {# selected} other {# selected}}",
  "tree.selection.toolbar": "Actions for the {count} selected",
  "tree.selection.publish": "Publish",
  "tree.selection.unpublish": "Unpublish",
  "tree.selection.move": "Move…",
  "tree.selection.delete": "Delete…",
  "tree.selection.clear": "Clear",
  "tree.selection.hint": "Ctrl- or ⌘-click to pick more, Shift-click for a run. Esc clears.",
  "tree.selection.selectedState": "selected",
  "tree.selection.published": "{count, plural, one {Published # page.} other {Published # pages.}}",
  "tree.selection.unpublished":
    "{count, plural, one {Unpublished # page.} other {Unpublished # pages.}}",
  "tree.selection.moved": "{count, plural, one {Moved # page.} other {Moved # pages.}}",
  "tree.selection.nothing": "Nothing needed changing.",
  "tree.selection.someSkipped":
    "{count, plural, one {# was left as it is:} other {# were left as they are:}}",

  "bulkDelete.title": "{count, plural, one {Delete # page?} other {Delete # pages?}}",
  "bulkDelete.loading": "Counting what’s inside…",
  "bulkDelete.intro": "These go to the recycle bin, with everything inside them:",
  "bulkDelete.under": "{count, plural, one {and # page inside} other {and # pages inside}}",
  "bulkDelete.total":
    "{count, plural, one {# page in all. You can bring it back from the recycle bin.} other {# pages in all. You can bring them back from the recycle bin.}}",
  "bulkDelete.confirm": "Move to recycle bin",
  "bulkDelete.done":
    "{count, plural, one {Moved # page to the recycle bin.} other {Moved # pages to the recycle bin.}}",
  "bulkDelete.undo": "Undo",
  "bulkDelete.undone": "{count, plural, one {Brought # page back.} other {Brought # pages back.}}",

  "folderView.label": "Show as",
  "folderView.tree": "Tree",
  "folderView.list": "List",
  "folderView.treeTitle": "{name} are in the tree",
  "folderView.treeDescription":
    "Open pages from the tree on the left, and drag them to change their order. To work on many at once, choose List, or Ctrl- or ⌘-click pages in the tree.",
  "folderView.showList": "Show as list",
  "collectionView.allLevels": "Every level",
  "collectionView.column.address": "Address",
  "collectionView.column.type": "Type",
  "collectionView.type": "Type",
  "collectionView.type.all": "All types",

  "templates.existing.title": "Your site already has pages",
  "templates.existing.description":
    "{count, plural, one {You have # page.} other {You have # pages.}} What should happen to them?",
  "templates.existing.loading": "Looking at your pages…",
  "templates.existing.alongside": "Add them alongside",
  "templates.existing.alongsideHint":
    "Your pages stay as they are. Your home page stays the home page, and the template’s other pages go under it.",
  "templates.existing.alongsideClashes":
    "{count, plural, one {# page has the same name as one of yours and is added as “{example} (2)”.} other {# pages have the same names as yours and are added as “{example} (2)” and so on.}}",
  "templates.existing.homeSkipped": "The template’s home page isn’t added; your home page stays.",
  "templates.existing.replace": "Replace my pages",
  "templates.existing.replaceHint":
    "Your pages go to the recycle bin, where you can bring them back, and the template’s pages take their place.",
  "templates.existing.replaceNotAllowed": "You need permission to delete pages to replace them.",
  "templates.existing.choose": "What should happen to your pages",
  "templates.result.skippedHome": "Your home page stayed as it was.",
  "templates.result.goneLinks":
    "Your menu or footer still has a link to a page that’s gone: {links}. Change it in the page builder.",
  "templates.result.leftover":
    "{names} from an earlier template stayed in Content, in case you’ve added your own. You can delete them there.",
  "templates.result.featuresOn": "This template needs {features}, so we switched it on.",
  "templates.result.replaced":
    "{count, plural, one {# page went to the recycle bin.} other {# pages went to the recycle bin.}}",
} as const;
