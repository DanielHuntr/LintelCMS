import { createTranslator } from "@lintel/admin/plugin";

/** Every word the Newsletter sign-up add-on shows in the admin, in one place. */
export const t = createTranslator({
  "newsletter.title": "Newsletter",
  "newsletter.settingsGroup": "Your website",
  "newsletter.settingsDescription": "Where sign-ups from your website go.",
  "newsletter.back": "Settings",
  "newsletter.subtitle": "People who sign up on your website join your mailing list.",
  "newsletter.loading": "Loading the newsletter connection",
  "newsletter.service": "Service",
  "newsletter.apiKey": "API key",
  "newsletter.apiKeyHint.mailchimp": "In Mailchimp: Profile → Extras → API keys.",
  "newsletter.apiKeyHint.brevo": "In Brevo: your name → SMTP & API → API keys.",
  "newsletter.apiKeySaved": "Saved key ending {hint}. Paste a new one to change it.",
  "newsletter.findLists": "Find lists",
  "newsletter.list": "List",
  "newsletter.chooseList": "Choose a list",
  "newsletter.noLists": "This account has no lists yet. Make one in {service} first.",
  "newsletter.doubleOptIn": "Ask people to confirm by email",
  "newsletter.doubleOptInHint":
    "Recommended. Only people who confirm are added, which keeps your list clean and is required in some countries.",
  "newsletter.brevoTemplate": "Confirmation email template number",
  "newsletter.brevoTemplateHint": "In Brevo: Campaigns → Templates. Use a double opt-in template.",
  "newsletter.brevoConfirmUrl": "Page people see after confirming",
  "newsletter.save": "Save",
  "newsletter.connect": "Connect",
  "newsletter.saved": "Saved",
  "newsletter.disconnect": "Disconnect",
  "newsletter.cancel": "Cancel",
  "newsletter.disconnectTitle": "Disconnect {service}?",
  "newsletter.disconnectMessage":
    "Sign-up forms on your website stop working until you connect again. Nobody is removed from your list.",
  "newsletter.connectedTo": "Connected to {service}",
  "newsletter.connectedList": "List: {list}",
  "newsletter.notConnected": "Not connected",
  "newsletter.howToUse":
    "Add the Newsletter sign-up element to a page in the builder. Your keys stay on your server; visitors never load anything from {service}.",
});
