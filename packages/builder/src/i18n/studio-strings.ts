/**
 * The builder's words for animating, skill levels, the guided tour and tips. Part of
 * `builderStrings`, kept in their own file so each list stays easy to read.
 */
export const builderStudioStrings = {
  "pageBuilder.panels.animate": "Animate",
  "pageBuilder.animate.selectSomething":
    "Select something on the page to make it move: a heading, a picture, a whole section.",
  "pageBuilder.animate.heading": "Animation for {name}",
  "pageBuilder.animate.remove": "Remove animation",
  "pageBuilder.animate.playOnPage": "Play on the page",
  "pageBuilder.animate.lockedNote": "This element is locked. Unlock it in Layers to animate it.",
  "pageBuilder.animate.tip":
    "Animations play on your published site, when visitors scroll to them, hover or click. People who ask their device for less motion see a gentle fade or nothing at all.",
  "pageBuilder.animate.timelineInDesigner":
    "Want to fine-tune every moment? Switch to Designer to open the timeline.",
  "pageBuilder.history.animated": "Animated {name}",
  "pageBuilder.history.removedAnimation": "Removed the animation from {name}",

  "pageBuilder.skill.label": "Tools to show",
  "pageBuilder.skill.button": "Tools: {level}",
  "pageBuilder.skill.beginner": "Beginner",
  "pageBuilder.skill.designer": "Designer",
  "pageBuilder.skill.developer": "Developer",
  "pageBuilder.skill.beginnerDescription":
    "The essentials: words, pictures, colours, sections and ready-made animations.",
  "pageBuilder.skill.designerDescription":
    "Adds every style setting, hover and focus styles, and the animation timeline.",
  "pageBuilder.skill.developerDescription": "Adds the code tools: HTML, CSS and code blocks.",
  "pageBuilder.skill.developerNeedsPermission":
    "Needs permission to edit code. Ask whoever runs your site.",
  "pageBuilder.skill.changed": "Showing the {level} tools",
  "pageBuilder.style.moreInDesigner":
    "Want more control? Choose Designer in Tools, at the top, to see every style setting.",

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
    "Insert has ready-made sections, grouped by what they’re for, and single elements such as headings, pictures and buttons. Search finds either.",
  "pageBuilder.tour.layers.title": "Everything on the page, in order",
  "pageBuilder.tour.layers.text":
    "Layers lists every part of your page. Pick something to select it, drag it to move it, and hide or lock what you don’t want to change.",
  "pageBuilder.tour.canvas.title": "Click to select, double-click to type",
  "pageBuilder.tour.canvas.text":
    "Click anything on your page to select it. Double-click any text to type straight into it, then press Enter or click somewhere else.",
  "pageBuilder.tour.panel.title": "Change what you’ve selected",
  "pageBuilder.tour.panel.beginnerText":
    "Style changes colours, sizes, spacing and corners. Content changes the words, pictures and links. Animate makes it move. Style changes apply to the screen size you’re looking at.",
  "pageBuilder.tour.panel.designerText":
    "Style changes colours, sizes, spacing and corners, for the screen size you’re looking at. In Advanced, Style for changes how it looks under the pointer or with keyboard focus. Content changes the words; Animate makes it move.",
  "pageBuilder.tour.panel.developerText":
    "Style, for the screen size you’re looking at, with Style for in Advanced for pointer and focus states. Content changes the words, Animate makes it move, and Code shows its HTML and CSS.",
  "pageBuilder.tour.screens.title": "Every screen size, and every step",
  "pageBuilder.tour.screens.beginnerText":
    "Switch between desktop, tablet and phone to see and adjust each one. Undo, redo and History take you back to any earlier step. Tools, beside them, shows more settings when you’re ready.",
  "pageBuilder.tour.screens.text":
    "Switch between desktop, tablet and phone to see and adjust each one. Undo, redo and History take you back to any earlier step.",
  "pageBuilder.tour.publish.title": "Publish and view your page",
  "pageBuilder.tour.publish.text":
    "Your changes save as you go. Publish puts the page on your website, and View page opens it as visitors see it.",

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
  "pageBuilder.insert.sectionCategory.footer": "Footer-style",
} as const;
