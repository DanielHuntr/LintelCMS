/**
 * The words for external apps: Build → Apps, installing one, and their frames. Spread
 * into `strings.ts`, so they are used through `t()` like every other string.
 */
export const appStrings = {
  "apps.buildDescription": "Tools on their own servers, with only the access you approve",

  "apps.title": "Apps",
  "apps.subtitle":
    "Tools made by other developers, like a stock checker. They run on their own servers and only get the access you approve.",
  "apps.addApp": "Add an app",
  "apps.loading": "Loading apps",
  "apps.emptyTitle": "No apps yet",
  "apps.emptyDescription":
    "When a developer gives you an app’s address, add it here. You’ll see exactly what it asks for before anything is installed.",
  "apps.listFooter": "Uninstalling an app takes away all of its access straight away.",
  "apps.development.header": "Building an app",
  "apps.development.label": "Development mode",
  "apps.development.footer":
    "Lets you install an app running on this computer (localhost) while you build it. Only for development.",
  "apps.development.onNotice":
    "Development mode is on, so apps on this computer can be installed. Turn it off when you’ve finished building.",
  "apps.list.scopesOne": "1 permission",
  "apps.list.scopesOther": "{count} permissions",
  "apps.list.lastUsed": "Last used {when}",
  "apps.list.neverUsed": "Not used yet",

  "apps.add.title": "Add an app",
  "apps.add.description":
    "The app’s developer will have given you either a web address or a block of text called lintel-app.json.",
  "apps.add.sourceLabel": "How you got the app",
  "apps.add.fromAddress": "A web address",
  "apps.add.fromPasted": "Pasted details",
  "apps.add.addressLabel": "The app’s address",
  "apps.add.addressHint": "Usually ends in lintel-app.json.",
  "apps.add.pastedLabel": "The app’s details",
  "apps.add.pastedHint": "Paste everything from lintel-app.json, including the curly brackets.",
  "apps.add.pasteNotJson":
    "This doesn’t look like the whole file. Check you copied everything, from the first '{' to the last '}'.",
  "apps.add.continue": "Continue",
  "apps.add.checking": "Checking…",

  "apps.review.title": "Install {name}?",
  "apps.review.description": "Check what this app asks for. Nothing is installed until you agree.",
  "apps.review.madeBy": "Made by {developer}",
  "apps.review.from": "Runs on {origin}",
  "apps.review.trust":
    "Only install apps from developers you trust. You can uninstall it at any time, which takes back everything it was given.",
  "apps.review.alreadyInstalled":
    "{name} is installed already. Uninstall it first to install it again.",
  "apps.review.needsFeatures": "{name} needs {features}. Switch it on in Build → Features first.",
  "apps.review.back": "Back",
  "apps.review.install": "Install app",
  "apps.review.installing": "Installing…",

  "apps.access.scopesTitle": "This app will be able to",
  "apps.access.noScopes": "Nothing on your site: it only shows its own pages",
  "apps.access.eventsTitle": "It will be told when",
  "apps.access.addsTitle": "It adds",
  "apps.access.never":
    "Apps can never see or change people’s accounts, roles or your site’s settings, and never more than the person who installed them.",
  "apps.scope.read_content": "See all your content, including drafts, and how it is organised",
  "apps.scope.write_content": "Create, edit and delete entries (but not publish them)",
  "apps.scope.publish_content": "Publish and unpublish entries, so changes go live",
  "apps.scope.read_media": "See the images and files in your media library",
  "apps.scope.write_media": "Upload, change and delete images and files",
  "apps.scope.read_forms": "See your forms and the entries people send through them",
  "apps.scope.read_orders": "See your shop’s orders and who placed them",
  "apps.scope.write_orders": "Mark orders as sent and add notes to them (not refunds)",
  "apps.event.entryPublished": "Something is published",
  "apps.event.entryUnpublished": "Something is unpublished",
  "apps.event.entryDeleted": "Something is deleted",
  "apps.event.assetUploaded": "A file is uploaded",
  "apps.event.assetDeleted": "A file is deleted",
  "apps.event.formSubmitted": "Someone sends a form",
  "apps.adds.page": "A page in the sidebar: {label}. Clients and Viewers don't see it",
  "apps.adds.pageFor": "A page in the sidebar: {label}, for {roles}",
  "apps.role.owner": "Owners",
  "apps.role.admin": "Admins",
  "apps.role.editor": "Editors",
  "apps.role.author": "Authors",
  "apps.role.client": "clients",
  "apps.role.viewer": "Viewers",
  "apps.adds.widget": "A dashboard widget: {title}",
  "apps.adds.panel": "A panel in the editor: {title}",
  "apps.adds.panelFor": "A panel in the editor: {title}, for {collections}",
  "apps.adds.settings": "A settings page, under Settings",

  "apps.installed.title": "{name} is installed",
  "apps.installed.description":
    "Give these two values to the app, usually in its own settings, so it can connect to your site.",
  "apps.installed.shownOnce":
    "Copy the secret now: it won’t be shown again. If it’s lost, uninstall the app and install it again for a new one.",
  "apps.clientId": "Client ID",
  "apps.clientSecret": "Client secret",
  "apps.copy": "Copy {what}",

  "apps.detail.credentialHeader": "Connection",
  "apps.detail.credentialFooter":
    "The app uses these to connect. The secret was shown once, when the app was installed.",
  "apps.detail.secretHidden": "Hidden for safety",
  "apps.detail.aboutHeader": "About",
  "apps.detail.installed": "Installed",
  "apps.detail.installedBy": "{when} by {name}",
  "apps.detail.lastUsed": "Last used",
  "apps.detail.address": "Runs on",
  "apps.uninstall": "Uninstall",
  "apps.uninstallTitle": "Uninstall {name}?",
  "apps.uninstallMessage":
    "It will stop working straight away: its access, its pages and widgets, and what it was told about all go. Your content stays as it is.",
  "apps.uninstallConfirm": "Uninstall",

  "apps.settingsGroup": "Apps",
  "apps.settingsRowDescription": "The app’s own settings",
  "apps.settingsPageSubtitle": "These settings belong to the app and are kept by it.",
  "apps.frame.title": "{app}: {part}",
  "apps.frame.quiet":
    "{name} isn’t responding. If this lasts, check with its developer that the app is running.",
  "apps.frame.notAllowed": "{name} can’t be shown here, because of where it is hosted.",
} as const;
