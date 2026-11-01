/**
 * The words for Settings → Updates, Settings → About, the updates badge, banner and
 * dashboard widget. Kept in their own list so the main one stays readable; `strings.ts`
 * spreads them in, so they are used through `t()` like every other string.
 */
export const updatesStrings = {
  "settings.systemHeader": "Lintel itself",
  "settings.updatesDescription": "New versions of Lintel and your plugins",
  "settings.aboutDescription": "Which version this is, and where to find help",

  "updates.title": "Updates",
  "updates.subtitle": "You’re running Lintel {version}.",
  "updates.loading": "Looking at updates",
  "updates.checkNow": "Check now",
  "updates.checking": "Checking…",
  "updates.lastChecked": "Last checked {when}.",
  "updates.neverChecked": "Lintel hasn’t looked for updates yet.",
  "updates.checksOff":
    "Looking for updates is switched off on this server (UPDATE_CHECKS=off). Ask whoever looks after it how this site gets new versions.",
  "updates.customFeed": "Updates come from your agency’s own update feed.",
  "updates.upToDateTitle": "You’re up to date",
  "updates.upToDateText": "Lintel {version} is the newest version. Lintel looks again every day.",
  "updates.available.one": "{count} update available",
  "updates.available.other": "{count} updates available",
  "updates.securityCount.one": "{count} security",
  "updates.securityCount.other": "{count} security",
  "updates.availableTitle": "Lintel {version} is available",
  "updates.published": "Released {when}",
  "updates.security": "Security fix",
  "updates.securityExplained":
    "This version fixes a security problem. Updating soon keeps your site and its visitors safe.",
  "updates.breaking": "Big changes",
  "updates.breakingExplained":
    "This version changes things websites or plugins may rely on. Read what changes before updating, or ask your developer.",
  "updates.beta": "Beta",
  "updates.betaExplained": "A test version: try it on a copy of your site first.",
  "updates.whatChanges": "What changes",
  "updates.fullNotes": "Read the full notes",
  "updates.updateTo": "Update to {version}",
  "updates.backupNote":
    "Lintel backs up your whole site first, and goes back to {version} by itself if anything goes wrong.",
  "updates.ownersOnly":
    "Only an owner of this site can install updates. You can see what’s new here.",
  "updates.needsFirst": "Needs Lintel {version} or newer first.",
  "updates.otherVersions": "Other versions",
  "updates.showNotes": "What’s in {version}",

  "updates.confirmTitle": "Update to Lintel {version}?",
  "updates.confirmBackup": "Lintel makes a backup of your whole site before anything changes.",
  "updates.confirmDowntime":
    "Your website shows a “back in a minute” page for about a minute while Lintel restarts.",
  "updates.confirmRollback":
    "If the new version doesn’t start properly, Lintel goes back to {version} and puts the backup back, by itself.",
  "updates.confirmUnderstand": "I understand. Update now.",
  "updates.confirm": "Update now",
  "updates.cancel": "Cancel",

  "updates.progressTitle": "Updating to Lintel {version}",
  "updates.rollbackProgressTitle": "Going back to Lintel {version}",
  "updates.progressDoneTitle": "Updated to Lintel {version}",
  "updates.rollbackDoneTitle": "Back on Lintel {version}",
  "updates.progressFailedTitle": "The update didn’t work",
  "updates.progressFailedHelp":
    "Your site is running the version it had before. The backup made first is in Settings → Backups.",
  "updates.restartingNote": "Lintel is restarting. This page carries on by itself.",
  "updates.backupMade": "Backup made first: {file}",
  "updates.phase.backup": "Back up the site",
  "updates.phase.download": "Download the new version",
  "updates.phase.verify": "Check it’s a genuine Lintel release",
  "updates.phase.restart": "Restart with the new version",
  "updates.phase.done": "Done",
  "updates.phaseState.done": "done",
  "updates.phaseState.current": "in progress",
  "updates.phaseState.waiting": "waiting",
  "updates.downloaded": "{percent}% downloaded",
  "updates.reload": "Reload the admin",
  "updates.signedOut":
    "Lintel is running again, and the backup was put back, which signed everyone out. Sign in to see how the update went.",
  "updates.signIn": "Sign in again",

  "updates.methodTitle": "How this site is updated",
  "updates.method.supervised":
    "This server runs Lintel with `lintel start`, so the Update button does everything: backup, download, checks, restart, and going back if needed.",
  "updates.method.process":
    "This server runs Lintel with `pnpm start`. To get the Update button, start Lintel with the command below instead (see “Updating Lintel” in Help). Until then, update the way it was installed.",
  "updates.method.docker":
    "This site runs in Docker. A container can’t safely replace itself, so on the server, in the folder you installed Lintel in, run these two commands with the version you want:",
  "updates.method.dockerUpdater":
    "This site runs in Docker with the lintel-updater service, so the Update button works: it makes a backup, then lintel-updater rebuilds and restarts Lintel. The two commands it runs are below.",
  "updates.method.dockerUpdaterOffer":
    "To use the Update button instead, switch on the optional lintel-updater service (see “Updating Lintel” in Help). It needs access to Docker, which is why it’s off unless you choose it.",
  "updates.method.source":
    "You’re running from source (a copy of Lintel’s code). Stop Lintel, run the command below, then start `pnpm dev` again. It won’t touch work you haven’t committed.",
  "updates.method.passenger":
    "This site runs on shared hosting (cPanel or Passenger). Upload the new version’s hosting package, then restart the app from your hosting control panel or with the command below in the app’s folder.",
  "updates.method.forge":
    "This site runs on Laravel Forge. In Forge, press Deploy Now (or run these in the site’s folder), then restart the Lintel daemon from Forge’s Daemons page.",
  "updates.copyCommand": "Copy the command",
  "updates.commandsLabel": "Commands to run",

  "updates.pluginsTitle": "Plugins",
  "updates.pluginUpdate": "{name}: {from} → {to}",
  "updates.pluginHelp":
    "Plugins are updated by whoever installed them. On the server, in Lintel’s folder, run:",
  "updates.pluginPage": "About {name}",

  "updates.channelTitle": "Which versions",
  "updates.channelLabel": "Versions to offer",
  "updates.channel.stable": "Stable",
  "updates.channel.beta": "Betas too",
  "updates.channelHelp":
    "Stable versions are the ones to run a real site on. Betas let you try what’s coming, on a test copy.",

  "updates.earlierTitle": "Earlier versions on this server",
  "updates.earlierHelp":
    "Lintel keeps the versions it has run, so you can go back to one if something isn’t right.",
  "updates.runningNow": "Running now",
  "updates.rollBack": "Roll back",
  "updates.rollBackTo": "Roll back to {version}",
  "updates.rollbackTitle": "Go back to Lintel {version}?",
  "updates.rollbackText":
    "Lintel restarts with {version}. Your website shows a “back in a minute” page for about a minute.",
  "updates.rollbackRestore": "Also put back the backup made before leaving {version}",
  "updates.rollbackRestoreHelp":
    "Choose this if the newer version changed your content in a way you don’t want. Anything added or changed since that backup is lost.",
  "updates.rollbackNoBackup": "There’s no backup from before leaving this version.",
  "updates.rollbackConfirm": "Roll back",

  "updates.banner": "Lintel is being updated to {version}. Your site will be back in a minute.",
  "updates.sidebarLink.one": "{count} update",
  "updates.sidebarLink.other": "{count} updates",
  "updates.sidebarLinkSecurity": "{count} updates, including a security fix",

  "dashboard.updates.title": "Updates",
  "dashboard.updates.description": "New versions of Lintel and your plugins",
  "dashboard.updates.upToDate": "Lintel {version} is up to date.",
  "dashboard.updates.summarySecurity": "{available} · {security}",
  "dashboard.updates.open": "See updates",

  "about.title": "About Lintel",
  "about.version": "Version",
  "about.installType": "Installed as",
  "about.installType.supervised": "Server, with one-click updates",
  "about.installType.process": "Server (pnpm start)",
  "about.installType.docker": "Docker",
  "about.installType.source": "Running from source",
  "about.installType.passenger": "Shared hosting",
  "about.installType.forge": "Laravel Forge",
  "about.updates": "Updates",
  "about.help": "Help and guides",
  "about.license": "Lintel is open source.",
  "about.footer": "Lintel {version}",

  "securityLog.kind.lintel-update-started": "Lintel update started",
  "securityLog.kind.lintel-rolled-back": "Lintel rolled back",
} as const;
