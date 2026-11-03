/** Page drafting's words in the admin (see README.md). Spread into i18n/strings.ts. */
export const pageDraftsStrings = {
  "pageDrafts.settingsTitle": "Page drafting",
  "pageDrafts.settingsDescription": "The writing model that drafts pages",
  "pageDrafts.subtitle":
    "Draft pages from a short description, with a writing model that runs on this server.",
  "pageDrafts.loading": "Loading page drafting",
  "pageDrafts.privacy":
    "Nothing about your site is sent anywhere, now or later. After this it works offline.",
  "pageDrafts.modelHeader": "The writing model",
  "pageDrafts.model": "Model",
  "pageDrafts.maker": "Made by",
  "pageDrafts.licence": "Licence",
  "pageDrafts.size": "Size",
  "pageDrafts.source": "Downloads from",
  "pageDrafts.folder": "Saved to",
  "pageDrafts.memory": "Memory needed",
  "pageDrafts.memoryValue": "About {size} free while it writes",
  "pageDrafts.download": "Download {size}",
  "pageDrafts.resume": "Resume download",
  "pageDrafts.copyIn": "I’ll copy the file in myself",
  "pageDrafts.copyInHelp": "Put these files in the folder below, then press Check files.",
  "pageDrafts.copyInFolder": "Folder",
  "pageDrafts.copyInFiles": "Files",
  "pageDrafts.check": "Check files",
  "pageDrafts.downloading": "Downloading",
  "pageDrafts.downloaded": "{done} of {total}",
  "pageDrafts.cancel": "Cancel download",
  "pageDrafts.cancelNote": "What has arrived is kept, so the download can carry on later.",
  "pageDrafts.checking": "Checking the files against their published checksums…",
  "pageDrafts.paused": "Paused at {done} of {total}.",
  "pageDrafts.installed": "Installed and checked",
  "pageDrafts.installedNote":
    "People with permission to draft see “Draft a page for me” in the page builder. Drafts take a minute or two.",
  "pageDrafts.remove": "Remove",
  "pageDrafts.removeTitle": "Remove the writing model?",
  "pageDrafts.removeMessage":
    "This deletes its files ({size}) from this server. Page drafting stops working until it is set up again.",
  "pageDrafts.removeCancel": "Keep it",
  "pageDrafts.tooLittleMemory":
    "This server has {total} of memory, and drafting needs about {needed} free. It may not be able to draft; a server with 8 GB or more works best.",
  "pageDrafts.tooLittleDisk":
    "This server has {free} of free disk space, and the model needs {needed}. Free some space first.",
} as const;
