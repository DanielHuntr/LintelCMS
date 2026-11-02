/**
 * The words for Settings → Branding, Settings → Interface language and the support
 * details on the Help page. Kept in their own list so the main one stays readable;
 * `strings.ts` spreads them in, so they are used through `t()` like every other string.
 *
 * The branding strings say "Lintel" on purpose: they're about Lintel's own name and links,
 * so they are the one place {product} isn't used.
 */
export const brandingStrings = {
  "settings.interfaceLanguageDescription": "The language of menus, buttons and messages",
  "settings.brandingDescription": "The name, logo and colour your clients see in the admin",

  "branding.title": "Admin branding",
  "branding.subtitle":
    "Show your own name, logo and colour instead of Lintel’s, so your clients see your brand.",
  "branding.loading": "Loading branding",
  "branding.section.identity": "Name and logo",
  "branding.section.identityHint":
    "Shown in the sidebar, on the sign-in screen, in browser tabs and in emails.",
  "branding.productName": "Product name",
  "branding.productNameHint": "Such as your agency’s name, or “Acme website”.",
  "branding.logo": "Logo",
  "branding.logoHint":
    "Used in the sidebar and on the sign-in screen, instead of the mark and name. SVG or PNG, under 500 KB.",
  "branding.logoDark": "Logo for dark mode",
  "branding.logoDarkHint":
    "A light version for dark backgrounds. Leave empty to use the logo above.",
  "branding.mark": "Small mark",
  "branding.markHint": "A square icon for small spaces, such as the corner of the sign-in screen.",
  "branding.favicon": "Browser tab icon",
  "branding.faviconHint": "The little picture in the browser tab. A square PNG, SVG or ICO.",
  "branding.image.choose": "Choose picture…",
  "branding.image.replace": "Replace…",
  "branding.image.remove": "Remove",
  "branding.image.preview": "Current {label}",
  "branding.image.tooBig": "That picture is too big. Use one under 500 KB.",
  "branding.section.colour": "Accent colour",
  "branding.section.colourHint":
    "Used for buttons, links and the selected item in the sidebar. Lighter and darker shades are worked out for you, so links stay readable in light and dark mode.",
  "branding.accent.picker": "Pick",
  "branding.accent.label": "Colour code",
  "branding.accent.invalid": "Use a colour code like #7539FD",
  "branding.accent.preview": "Preview in light and dark mode",
  "branding.accent.sampleButton": "Save",
  "branding.accent.sampleTinted": "Preview",
  "branding.accent.sampleLink": "A link",
  "branding.accent.readable": "Text on buttons in this colour is easy to read ({ratio}:1).",
  "branding.accent.hardToRead":
    "Text on buttons in this colour is hard to read ({ratio}:1, and at least 4.5:1 is needed). Try a darker or lighter shade.",
  "branding.section.signIn": "Sign-in screen",
  "branding.section.signInHint": "What people see before they sign in.",
  "branding.signInMessage": "Message",
  "branding.signInMessageHint":
    "A sentence under the heading, such as who to call if they’re stuck.",
  "branding.signInBackground": "Background picture",
  "branding.signInBackgroundHint":
    "Fills the screen behind the sign-in form. A wide photo works best.",
  "branding.section.help": "Help and support",
  "branding.section.helpHint": "Shown on the Help page, so your clients know who to ask.",
  "branding.supportUrl": "Support link",
  "branding.supportUrlHint": "Such as your helpdesk or a contact form.",
  "branding.supportEmail": "Support email",
  "branding.docsUrl": "Your own guides",
  "branding.docsUrlHint": "A link to documentation you’ve written for your clients.",
  "branding.hideLintelHelp": "Hide Lintel’s help pages and links",
  "branding.hideLintelHelpHint":
    "The Help page then shows only your support details and guides, and the help button on each screen goes.",
  "branding.section.website": "Your website",
  "branding.hideBuiltWithLintel": "Hide “Built with Lintel” on the website",
  "branding.hideBuiltWithLintelHint":
    "Websites made from Lintel’s starter show a small credit in the footer. This removes it.",
  "branding.save": "Save branding",
  "branding.saving": "Saving…",
  "branding.saved": "Saved. Everyone sees the new branding now.",
  "branding.resetToLintel": "Reset to Lintel defaults",
  "branding.resetToDeployment": "Reset to this server’s defaults",
  "branding.resetTitle": "Reset branding?",
  "branding.resetToLintelMessage":
    "The admin goes back to Lintel’s name, logo and colour, and your pictures are removed.",
  "branding.resetToDeploymentMessage":
    "The admin goes back to the branding this server was set up with, and changes made here are removed.",
  "branding.cancel": "Cancel",

  "interfaceLanguage.title": "Interface language",
  "interfaceLanguage.subtitle": "The language of the admin’s menus, buttons and messages.",
  "interfaceLanguage.loading": "Loading languages",
  "interfaceLanguage.personal": "Your language",
  "interfaceLanguage.personalHint": "Only changes the admin for you.",
  "interfaceLanguage.followSite": "Same as the site ({language})",
  "interfaceLanguage.siteDefault": "Site default",
  "interfaceLanguage.siteDefaultHint":
    "For everyone who hasn’t chosen their own, and on the sign-in screen.",
  "interfaceLanguage.saving": "Saving…",
  "interfaceLanguage.saved": "Saved.",
  "interfaceLanguage.contentNote":
    "This doesn’t change your content. To publish your site in more than one language, use Settings → Languages.",

  "help.support.title": "Need a hand?",
  "help.support.description": "Get in touch with the people who look after this site.",
  "help.support.docs": "Open the guides",
  "help.support.contact": "Contact support",
  "help.support.email": "Email {email}",
  "help.support.pageSubtitle": "Where to find help with this site.",
  "help.support.none": "Help for this site hasn’t been set up yet. Ask whoever built it.",
} as const;
