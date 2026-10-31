/**
 * Every word the admin shows lives here, so the admin can be translated and
 * agencies can rename things in their client's language ("Collections" → "Your content").
 *
 * Components never hard-code text: they call `t("key")`.
 */
const english = {
  "app.name": "Lintel",
  "nav.label": "Main navigation",
  "nav.dashboard": "Dashboard",
  "nav.content": "Content",
  "nav.design": "Design",
  "nav.commerce": "Commerce",
  "nav.media": "Media",
  "nav.forms": "Forms",
  "nav.users": "Users",
  "nav.settings": "Settings",
  "nav.help": "Help",
  "dashboard.title": "Dashboard",
  "dashboard.intro": "Recent edits, tasks and sales will appear here.",
  "section.comingSoon": "This section arrives in a later phase of the roadmap.",
  "signIn.title": "Sign in to Lintel",
  "signIn.email": "Email address",
  "signIn.password": "Password",
  "signIn.submit": "Sign in",
  "signIn.notReady": "Signing in is being built in the next pull request.",
} as const;

export type StringKey = keyof typeof english;

export function t(key: StringKey): string {
  return english[key];
}
