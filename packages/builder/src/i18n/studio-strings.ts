/**
 * The builder's words for animating, the guided tour and tips. Part of
 * `builderStrings`, kept in their own file so each list stays easy to read.
 */
export const builderStudioStrings = {
  "pageBuilder.panels.animate": "Animate",
  "pageBuilder.animate.selectSomething":
    "Select something on the page to make it move: a heading, a picture, a whole section.",
  "pageBuilder.animate.lockedNote": "This element is locked. Unlock it in Layers to animate it.",
  "pageBuilder.animate.howTo":
    "Add motion, then choose when it plays: as the page opens, as it scrolls into view, or on hover. Advanced opens the timeline.",
  "pageBuilder.animate.pointer.title": "When the pointer is over it",
  "pageBuilder.animate.pointer.choice": "What happens",
  "pageBuilder.animate.pointer.choice.none": "Nothing changes",
  "pageBuilder.animate.pointer.choice.word": "A word on the cursor",
  "pageBuilder.animate.pointer.choice.follow": "A picture follows it",
  "pageBuilder.animate.pointer.choice.grow": "The cursor grows",
  "pageBuilder.animate.pointer.choice.picture": "The cursor becomes a picture",
  "pageBuilder.animate.pointer.choice.hide": "The cursor hides",
  "pageBuilder.animate.pointer.choice.normal": "The normal pointer",
  "pageBuilder.animate.pointer.word": "Word",
  "pageBuilder.animate.pointer.word.view": "View",
  "pageBuilder.animate.pointer.word.open": "Open",
  "pageBuilder.animate.pointer.word.drag": "Drag",
  "pageBuilder.animate.pointer.word.play": "Play",
  "pageBuilder.animate.pointer.word.read": "Read",
  "pageBuilder.animate.pointer.word.own": "Your own word",
  "pageBuilder.animate.pointer.ownWord": "Your word",
  "pageBuilder.animate.pointer.picture": "Show a picture when hovered",
  "pageBuilder.animate.pointer.pictureField": "Picture",
  "pageBuilder.animate.pointer.changeLook": "Change its look",
  "pageBuilder.animate.pointer.cursorPicture": "Cursor picture",
  "pageBuilder.animate.pointer.pictureLarge":
    "This picture is {size}. A small SVG or PNG (under 64 KB) appears straight away.",
  "pageBuilder.animate.pointer.pictureSize": "Size",
  "pageBuilder.animate.pointer.pictureSize.small": "Small",
  "pageBuilder.animate.pointer.pictureSize.medium": "Medium",
  "pageBuilder.animate.pointer.pictureSize.large": "Large",
  "pageBuilder.animate.pointer.point": "Where it points",
  "pageBuilder.animate.pointer.point.centre": "The middle",
  "pageBuilder.animate.pointer.point.top-left": "Top-left corner",
  "pageBuilder.animate.pointer.needsSiteCursor":
    "Shows once the site has a custom cursor, chosen under Motion across the site.",
  "pageBuilder.animate.pointer.note": "Only with a mouse or trackpad.",
  "pageBuilder.history.animated": "Animated {name}",
  "pageBuilder.history.removedAnimation": "Removed the animation from {name}",
  "pageBuilder.history.changedEffects": "Changed the effects on {name}",

  "pageBuilder.style.howTo":
    "Changes apply to the screen size you’re looking at. Pick Hovered or Pressed above to style those moments.",

  "pageBuilder.help.button": "Help and tips",
  "pageBuilder.help.replayTour": "Replay the tour",
  "pageBuilder.help.showTips": "Show tips again",

  "pageBuilder.tips.dismiss": "Got it",

  "pageBuilder.tour.label": "Guided tour",
  "pageBuilder.tour.progress": "Step {step} of {count}",
  "pageBuilder.tour.next": "Next",
  "pageBuilder.tour.back": "Back",
  "pageBuilder.tour.skip": "Skip the tour",
  "pageBuilder.tour.finish": "Start building",
  "pageBuilder.tour.insert.title": "Add sections and elements",
  "pageBuilder.tour.insert.text":
    "Insert has ready-made sections, including navigation and a footer, and single elements such as headings, pictures and buttons. Layers lists everything on the page, in order.",
  "pageBuilder.tour.canvas.title": "Click to select, double-click to type",
  "pageBuilder.tour.canvas.text":
    "Click anything on your page to select it. Double-click text to type straight into it, and select words to make them bold or a link.",
  "pageBuilder.tour.style.title": "Change how it looks",
  "pageBuilder.tour.style.text":
    "Style changes colours, sizes and spacing. At the top, pick which look you’re changing: as it normally is, or while it’s hovered or pressed.",
  "pageBuilder.tour.siteStyles.title": "Styles for the whole site",
  "pageBuilder.tour.siteStyles.text":
    "Site styles holds the colours, fonts and sizes your site uses. Save a look as a shared style to reuse it: change it once and every copy follows.",
  "pageBuilder.tour.arrange.title": "Arrange what’s inside",
  "pageBuilder.tour.arrange.text":
    "Select a section or box, and Layout in Style puts what’s inside one under another, side by side, on a grid, or anywhere you drag it.",
  "pageBuilder.tour.animate.title": "Make it move",
  "pageBuilder.tour.animate.text":
    "On Animate, choose Add motion and when it plays: as the page opens, as it scrolls into view, or on hover.",
  "pageBuilder.tour.screens.title": "Every screen size, and every step",
  "pageBuilder.tour.screens.text":
    "Switch between desktop, tablet and phone to see and adjust each one. Undo, redo and History take you back to any earlier step.",
  "pageBuilder.tour.views.title": "One page, two views",
  "pageBuilder.tour.views.text":
    "Design is how the page looks. Content holds its summary, address and settings. Switch between them whenever you like; your work is saved first.",
  "pageBuilder.tour.publish.title": "Publish and view your page",
  "pageBuilder.tour.publish.text":
    "Your changes save as you go. Publish puts the page on your website, and View page opens it as visitors see it. Help and tips brings this tour back.",

  "pageBuilder.start.title": "This page is empty",
  "pageBuilder.start.description":
    "Start building by adding a section, or design your own with elements.",
  "pageBuilder.start.addSection": "Add a section",
  "pageBuilder.start.addElements": "Add elements",
  "pageBuilder.start.fromTemplate": "Start from a template",
  "pageBuilder.start.templatesDescription":
    "Fill this page with a whole page from the template library. Everything in it can be changed.",
  "pageBuilder.start.templatePage": "{site}: {page}",
  "pageBuilder.start.closeTemplates": "Close",
  "pageBuilder.history.usedTemplatePage": "Started from {name}",

  "pageBuilder.insert.sectionCategory.intro": "Intro and banners",
  "pageBuilder.insert.sectionCategory.features": "Features and steps",
  "pageBuilder.insert.sectionCategory.about": "About and story",
  "pageBuilder.insert.sectionCategory.pictures": "Pictures and galleries",
  "pageBuilder.insert.sectionCategory.proof": "Reviews and proof",
  "pageBuilder.insert.sectionCategory.pricing": "Pricing",
  "pageBuilder.insert.sectionCategory.questions": "Questions",
  "pageBuilder.insert.sectionCategory.contact": "Contact and booking",
  "pageBuilder.insert.sectionCategory.shop": "Shop",
  "pageBuilder.insert.sectionCategory.footer": "Footer",
} as const;
