import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Newspaper } from "lucide-react";
import { type FormEvent, useState } from "react";
import { describeError } from "../api/describeError.js";
import { formatDateTime } from "../content/relativeTime.js";
import { BackLink } from "../design/BackLink.js";
import { Badge } from "../design/Badge.js";
import { Button } from "../design/Button.js";
import { Card } from "../design/Card.js";
import { GroupedList } from "../design/GroupedList.js";
import { GroupedListRow } from "../design/GroupedListRow.js";
import { LargeTitle } from "../design/LargeTitle.js";
import type { Tone } from "../design/tones.js";
import { t } from "../i18n/strings.js";
import { uploadFiles } from "./dataTools.api.js";
import { dataToolsKeys, useWordPressImports } from "./dataTools.queries.js";
import { FilePicker } from "./FilePicker.js";
import type { WordPressImport, WordPressImportStatus } from "./wordpressImport.api.js";

const statusTones: Record<WordPressImportStatus, Tone> = {
  ready: "neutral",
  running: "accent",
  paused: "warning",
  complete: "success",
};

/** /settings/import/wordpress: upload a WordPress export, and earlier imports. */
export function WordPressImportsPage() {
  const imports = useWordPressImports();

  return (
    <>
      <BackLink to="/settings/import">{t("import.title")}</BackLink>
      <LargeTitle title={t("wordpress.title")} subtitle={t("wordpress.subtitle")} />
      <div className="flex max-w-2xl flex-col gap-8">
        <UploadCard />
        {imports.data && imports.data.length > 0 && (
          <GroupedList header={t("wordpress.earlierHeader")}>
            {imports.data.map((item) => (
              <GroupedListRow
                key={item.id}
                icon={Newspaper}
                label={item.siteTitle || item.filename}
                description={formatDateTime(item.createdAt)}
                accessory={
                  <Badge tone={statusTones[item.status]}>{t(`wordpress.status.${item.status}`)}</Badge>
                }
                to={`/settings/import/wordpress/${encodeURIComponent(item.id)}`}
              />
            ))}
          </GroupedList>
        )}
      </div>
    </>
  );
}

function UploadCard() {
  const [exportFile, setExportFile] = useState<File | null>(null);
  const [contentFile, setContentFile] = useState<File | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!exportFile) return;
    setError(null);
    setProgress(0);
    try {
      const files: Record<string, File> = { export: exportFile };
      if (contentFile) files.content = contentFile;
      const created = await uploadFiles<WordPressImport>("/wordpress-imports", files, setProgress);
      await queryClient.invalidateQueries({ queryKey: dataToolsKeys.wordpressImports() });
      void navigate({ to: "/settings/import/wordpress/$importId", params: { importId: created.id } });
    } catch (failure) {
      setError(describeError(failure));
    } finally {
      setProgress(null);
    }
  }

  return (
    <Card>
      <form onSubmit={(event) => void submit(event)} className="flex flex-col gap-5">
        <p className="text-body text-label-secondary">{t("wordpress.howTo")}</p>
        <FilePicker
          label={t("wordpress.exportLabel")}
          accept=".xml,text/xml,application/xml"
          onPick={setExportFile}
        />
        <FilePicker
          label={t("wordpress.contentLabel")}
          hint={t("wordpress.contentHint")}
          accept=".zip,application/zip"
          onPick={setContentFile}
        />
        {error && (
          <p role="alert" className="text-footnote text-danger">
            {error}
          </p>
        )}
        <div>
          <Button type="submit" disabled={!exportFile || progress !== null}>
            {progress === null
              ? t("wordpress.upload")
              : t("wordpress.uploading", { percent: Math.round(progress * 100) })}
          </Button>
        </div>
      </form>
    </Card>
  );
}
