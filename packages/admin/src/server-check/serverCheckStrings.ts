/**
 * The words for Settings → This server. `src/i18n/strings.ts` spreads them in, so they are
 * used through `t()`. The checks' own wording comes from the server (src/server-check).
 */
export const serverCheckStrings = {
  "serverCheck.title": "This server",
  "serverCheck.settingsDescription": "Check the server has what Lintel needs",
  "serverCheck.subtitle":
    "Lintel looks at the computer it runs on: Node.js, the database, memory, the folders it saves to and its internet access.",
  "serverCheck.checking": "Checking this server…",
  "serverCheck.checkAgain": "Check again",
  "serverCheck.status.pass": "Fine",
  "serverCheck.status.warn": "Worth knowing",
  "serverCheck.status.fail": "Needs fixing",
  "serverCheck.askHostTitle": "What to ask your hosting company",
  "serverCheck.askHostHint": "Copy this into a message to their support team.",
  "serverCheck.copy": "Copy the message for your host",
  "serverCheck.askHostGreeting":
    "Hello, I'm running a Node.js app on my account and need the following:",
} as const;
