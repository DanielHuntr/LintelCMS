/** The builder's words for the site's own blocks: making one, using one, editing its design. */
export const builderBlockStrings = {
  "pageBuilder.blocks.make": "Make into a component",
  "pageBuilder.blocks.makeHint":
    "Save this design as one of your site’s components, to use again on any page. Editors fill in its details; the design stays the same everywhere.",
  "pageBuilder.blocks.makeTitle": "Make “{name}” into a component",
  "pageBuilder.blocks.mapTitle": "Choose what editors can change",
  "pageBuilder.blocks.name": "Name",
  "pageBuilder.blocks.namePlaceholder": "Team card",
  "pageBuilder.blocks.icon": "Icon",
  "pageBuilder.blocks.category": "Group in Insert",
  "pageBuilder.blocks.categoryHint": "Components with the same group are listed together.",
  "pageBuilder.blocks.categoryPlaceholder": "Team",
  "pageBuilder.blocks.parts": "What editors can change",
  "pageBuilder.blocks.partsHint":
    "Tick the parts people should fill in each time they use the component, and name them the way they’ll see them. Everything else stays exactly as designed.",
  "pageBuilder.blocks.noParts":
    "This design has nothing editors could change. It can still be a component that looks the same everywhere.",
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
  "pageBuilder.blocks.create": "Make component",
  "pageBuilder.blocks.creating": "Making the component…",
  "pageBuilder.blocks.saveMapping": "Save",
  "pageBuilder.blocks.cancel": "Cancel",
  "pageBuilder.blocks.nameMissing": "Give the component a name.",
  "pageBuilder.blocks.cantMakePage":
    "The page itself can’t be a component. Select a section or box on it.",
  "pageBuilder.blocks.cantMakeWithBlock":
    "This has one of your components inside it. Components can’t hold other components: detach that one first.",
  "pageBuilder.history.madeBlock": "Made {name} into a component",
  "pageBuilder.history.remappedBlock": "Changed what editors can change",
  "pageBuilder.history.detachedBlock": "Detached {name} from its component",
  "pageBuilder.history.changedBlockValues": "Changed {name}",

  "pageBuilder.blocks.instanceOf": "{name} component",
  "pageBuilder.blocks.instanceHint":
    "This component’s design is shared by every page that uses it. Fill in its details here.",
  "pageBuilder.blocks.definedInCode": "Defined in code",
  "pageBuilder.blocks.definedInCodeHint":
    "A developer looks after this component’s design in the site’s code.",
  "pageBuilder.blocks.fromPlugin": "Added by a feature",
  "pageBuilder.blocks.missing":
    "This component isn’t on the site any more, so it shows nothing on the website. Delete it, or ask whoever removed it.",
  "pageBuilder.blocks.editDesign": "Edit component design",
  "pageBuilder.blocks.editDesignHint":
    "Changes to the design show on every page that uses this component.",
  "pageBuilder.blocks.detach": "Detach from component",
  "pageBuilder.blocks.detachTitle": "Detach this from {name}?",
  "pageBuilder.blocks.detachMessage":
    "It becomes ordinary elements you can change freely, with what’s filled in now. Later changes to the component won’t reach it any more.",
  "pageBuilder.blocks.detachConfirm": "Detach",
  "pageBuilder.blocks.noProperties": "This component has nothing to fill in.",
  "pageBuilder.blocks.propertyUnsupported": "{label} is changed from the component’s settings.",
  "pageBuilder.blocks.designOf": "Design of the {name} component",
  "pageBuilder.blocks.mapButton": "Choose what editors can change",
  "pageBuilder.content.bind.blockScope": "Component",

  "pageBuilder.components.variants": "Variants",
  "pageBuilder.components.makeSimilar": "Make these {count} one component",
  "pageBuilder.components.similarIntro":
    "The first becomes the component. Each one turns into an instance of it and keeps its own words, pictures and links. Layout, styles and animation are shared, so a change to one reaches all.",
  "pageBuilder.components.similarParts": "Filled in separately",
  "pageBuilder.components.similarNoParts": "They’re all the same, so there’s nothing to fill in.",
  "pageBuilder.components.similarMore": "and {count} more",
  "pageBuilder.components.similarMotion": "{names} will move the same way on all of them.",
  "pageBuilder.components.similarNotKept":
    "{names} can’t be kept separately, because they aren’t all in your media library. Every one will show the first one’s.",
  "pageBuilder.components.similarUndo": "You can undo this in one step.",
  "pageBuilder.history.madeSimilar": "Made {count} elements into {name}",
  "pageBuilder.history.changedVariant": "Changed {name}’s variant",
  "pageBuilder.components.sharedStyleHint": "Want changes inside these to follow too?",
  "pageBuilder.components.sharedStyleHintAction": "Make them a component",
  "pageBuilder.components.switcherLabel": "Variant to show and change",
  "pageBuilder.components.changesGoTo": "Changes go to {target}",
  "pageBuilder.components.changesGoToAll": "Changes go to every variant",
  "pageBuilder.components.addVariants": "Add variants",
  "pageBuilder.components.editVariants": "Edit variants",
  "pageBuilder.components.variantsTitle": "Variants of {name}",
  "pageBuilder.components.variantsIntro":
    "Each is a choice people make when they use the component, such as Size or Style. Then pick a variant above the canvas and change how it looks.",
  "pageBuilder.components.variantName": "Name",
  "pageBuilder.components.variantNamePlaceholder": "Size",
  "pageBuilder.components.variantChoices": "Choices",
  "pageBuilder.components.variantChoicesPlaceholder": "Small, Medium, Large",
  "pageBuilder.components.variantChoicesHint":
    "Separate them with commas. The first is where it starts.",
  "pageBuilder.components.addVariant": "Add a variant",
  "pageBuilder.components.removeVariant": "Remove {name}",
  "pageBuilder.components.clientsMayChoose": "Clients can choose variants",
  "pageBuilder.components.variantsDone": "Done",
  "pageBuilder.components.variantNeedsName": "Give each variant a name.",
  "pageBuilder.components.variantNeedsChoices": "{name} needs at least two different choices.",
  "pageBuilder.components.variantsLostLooks":
    "Looks made for choices you removed are forgotten when you press Done.",
} as const;
