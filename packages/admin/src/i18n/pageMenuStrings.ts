/**
 * The words for putting pages in menus: "In the main menu" on a page, menus that follow the
 * page tree, the menu editor's page picker, buttons and preview, and editing a menu from the
 * page builder. Spread into `strings.ts`, so they are used through `t()` like every other
 * string.
 */
export const pageMenuStrings = {
  "pageMenu.toggle": "In the main menu",
  "pageMenu.toggleHint": "Adds a link to this page in your site’s main menu.",
  "pageMenu.heading": "Menu",
  "pageMenu.label": "Menu label",
  "pageMenu.labelHint": "Leave empty to use the page’s name.",
  "pageMenu.saved": "Saved",
  "pageMenu.followsTree":
    "The main menu follows the page tree, so this page shows up there by itself.",
  "pageMenu.openMenu": "Open the main menu",
  "pageMenu.noMenu": "This site has no main menu. Make one in Content → Menus.",
  "pageMenu.loading": "Checking the main menu…",
  "pageMenu.couldNotSave": "The menu couldn’t be changed: {reason}",

  "menus.source": "How this menu is made",
  "menus.source.items": "I arrange it",
  "menus.source.pageTree": "Follow the page tree",
  "menus.source.pageTreeHint":
    "Shows your home page, then the pages under it in the tree’s order. Pages under those become drop-downs.",
  "menus.source.itemsHint": "Add pages and links, then drag them into the order you want.",
  "menus.source.toTreeTitle": "Follow the page tree?",
  "menus.source.toTreeMessage":
    "The menu will show your pages as they are in the tree, and change when the tree does. The links you arranged are kept, so you can switch back.",
  "menus.source.toTreeConfirm": "Follow the page tree",
  "menus.source.toItemsTitle": "Arrange this menu yourself?",
  "menus.source.toItemsMessage":
    "The menu keeps the pages it shows now, and you can change them as you like. It won’t follow the tree any more.",
  "menus.source.toItemsConfirm": "Arrange it myself",
  "menus.tree.includeHome": "Start with the home page",
  "menus.tree.hide": "Hide {label} from this menu",
  "menus.tree.rename": "Rename {label} in this menu",
  "menus.tree.hidden": "Hidden from this menu",
  "menus.tree.show": "Show {label}",
  "menus.tree.empty": "No pages yet",
  "menus.tree.emptyDescription":
    "Create your home page and the pages under it, and they show up here by themselves.",
  "menus.tree.renameTitle": "Name in the menu",
  "menus.tree.levelsNote":
    "{count, plural, one {Shows # level.} other {Shows # levels.}} Change it in Menu settings.",

  "menus.addPages": "Add pages",
  "menus.addLink": "Add link",
  "menus.addPages.title": "Add pages to {name}",
  "menus.addPages.search": "Find a page",
  "menus.addPages.loading": "Loading your pages…",
  "menus.addPages.inMenu": "Already in the menu",
  "menus.addPages.empty": "There are no pages yet.",
  "menus.addPages.confirm": "{count, plural, =0 {Add pages} one {Add # page} other {Add # pages}}",
  "menus.addPages.selectAll": "Select every page",
  "menus.addPages.note": "Pages under other pages go inside them, as a drop-down.",
  "menus.item.button": "Show as a button",
  "menus.item.buttonHint":
    "For a call to action such as “Book now”. Buttons go at the end of the menu.",
  "menus.item.isButton": "Button",
  "menus.preview": "Preview",
  "menus.preview.description":
    "How the menu looks on your site. Drafts show once they’re published.",
  "menus.preview.empty": "Nothing in the menu yet",
  "menus.preview.draft": "{label} (not published yet)",
  "menus.dragHint":
    "Drag up and down to reorder, or to the right to put an item inside the one above.",

  "builderMenu.title": "Editing {name}",
  "builderMenu.done": "Done",
  "builderMenu.saving": "Saving…",
  "builderMenu.saved": "Saved. Every page with this menu shows the change.",
  "builderMenu.openFull": "Open in Menus",
  "builderMenu.loading": "Loading the menu…",
  "builderMenu.followsTree":
    "This menu follows the page tree. Hide pages or rename them here, or arrange it yourself in Menus.",
} as const;
