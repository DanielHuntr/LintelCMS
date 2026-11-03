/**
 * The words for the template library ("Start from a template"). `strings.ts` spreads them
 * in, so they are used through `t()` like every other word in the admin.
 */
export const starterSiteStrings = {
  "templates.title": "Templates",
  "templates.subtitle":
    "Start your website from a complete design: pages, words, pictures and gentle animations. You can change every bit of it afterwards.",
  "templates.listLabel": "Templates to start from",
  "templates.suitedTo": "Good for {who}",
  "templates.pages": "Pages: {pages}",
  "templates.colours": "Colours",
  "templates.use": "Use this template",
  "templates.confirmTitle": "Start from {name}?",
  "templates.confirmText":
    "We’ll add {count} pages to Pages, ready to change in the page builder. Pages you already have stay as they are.",
  "templates.useTheme":
    "Use this template’s colours, fonts, menu and footer, and motion for the website",
  "templates.publish": "Publish the pages straight away",
  "templates.publishHint":
    "Leave this off to look everything over first. The pages wait as drafts.",
  "templates.cancel": "Cancel",
  "templates.apply": "Add the pages",
  "templates.applying": "Adding pages…",
  "templates.doneTitle": "Your {name} pages are ready",
  "templates.doneDrafts": "They’re drafts for now. Open one to make it yours, then publish it.",
  "templates.donePublished": "They’re live on your website. Open one to make it yours.",
  "templates.editDesign": "Edit {title}",
  "templates.movedSlug": "Saved at /{slug}, because /{wanted} was already in use.",
  "templates.viewSite": "View your website",
  "templates.menuFilled": "Each page has a link in your main menu.",
  "templates.menuHasLinks": "Your main menu already has links, so we left it as it is.",
  "templates.addToMenu": "Add these pages to the menu",
  "templates.addingToMenu": "Adding…",
  "templates.addedToMenu": "Added to your main menu.",
  "templates.sectionsNote":
    "Looking for a single section, like prices or questions? Open any page in the page builder and choose Insert.",
  "done.startFromTemplate": "Start from a template",
} as const;
