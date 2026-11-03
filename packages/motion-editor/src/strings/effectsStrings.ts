/**
 * The Effects gallery's words, in English. Spread into `motionEditorStrings`, so the admin
 * translates them with the rest. Effect names and descriptions come with each effect.
 */
export const effectsEditorStrings = {
  "motionEditor.effects.title": "Effects",
  "motionEditor.effects.applied": "On this element",
  "motionEditor.effects.none":
    "No effects yet. Pick one below; hover over a card to try it on your page.",
  "motionEditor.effects.add": "Add an effect",
  "motionEditor.effects.search": "Search effects",
  "motionEditor.effects.categoryLabel": "Kind of effect",
  "motionEditor.effects.suitsOnly": "Only ones that suit this element",
  "motionEditor.effects.count": "{count} effects shown",
  "motionEditor.effects.empty": "No effects match. Try another word, or show every kind.",
  "motionEditor.effects.apply": "Add {name}",
  "motionEditor.effects.applied.badge": "Added",
  "motionEditor.effects.remove": "Remove {name}",
  "motionEditor.effects.preview": "Try {name} on the page",
  "motionEditor.effects.stopPreview": "Stop trying it",
  "motionEditor.effects.settings": "Settings for {name}",
  "motionEditor.effects.lessMotion": "With less motion: {text}",
  "motionEditor.effects.becomesAnimation":
    "Some effects, such as the letter entrances, are animations: adding one replaces the element’s animation, and you can fine-tune it on the Animation tab.",
  "motionEditor.effects.limit":
    "An element can have up to {count} effects. Remove one to add another.",
  "motionEditor.effects.weight.light": "Light",
  "motionEditor.effects.weight.medium": "Medium",
  "motionEditor.effects.weight.heavy": "Heavy",
  "motionEditor.effects.on": "On",
  "motionEditor.effects.off": "Off",

  "motionEditor.category.allEffects": "All",
  "motionEditor.category.text": "Text",
  "motionEditor.category.hoverEffects": "Hover",
  "motionEditor.category.scrollEffects": "Scroll",
  "motionEditor.category.canvas": "Backgrounds",
  "motionEditor.category.depth": "3D",
  "motionEditor.category.transitions": "Page changes",
  "motionEditor.category.physics": "Physics",
  "motionEditor.category.cursor": "Cursor",
  "motionEditor.category.marquee": "Marquee",
  "motionEditor.category.loaders": "Loaders",
  "motionEditor.category.svg": "Shapes",

  "motionEditor.weight.title": "Effects on this page",
  "motionEditor.weight.summary": "Effects: {count}, adding {size}",
  "motionEditor.weight.nothing": "No effects on this page yet, so it loads no effect code.",
  "motionEditor.weight.warning.severalShaderEffects":
    "Several WebGL effects on one page can make older laptops and phones warm. Keep one or two.",
  "motionEditor.weight.warning.manyEffects":
    "That’s a lot of effects on one page. A few well-chosen ones feel more polished.",
  "motionEditor.weight.warning.manyPointerEffects":
    "Many elements react to the pointer. People may find the page busy.",
  "motionEditor.weight.warning.heavyDownload":
    "These effects add a lot to the page’s download. Consider fewer kinds of effect.",
  "motionEditor.weight.warning.cursorAndTrails":
    "The site already has a custom cursor, so cursor effects here will compete with it.",

  "motionEditor.site.title": "Motion across the site",
  "motionEditor.site.description":
    "These apply to every page. People who ask their device for less motion get calmer versions.",
  "motionEditor.site.smoothScroll": "Smooth scrolling",
  "motionEditor.site.smoothScroll.off": "Off",
  "motionEditor.site.smoothScroll.gentle": "Gentle",
  "motionEditor.site.smoothScroll.strong": "Strong",
  "motionEditor.site.smoothScroll.note":
    "The mouse wheel glides to a stop. Touch screens and keys scroll as usual.",
  "motionEditor.site.transition": "Page transition",
  "motionEditor.site.transition.none": "None",
  "motionEditor.site.transition.fade": "Fade",
  "motionEditor.site.transition.slide": "Slide",
  "motionEditor.site.transition.wipe": "Wipe",
  "motionEditor.site.transition.zoom": "Zoom",
  "motionEditor.site.transition.duration": "Transition length",
  "motionEditor.site.cursor": "Cursor",
  "motionEditor.site.cursor.none": "Normal",
  "motionEditor.site.cursor.dot": "Dot",
  "motionEditor.site.cursor.ring": "Ring",
  "motionEditor.site.cursor.ringAndDot": "Ring and dot",
  "motionEditor.site.cursor.blend": "Inverting circle",
  "motionEditor.site.cursor.trail": "Trail",
  "motionEditor.site.cursor.trail.none": "No trail",
  "motionEditor.site.cursor.trail.dots": "Dots",
  "motionEditor.site.cursor.trail.line": "Line",
  "motionEditor.site.cursor.trail.comet": "Comet",
  "motionEditor.site.cursor.colour": "Cursor colour",
  "motionEditor.site.cursor.colour.text": "Text colour",
  "motionEditor.site.cursor.colour.brand": "Brand colour",
  "motionEditor.site.cursor.colour.own": "Pick a colour",
  "motionEditor.site.cursor.ownColour": "Your colour",
  "motionEditor.site.cursor.size": "Cursor size",
  "motionEditor.site.cursor.note":
    "Shown only with a mouse or trackpad. It grows over links, and shows the word you give an element on its Animate tab.",
  "motionEditor.site.intro": "Intro",
  "motionEditor.site.intro.none": "None",
  "motionEditor.site.intro.curtain": "Curtain",
  "motionEditor.site.intro.counter": "Counter",
  "motionEditor.site.intro.name": "Your name",
  "motionEditor.site.intro.text": "Words on the intro",
  "motionEditor.site.intro.background": "Intro background",
  "motionEditor.site.intro.colour": "Intro text colour",
  "motionEditor.site.intro.note":
    "Plays once per visit, for at most three seconds. Visitors can skip it, and it never shows without JavaScript.",
} as const;
