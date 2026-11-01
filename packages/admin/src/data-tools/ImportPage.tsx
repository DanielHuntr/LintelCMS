import { FileDown } from "lucide-react";
import { useState } from "react";
import { BackLink } from "../design/BackLink.js";
import { buttonClasses } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { LargeTitle } from "../design/LargeTitle.js";
import { Toggle } from "../design/Toggle.js";
import { t } from "../i18n/strings.js";
import { exportDownloadUrl } from "./dataTools.api.js";
import { MoveYourSiteList } from "../importers/MoveYourSiteList.js";
import { LintelImportCard } from "./LintelImportCard.js";

/**
 * /settings/import: "Move your site to Lintel" (one importer per system: WordPress here in
 * data-tools, the others in src/importers, Shopify in the shop), then importing a Lintel
 * export and exporting this site.
 */
export function ImportPage() {
  return (
    <>
      <BackLink to="/settings">{t("nav.settings")}</BackLink>
      <LargeTitle title={t("import.title")} subtitle={t("import.subtitle")} />
      <div className="flex max-w-2xl flex-col gap-8">
        <MoveYourSiteList />
        <LintelImportCard />
        <ExportCard />
      </div>
    </>
  );
}

function ExportCard() {
  const [revisions, setRevisions] = useState(false);
  const [files, setFiles] = useState(true);
  return (
    <Card title={t("import.exportTitle")}>
      <p className="mb-4 text-body text-label-secondary">{t("import.exportDescription")}</p>
      <div className="mb-5 flex flex-col gap-3">
        <Toggle label={t("import.exportFiles")} checked={files} onCheckedChange={setFiles} />
        <Toggle
          label={t("import.exportRevisions")}
          checked={revisions}
          onCheckedChange={setRevisions}
        />
      </div>
      <div>
        <a href={exportDownloadUrl({ revisions, files })} className={buttonClasses("tinted")}>
          <FileDown aria-hidden="true" className="-ms-0.5 size-[1.1em]" />
          {t("import.exportDownload")}
        </a>
      </div>
    </Card>
  );
}
