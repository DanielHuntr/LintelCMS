import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Globe } from "lucide-react";
import { type FormEvent, useState } from "react";
import { describeError } from "../api/describeError.js";
import { formatDateTime } from "../content/relativeTime.js";
import { uploadFiles } from "../data-tools/dataTools.api.js";
import { FilePicker } from "../data-tools/FilePicker.js";
import { BackLink } from "../design/BackLink.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import type { Tone } from "../design/tones.js";
import { t, type StringKey } from "../i18n/strings.js";
import type { SiteImport, SiteImportSource, SiteImportStatus } from "./siteImport.api.js";
import { siteImportKeys, useSiteImports } from "./siteImport.queries.js";

const statusTones: Record<SiteImportStatus, Tone> = {
  ready: "neutral",
  running: "accent",
  paused: "warning",
  complete: "success",
};

/** What each system's upload asks for: text files (CSV, JSON) and a zip, and which is needed. */
const uploads: Record<
  SiteImportSource,
  { files: string | null; archive: "required" | "optional" | null }
> = {
  webflow: { files: ".csv,text/csv", archive: "optional" },
  framer: { files: ".csv,text/csv", archive: "optional" },
  statamic: { files: null, archive: "required" },
  umbraco: { files: ".json,application/json", archive: "optional" },
};

/** /settings/import/:source: upload another system's export, and earlier imports from it. */
export function SiteImportsPage({ source }: { source: SiteImportSource }) {
  const imports = useSiteImports(source);
  return (
    <>
      <BackLink to="/settings/import">{t("import.title")}</BackLink>
      <LargeTitle
        title={t(`siteImport.${source}.title` as StringKey)}
        subtitle={t(`siteImport.${source}.subtitle` as StringKey)}
      />
      <div className="flex max-w-2xl flex-col gap-8">
        <UploadCard source={source} />
        {imports.data && imports.data.length > 0 && (
          <GroupedList header={t("wordpress.earlierHeader")}>
            {imports.data.map((item) => (
              <GroupedListRow
                key={item.id}
                icon={Globe}
                label={item.siteTitle || item.filename}
                description={formatDateTime(item.createdAt)}
                accessory={
                  <Badge tone={statusTones[item.status]}>
                    {t(`wordpress.status.${item.status}`)}
                  </Badge>
                }
                to={`/settings/import/${source}/${encodeURIComponent(item.id)}`}
              />
            ))}
          </GroupedList>
        )}
      </div>
    </>
  );
}

function UploadCard({ source }: { source: SiteImportSource }) {
  const [files, setFiles] = useState<File[]>([]);
  const [archive, setArchive] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const wants = uploads[source];
  const ready =
    wants.archive === "required" ? archive !== null : files.length > 0 || archive !== null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setError(null);
    setProgress(0);
    try {
      const parts: Record<string, File> = {};
      files.forEach((file, index) => {
        parts[`files-${index + 1}`] = file;
      });
      if (archive) parts.archive = archive;
      const created = await uploadFiles<SiteImport>(`/site-imports/${source}`, parts, setProgress);
      await queryClient.invalidateQueries({ queryKey: siteImportKeys.list(source) });
      void navigate({ to: `/settings/import/${source}/${encodeURIComponent(created.id)}` });
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card>
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
        <p className="text-body text-label-secondary">
          {t(`siteImport.${source}.howTo` as StringKey)}
        </p>
        {wants.files && (
          <FilePicker
            label={t(`siteImport.${source}.filesLabel` as StringKey)}
            accept={wants.files}
            multiple
            onPick={() => undefined}
            onPickAll={setFiles}
          />
        )}
        {wants.archive && (
          <FilePicker
            label={t(`siteImport.${source}.archiveLabel` as StringKey)}
            hint={t(`siteImport.${source}.archiveHint` as StringKey)}
            accept=".zip,application/zip"
            onPick={setArchive}
          />
        )}
        {error && (
          <p role="alert" className="text-footnote text-danger">
            {error}
          </p>
        )}
        <div>
          <Button type="submit" disabled={!ready || progress !== null}>
            {progress === null
              ? t("siteImport.upload")
              : t("wordpress.uploading", { percent: Math.round(progress * 100) })}
          </Button>
        </div>
      </form>
    </Card>
  );
}
