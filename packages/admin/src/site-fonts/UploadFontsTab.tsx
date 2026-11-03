import { Upload, X } from "lucide-react";
import { type DragEvent, useId, useState } from "react";
import { describeFontError } from "./describeFontError.js";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { SelectField } from "../design/SelectField.js";
import { TextField } from "../design/TextField.js";
import { useToast } from "../design/Toast.js";
import { t } from "../i18n/strings.js";
import { uploadAsset } from "../media/media.api.js";
import { categoryName, fontCategories, fontWeights, styleName, weightName } from "./fontLabels.js";
import {
  type FontCategory,
  type FontStyle,
  type InspectedFontFile,
  inspectFontFiles,
} from "./siteFonts.api.js";
import { useAddUploadedFont } from "./siteFonts.queries.js";

const accepted = ".woff2,.ttf,.otf,font/woff2,font/ttf,font/otf";

/** The most common name the files gave, so a family's files land together. */
function mostCommonFamily(files: readonly InspectedFontFile[]): string {
  const counts = new Map<string, number>();
  for (const file of files) counts.set(file.family, (counts.get(file.family) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

/**
 * Your own font files: drop or choose several at once (one per weight and style). Each is
 * uploaded to the media library, and Lintel reads its name, weight and style from inside
 * the file (or guesses from its file name); everything can be changed before adding. The
 * maker ticks one box to say their licence covers use on a website.
 */
export function UploadFontsTab({ onAdded }: { onAdded: () => void }) {
  const inputId = useId();
  const [files, setFiles] = useState<InspectedFontFile[]>([]);
  const [family, setFamily] = useState("");
  const [category, setCategory] = useState<FontCategory>("sans");
  const [licence, setLicence] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const add = useAddUploadedFont();
  const toast = useToast();

  async function receive(chosen: readonly File[]) {
    if (chosen.length === 0) return;
    setIsUploading(true);
    const failed: string[] = [];
    const assetIds: string[] = [];
    for (const file of chosen) {
      try {
        assetIds.push((await uploadAsset(file, () => undefined)).id);
      } catch (error) {
        failed.push(
          t("siteFonts.upload.failed", { file: file.name, reason: describeFontError(error) }),
        );
      }
    }
    try {
      if (assetIds.length > 0) {
        const inspected = (await inspectFontFiles(assetIds)).files;
        const all = [...files, ...inspected];
        setFiles(all);
        if (!family) setFamily(mostCommonFamily(all));
      }
    } catch (error) {
      failed.push(describeFontError(error));
    }
    setProblems(failed);
    setIsUploading(false);
  }

  const change = (assetId: string, changes: Partial<InspectedFontFile>) =>
    setFiles((current) =>
      current.map((file) => (file.assetId === assetId ? { ...file, ...changes } : file)),
    );

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    void receive([...event.dataTransfer.files]);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto">
      <label
        htmlFor={inputId}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={classNames(
          "flex cursor-pointer flex-col items-center gap-2 rounded-card border border-dashed px-4 py-6 text-center has-[:focus-visible]:focus-ring",
          isDragging ? "border-accent bg-accent/8" : "border-separator bg-surface",
        )}
      >
        <Upload aria-hidden="true" className="size-5 text-accent" />
        <span className="text-body font-medium text-accent">
          {isUploading ? t("siteFonts.upload.uploading") : t("siteFonts.upload.choose")}
        </span>
        <span className="text-footnote text-label-secondary">{t("siteFonts.upload.drop")}</span>
        <input
          id={inputId}
          type="file"
          multiple
          accept={accepted}
          disabled={isUploading}
          className="sr-only"
          onChange={(event) => {
            void receive([...(event.target.files ?? [])]);
            event.target.value = "";
          }}
        />
      </label>
      {problems.map((problem) => (
        <p key={problem} role="alert" className="text-footnote text-danger">
          {problem}
        </p>
      ))}

      {files.length > 0 && (
        <>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
            <TextField
              label={t("siteFonts.upload.family")}
              value={family}
              maxLength={60}
              onChange={(event) => setFamily(event.target.value)}
            />
            <SelectField
              label={t("siteFonts.upload.category")}
              value={category}
              onValueChange={(value) => setCategory(value as FontCategory)}
              options={fontCategories.map((value) => ({ value, label: categoryName(value) }))}
            />
          </div>
          <ul className="overflow-hidden rounded-card bg-surface">
            {files.map((file) => (
              <FileRow
                key={file.assetId}
                file={file}
                onChange={(changes) => change(file.assetId, changes)}
                onRemove={() => setFiles((current) => current.filter((each) => each !== file))}
              />
            ))}
          </ul>
          <label className="flex items-start gap-2.5 text-body text-label">
            <input
              type="checkbox"
              checked={licence}
              onChange={(event) => setLicence(event.target.checked)}
              className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]"
            />
            {t("siteFonts.upload.licence")}
          </label>
          {add.isError && (
            <p role="alert" className="text-footnote text-danger">
              {describeFontError(add.error)}
            </p>
          )}
          <div className="flex justify-end">
            <Button
              disabled={!licence || !family.trim() || add.isPending}
              onClick={() =>
                add.mutate(
                  {
                    family: family.trim(),
                    category,
                    licenceConfirmed: true,
                    files: files.map(({ assetId, weight, style }) => ({ assetId, weight, style })),
                  },
                  {
                    onSuccess: (font) => {
                      toast({
                        message: t("siteFonts.upload.added", { family: font.family }),
                        tone: "neutral",
                      });
                      onAdded();
                    },
                  },
                )
              }
            >
              {t("siteFonts.upload.add")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function FileRow({
  file,
  onChange,
  onRemove,
}: {
  file: InspectedFontFile;
  onChange: (changes: Partial<InspectedFontFile>) => void;
  onRemove: () => void;
}) {
  const selectClasses =
    "h-9 w-32 shrink-0 rounded-control bg-fill px-2 text-footnote text-label focus-visible:focus-ring";
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5 not-last:hairline-bottom">
      <span className="flex min-w-0 flex-1 basis-40 flex-col">
        <span className="truncate text-body text-label">{file.filename}</span>
        {!file.readFromFile && (
          <span className="text-caption text-label-secondary">{t("siteFonts.upload.guessed")}</span>
        )}
      </span>
      <select
        aria-label={t("siteFonts.upload.weight", { file: file.filename })}
        value={file.weight}
        onChange={(event) => onChange({ weight: event.target.value })}
        className={selectClasses}
      >
        {fontWeights.map((weight) => (
          <option key={weight} value={weight}>
            {weightName(weight)}
          </option>
        ))}
      </select>
      <select
        aria-label={t("siteFonts.upload.style", { file: file.filename })}
        value={file.style}
        onChange={(event) => onChange({ style: event.target.value as FontStyle })}
        className={selectClasses}
      >
        {(["normal", "italic"] as const).map((style) => (
          <option key={style} value={style}>
            {styleName(style)}
          </option>
        ))}
      </select>
      <button
        type="button"
        aria-label={t("siteFonts.upload.removeFile", { file: file.filename })}
        onClick={onRemove}
        className="flex size-8 items-center justify-center rounded-full text-label-secondary hover:bg-fill focus-visible:focus-ring"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </li>
  );
}
