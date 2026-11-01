import { ChevronsUpDown } from "lucide-react";
import { useId, useState } from "react";
import { describeError } from "../api/describeError.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { Dialog } from "../design/Dialog.js";
import { t } from "../i18n/strings.js";
import { copyEntryToSite } from "./sites.api.js";
import type { Site } from "./sites.types.js";

interface CopyToSiteDialogProps {
  entryId: string;
  /** The sites it can go to: every site the person may use, except the entry's own. */
  sites: readonly Site[];
  /** Called with the new draft's id and its site, once the copy exists. */
  onCopied: (copyId: string, site: Site) => void;
  onClose: () => void;
}

/** "Copy to site": picks a site and starts a draft copy there, ready to adapt. */
export function CopyToSiteDialog({ entryId, sites, onCopied, onClose }: CopyToSiteDialogProps) {
  const [handle, setHandle] = useState(sites[0]?.handle ?? "");
  const [problem, setProblem] = useState<string | undefined>();
  const [isCopying, setIsCopying] = useState(false);
  const selectId = useId();

  async function copy() {
    const site = sites.find((candidate) => candidate.handle === handle);
    if (!site) return;
    setIsCopying(true);
    setProblem(undefined);
    try {
      const created = await copyEntryToSite(entryId, site.handle);
      onCopied(created.id, site);
    } catch (error) {
      setProblem(describeError(error));
      setIsCopying(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={t("sites.copy.title")}
      description={t("sites.copy.description")}
      footer={
        <>
          <Button variant="tinted" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void copy()} disabled={isCopying || handle === ""}>
            {isCopying ? t("sites.copy.copying") : t("sites.copy.confirm")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5 pt-2 pb-1">
        <label htmlFor={selectId} className="text-footnote font-medium text-label">
          {t("sites.copy.site")}
        </label>
        <div className="relative">
          <select
            id={selectId}
            value={handle}
            data-autofocus
            onChange={(event) => setHandle(event.target.value)}
            className={classNames("h-10 appearance-none pe-9", controlClasses())}
          >
            {sites.map((site) => (
              <option key={site.handle} value={site.handle}>
                {site.name}
              </option>
            ))}
          </select>
          <ChevronsUpDown
            aria-hidden="true"
            strokeWidth={2}
            className="pointer-events-none absolute top-1/2 inset-e-3 size-4 -translate-y-1/2 text-label-secondary"
          />
        </div>
        {problem && (
          <p role="alert" className="text-footnote font-medium text-danger">
            {problem}
          </p>
        )}
      </div>
    </Dialog>
  );
}
