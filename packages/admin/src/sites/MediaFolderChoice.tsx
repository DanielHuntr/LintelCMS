import { useState } from "react";
import { SegmentedControl } from "../design/SegmentedControl.js";
import { t } from "../i18n/strings.js";
import { useCurrentSite } from "./SiteContext.js";

type FolderChoice = "all" | "shared" | "site";

export interface MediaFolder {
  choice: FolderChoice;
  setChoice: (choice: FolderChoice) => void;
  /** The `folder` to list: undefined for every file. */
  listFolder: string | undefined;
  /** Where uploads go: the current site's folder while it is open, else the shared library. */
  uploadFolder: string | undefined;
  siteName: string | undefined;
}

/**
 * The media library is shared by every site; each site can also keep files in a folder of
 * its own. This is which of those the library shows. With one site, always everything.
 */
export function useMediaFolder(): MediaFolder {
  const current = useCurrentSite();
  const [choice, setChoice] = useState<FolderChoice>("all");
  const site = current?.hasSeveralSites ? current.site : undefined;
  const effective = site ? choice : "all";
  return {
    choice: effective,
    setChoice,
    listFolder: effective === "all" ? undefined : effective === "shared" ? "shared" : site?.handle,
    uploadFolder: effective === "site" ? site?.handle : undefined,
    siteName: site?.name,
  };
}

/** "All files · Shared · <This site>'s folder", shown only when there are several sites. */
export function MediaFolderChoice({ folder }: { folder: MediaFolder }) {
  if (folder.siteName === undefined) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span aria-hidden="true" className="text-footnote font-medium text-label">
        {t("sites.media.label")}
      </span>
      <div className="flex h-10 items-center">
        <SegmentedControl
          label={t("sites.media.label")}
          value={folder.choice}
          onChange={folder.setChoice}
          options={[
            { value: "all", label: t("sites.media.all") },
            { value: "shared", label: t("sites.media.shared") },
            { value: "site", label: t("sites.media.site", { name: folder.siteName }) },
          ]}
        />
      </div>
    </div>
  );
}
