/** The admin's words for the site's own blocks: the Blocks screens, their design, blocks fields. */
export const blockStrings = {
  "blocks.title": "Your site’s blocks",
  "blocks.subtitle":
    "Designs you use again and again, such as a team card or a call to action. Editors fill in their details; the design stays the same everywhere.",
  "blocks.loading": "Loading blocks",
  "blocks.emptyTitle": "No blocks yet",
  "blocks.emptyDescription":
    "Open a page in the builder, select something you’ve designed and choose Make into a block. It then appears in Insert, ready for any page.",
  "blocks.openDesign": "Go to Design",
  "blocks.footer":
    "Blocks are offered in the builder’s Insert panel under “Your site’s blocks”, and in content types’ blocks fields.",
  "blocks.source.site": "Made here",
  "blocks.source.code": "Defined in code",
  "blocks.source.plugin": "Added by a feature",
  "blocks.usedOn": "{count, plural, =0 {Not used yet} one {On # page} other {On # pages}}",
  "blocks.propertyCount":
    "{count, plural, =0 {Nothing to fill in} one {# detail to fill in} other {# details to fill in}}",
  "blocks.back": "Your site’s blocks",
  "blocks.details": "Name and place in Insert",
  "blocks.name": "Name",
  "blocks.icon": "Icon",
  "blocks.category": "Group in Insert",
  "blocks.categoryHint": "Blocks with the same group are listed together.",
  "blocks.description": "Description",
  "blocks.descriptionHint": "One sentence for Insert: what the block is for.",
  "blocks.properties": "What editors fill in",
  "blocks.propertiesHint":
    "Each of these is a field in the block’s form. Help text, width, rules and when a field shows work as in content types.",
  "blocks.removePropertyMessage":
    "Pages that filled this in will lose it when you save. You’ll be asked first if any did.",
  "blocks.preview": "How it looks",
  "blocks.previewHint": "The design with what each field holds when it’s left empty.",
  "blocks.editDesign": "Edit design",
  "blocks.whereUsed": "Where it’s used",
  "blocks.notUsed": "No page uses this block yet.",
  "blocks.inContentTypes": "Offered in the blocks fields of {names}.",
  "blocks.save": "Save",
  "blocks.saving": "Saving…",
  "blocks.saved": "Saved. Every page using this block shows the change.",
  "blocks.delete": "Delete block",
  "blocks.deleteTitle": "Delete {name}?",
  "blocks.deleteMessage": "It will no longer be offered in Insert. This can’t be undone.",
  "blocks.deleteInUseTitle": "{name} is on {count, plural, one {# page} other {# pages}}",
  "blocks.deleteInUseMessage":
    "To delete it, its instances become ordinary elements on those pages: they look exactly the same, but later changes to the block won’t reach them.",
  "blocks.deleteAndConvert": "Make them ordinary and delete",
  "blocks.removalTitle": "Remove what pages filled in?",
  "blocks.removalMessage":
    "Removing {properties} takes what was filled in out of these pages: {pages}. Pages keep everything else.",
  "blocks.removalConfirm": "Remove and save",
  "blocks.readOnly":
    "This block is defined in code. A developer changes it in content-model/blocks/; here you can see what it offers and where it’s used.",
  "blocks.readOnlyPlugin":
    "This block comes with a feature that’s switched on. It can be used on any page, but not changed.",
  "blocks.newBlockMade": "Saved {name}. Find it in Insert under Your site’s blocks.",
  "blocks.designTitle": "Design of {name}",
  "blocks.designBack": "Back to {name}",
  "blocks.designSave": "Save design",
  "blocks.designSaved": "Saved",
  "blocks.designUnsaved": "Not saved yet",
  "blocks.designReadOnly": "Defined in code: this design can’t be changed here.",
  "blocks.designFailed": "Couldn’t save: {message}",
  "blocks.blocksLink": "Your site’s blocks",
  "blocks.blocksLinkHint": "Reusable designs editors fill in",

  "builder.blocks.addSiteBlock": "Add one of your site’s blocks",
  "builder.blocks.siteBlock": "Your block: {name}",
  "builder.blocks.siteBlockHint":
    "Its fields are the block’s details, and it looks exactly as designed. Change it under Design → Your site’s blocks.",
  "builder.blocks.noSiteBlocks": "Your site has no blocks yet",
  "blocksField.preview": "Preview",
  "blocksField.previewLabel": "How {name} will look",
} as const;
