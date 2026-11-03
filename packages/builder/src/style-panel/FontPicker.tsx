import {
  type FontFormat,
  fontCatalogue,
  fontFamilyNameSchema,
  fontFamilyValue,
  fontTokens,
  type PageFont,
  pageFontFamily,
  tokenValue,
} from "@lintel/builder-model";
import { Plus, Upload } from "lucide-react";
import { useId, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { useSiteTokens } from "../site-design/site-design-context.js";
import { inputClassName, Labelled } from "../ui/controls.js";
import { useDesignTools } from "./design-tools.js";
import { overrideNoteFor, useStyleEditing, useStyleField } from "./style-field.js";

const formats: Record<string, FontFormat> = {
  "font/woff2": "woff2",
  "font/woff": "woff",
  "font/ttf": "truetype",
  "font/otf": "opentype",
};

/**
 * The element's font: the theme's two fonts, the fonts this page has added, and "Add a
 * font", which offers the fonts that come with Lintel (all open-licence, served from the
 * site itself) or uploading a font file (WOFF2, TTF or OTF) to the media library.
 */
export function FontPicker() {
  const text = useBuilderText();
  const tools = useDesignTools();
  const { target } = useStyleEditing();
  const field = useStyleField("fontFamily", text("pageBuilder.style.font"));
  const [isAdding, setIsAdding] = useState(false);
  const siteFonts = useSiteTokens("font");
  const choices = [
    ...[...fontTokens, ...siteFonts].map((token) => ({
      value: tokenValue(token),
      label: token.label,
    })),
    ...tools.pageFonts.map((font) => ({
      value: fontFamilyValue(font),
      label: pageFontFamily(font),
    })),
  ];
  const known = choices.some((choice) => choice.value === field.value);

  const addFont = (font: PageFont) => {
    const family = pageFontFamily(font);
    const alreadyThere = tools.pageFonts.some((existing) => pageFontFamily(existing) === family);
    if (!alreadyThere) {
      tools.changePageFonts(
        [...tools.pageFonts, font],
        text("pageBuilder.design.fontAdded", { name: family }),
      );
    }
    field.set(fontFamilyValue(font));
    setIsAdding(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <Labelled
        label={text("pageBuilder.style.font")}
        overridden={field.isOverridden ? text(overrideNoteFor(target)) : undefined}
        onReset={field.reset}
        resetLabel={text("pageBuilder.style.reset")}
      >
        {(id) => (
          <div className="flex gap-1">
            <select
              id={id}
              value={field.value ?? ""}
              onChange={(event) => field.set(event.target.value || undefined)}
              className={inputClassName}
            >
              <option value="">{text("pageBuilder.style.notSet")}</option>
              {!known && field.value && <option value={field.value}>{field.value}</option>}
              {choices.map((choice) => (
                <option key={choice.value} value={choice.value}>
                  {choice.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              aria-expanded={isAdding}
              onClick={() => setIsAdding((open) => !open)}
              className="flex h-8 shrink-0 items-center gap-1 rounded-control bg-fill px-2 text-caption font-medium text-label hover:bg-fill-strong focus-visible:focus-ring"
            >
              <Plus aria-hidden="true" className="size-3.5" />
              {text("pageBuilder.design.addFont")}
            </button>
          </div>
        )}
      </Labelled>
      {isAdding && <AddFont onAdd={addFont} />}
    </div>
  );
}

function AddFont({ onAdd }: { onAdd: (font: PageFont) => void }) {
  const text = useBuilderText();
  const tools = useDesignTools();
  const listId = useId();
  const [search, setSearch] = useState("");
  const shown = fontCatalogue.filter((font) =>
    `${font.family} ${font.description}`.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <div className="flex flex-col gap-2 rounded-control p-2 hairline-ring">
      <p className="text-caption text-label-tertiary">
        {text("pageBuilder.design.fontCatalogueHint")}
      </p>
      <Labelled label={text("pageBuilder.design.fontSearch")}>
        {(id) => (
          <input
            id={id}
            type="search"
            value={search}
            aria-controls={listId}
            onChange={(event) => setSearch(event.target.value)}
            className={inputClassName}
          />
        )}
      </Labelled>
      <ul id={listId} className="flex max-h-48 flex-col gap-0.5 overflow-auto">
        {shown.map((font) => (
          <li key={font.id}>
            <button
              type="button"
              onClick={() => onAdd({ source: "catalogue", id: font.id })}
              className="flex w-full flex-col items-start rounded-control px-2 py-1 text-start hover:bg-fill focus-visible:focus-ring"
            >
              <span className="text-footnote font-medium text-label">{font.family}</span>
              <span className="text-caption text-label-secondary">
                {font.description} · {text(`pageBuilder.design.fontCategory.${font.category}`)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {tools.uploadFile && <UploadFont onAdd={onAdd} />}
    </div>
  );
}

/** A font file from the computer: its name, weight and style, then the upload. */
function UploadFont({ onAdd }: { onAdd: (font: PageFont) => void }) {
  const text = useBuilderText();
  const tools = useDesignTools();
  const fileId = useId();
  const [family, setFamily] = useState("");
  const [weight, setWeight] = useState("400");
  const [style, setStyle] = useState<"normal" | "italic">("normal");
  const [problem, setProblem] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File | undefined) => {
    if (!file || !tools.uploadFile) return;
    const name = fontFamilyNameSchema.safeParse(
      family || file.name.replace(/\.[^.]+$/, "").replace(/[^A-Za-z0-9 -]+/g, " "),
    );
    if (!name.success) {
      setProblem(name.error.issues[0]?.message ?? text("pageBuilder.design.fontUploadFailed"));
      return;
    }
    setUploading(true);
    const uploaded = await tools.uploadFile(file).finally(() => setUploading(false));
    const format = uploaded ? formats[uploaded.mimeType] : undefined;
    if (!uploaded || !format) {
      setProblem(text("pageBuilder.design.fontUploadFailed"));
      return;
    }
    setProblem(null);
    const existing = tools.pageFonts.find(
      (font) => font.source === "upload" && font.family === name.data,
    );
    const newFile = { src: uploaded.src, assetId: uploaded.assetId, weight, style, format };
    onAdd(
      existing?.source === "upload"
        ? { ...existing, files: [...existing.files, newFile] }
        : { source: "upload", family: name.data, category: "sans", files: [newFile] },
    );
  };

  return (
    <div className="flex flex-col gap-2 border-t border-separator pt-2">
      <span className="text-caption font-semibold text-label">
        {text("pageBuilder.design.fontUpload")}
      </span>
      <Labelled label={text("pageBuilder.design.fontName")}>
        {(id) => (
          <input
            id={id}
            value={family}
            placeholder="Studio Sans"
            onChange={(event) => setFamily(event.target.value)}
            className={inputClassName}
          />
        )}
      </Labelled>
      <div className="grid grid-cols-2 gap-2">
        <Labelled label={text("pageBuilder.style.fontWeightExact")}>
          {(id) => (
            <select
              id={id}
              value={weight}
              onChange={(event) => setWeight(event.target.value)}
              className={inputClassName}
            >
              {["100", "200", "300", "400", "500", "600", "700", "800", "900"].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          )}
        </Labelled>
        <Labelled label={text("pageBuilder.style.fontStyle")}>
          {(id) => (
            <select
              id={id}
              value={style}
              onChange={(event) => setStyle(event.target.value as "normal" | "italic")}
              className={inputClassName}
            >
              <option value="normal">{text("pageBuilder.style.styleNormal")}</option>
              <option value="italic">{text("pageBuilder.style.styleItalic")}</option>
            </select>
          )}
        </Labelled>
      </div>
      <label
        htmlFor={fileId}
        className="flex h-8 cursor-pointer items-center gap-1.5 self-start rounded-control bg-fill px-2.5 text-caption font-medium text-label hover:bg-fill-strong focus-within:focus-ring"
      >
        <Upload aria-hidden="true" className="size-3.5" />
        {uploading
          ? text("pageBuilder.design.uploading")
          : text("pageBuilder.design.fontChooseFile")}
        <input
          id={fileId}
          type="file"
          accept=".woff2,.ttf,.otf,font/woff2,font/ttf,font/otf"
          className="sr-only"
          onChange={(event) => void upload(event.target.files?.[0])}
        />
      </label>
      {problem && (
        <p role="alert" className="text-caption text-danger">
          {problem}
        </p>
      )}
      <p className="text-caption text-label-tertiary">
        {text("pageBuilder.design.fontLicenceHint")}
      </p>
    </div>
  );
}
