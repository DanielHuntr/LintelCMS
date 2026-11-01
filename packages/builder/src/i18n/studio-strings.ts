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
  "pageBuilder.history.changedEffects": "Changed the effects on {name}",
  "pageBuilder.animate.tabs": "Animation or effects",
  "pageBuilder.animate.tab.animation": "Animation",
  "pageBuilder.animate.tab.effects": "Effects",
  "pageBuilder.animate.effectsHeading": "Effects for {name}",

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
  "pageBuilder.tour.welcome.title": "Welcome to your page builder",
  "pageBuilder.tour.welcome.text":
    "This short tour shows you the six things you’ll do most. It takes about a minute, and you can replay it any time from Help and tips.",
  "pageBuilder.tour.select.title": "Select something",
  "pageBuilder.tour.select.text":
    "Click anything on your page to select it. It gets a purple outline, and the panels on the right show what you can change.",
  "pageBuilder.tour.editText.title": "Change the words",
  "pageBuilder.tour.editText.text":
    "Double-click any text on the page and type. Press Enter, or click somewhere else, when you’re done.",
  "pageBuilder.tour.style.title": "Change how it looks",
  "pageBuilder.tour.style.text":
    "With something selected, Style changes its colours, size, spacing and corners. Your site’s colours and fonts are always one click away.",
  "pageBuilder.tour.insert.title": "Add a section",
  "pageBuilder.tour.insert.text":
    "Insert has ready-made sections: heroes, features, prices, questions and more. Pick one and it appears after what you’ve selected.",
  "pageBuilder.tour.animate.title": "Bring it to life",
  "pageBuilder.tour.animate.text":
    "Animate makes the selected element move: choose a ready-made animation, see it play on your page, then tweak it with a few sliders.",
  "pageBuilder.tour.skill.title": "Show more, or less",
  "pageBuilder.tour.skill.text":
    "Tools changes how much the builder shows. Beginner keeps it simple; Designer adds every setting and the animation timeline.",
  "pageBuilder.tour.publish.title": "Publish it",
  "pageBuilder.tour.publish.text":
    "Your changes save as you go. When you’re happy, Publish puts the page on your website for everyone to see.",

  "pageBuilder.start.fromTemplate": "Or start from a template page",
  "pageBuilder.start.fromTemplateDescription":
    "Whole pages from the template library, with words, pictures and animations you can change.",
  "pageBuilder.start.templatePage": "{site}: {page}",
  "pageBuilder.history.usedTemplatePage": "Started from {name}",

  "pageBuilder.insert.sectionCategory.hero": "Heroes",
  "pageBuilder.insert.sectionCategory.features": "Features",
  "pageBuilder.insert.sectionCategory.story": "Stories and pictures",
  "pageBuilder.insert.sectionCategory.testimonials": "Testimonials",
  "pageBuilder.insert.sectionCategory.pricing": "Prices",
  "pageBuilder.insert.sectionCategory.questions": "Questions",
  "pageBuilder.insert.sectionCategory.callToAction": "Calls to action",
  "pageBuilder.insert.sectionCategory.contact": "Contact",
  "pageBuilder.insert.sectionCategory.footer": "Footers",
} as const;
