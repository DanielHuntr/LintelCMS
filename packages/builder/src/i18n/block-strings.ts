/** The builder's words for the site's own blocks: making one, using one, editing its design. */
export const builderBlockStrings = {
  "pageBuilder.blocks.make": "Make into a block",
  "pageBuilder.blocks.makeHint":
    "Save this design as one of your site’s blocks, to use again on any page. Editors fill in its details; the design stays the same everywhere.",
  "pageBuilder.blocks.makeTitle": "Make “{name}” into a block",
  "pageBuilder.blocks.mapTitle": "Choose what editors can change",
  "pageBuilder.blocks.name": "Name",
  "pageBuilder.blocks.namePlaceholder": "Team card",
  "pageBuilder.blocks.icon": "Icon",
  "pageBuilder.blocks.category": "Group in Insert",
  "pageBuilder.blocks.categoryHint": "Blocks with the same group are listed together.",
  "pageBuilder.blocks.categoryPlaceholder": "Team",
  "pageBuilder.blocks.parts": "What editors can change",
  "pageBuilder.blocks.partsHint":
    "Tick the parts people should fill in each time they use the block, and name them the way they’ll see them. Everything else stays exactly as designed.",
  "pageBuilder.blocks.noParts":
    "This design has nothing editors could change. It can still be a block that looks the same everywhere.",
  "pageBuilder.blocks.partLabel": "What editors see it called",
  "pageBuilder.blocks.kind.text": "Words",
  "pageBuilder.blocks.kind.multilineText": "Words",
  "pageBuilder.blocks.kind.image": "Picture",
  "pageBuilder.blocks.kind.link": "Link",
  "pageBuilder.blocks.kind.visible": "Show or hide",
  "pageBuilder.blocks.kind.colour": "Colour",
  "pageBuilder.blocks.kind.items": "A list of these",
  "pageBuilder.blocks.partNow": "Now: {value}",
  "pageBuilder.blocks.listNow": "{count} items now; the first is the design of each",
  "pageBuilder.blocks.create": "Make block",
  "pageBuilder.blocks.creating": "Making the block…",
  "pageBuilder.blocks.saveMapping": "Save",
  "pageBuilder.blocks.cancel": "Cancel",
  "pageBuilder.blocks.nameMissing": "Give the block a name.",
  "pageBuilder.blocks.cantMakePage":
    "The page itself can’t be a block. Select a section or box on it.",
  "pageBuilder.blocks.cantMakeWithBlock":
    "This has one of your blocks inside it. Blocks can’t hold other blocks: detach that one first.",
  "pageBuilder.history.madeBlock": "Made {name} into a block",
  "pageBuilder.history.remappedBlock": "Changed what editors can change",
  "pageBuilder.history.detachedBlock": "Detached {name} from its block",
  "pageBuilder.history.changedBlockValues": "Changed {name}",

  "pageBuilder.blocks.instanceOf": "{name} block",
  "pageBuilder.blocks.instanceHint":
    "This block’s design is shared by every page that uses it. Fill in its details here.",
  "pageBuilder.blocks.definedInCode": "Defined in code",
  "pageBuilder.blocks.definedInCodeHint":
    "A developer looks after this block’s design in the site’s code.",
  "pageBuilder.blocks.fromPlugin": "Added by a feature",
  "pageBuilder.blocks.missing":
    "This block isn’t on the site any more, so it shows nothing on the website. Delete it, or ask whoever removed it.",
  "pageBuilder.blocks.editDesign": "Edit block design",
  "pageBuilder.blocks.editDesignHint":
    "Changes to the design show on every page that uses this block.",
  "pageBuilder.blocks.detach": "Detach from block",
  "pageBuilder.blocks.detachTitle": "Detach this from {name}?",
  "pageBuilder.blocks.detachMessage":
    "It becomes ordinary elements you can change freely, with what’s filled in now. Later changes to the block won’t reach it any more.",
  "pageBuilder.blocks.detachConfirm": "Detach",
  "pageBuilder.blocks.noProperties": "This block has nothing to fill in.",
  "pageBuilder.blocks.propertyUnsupported": "{label} is changed from the block’s settings.",
  "pageBuilder.blocks.designOf": "Design of the {name} block",
  "pageBuilder.blocks.mapButton": "Choose what editors can change",
  "pageBuilder.content.bind.blockScope": "Block",
} as const;
