import { ImagePlus } from "lucide-react";
import { useId, useRef, useState, type ChangeEvent } from "react";
import { Button } from "../design/Button.js";
import { classNames } from "../design/classNames.js";
import { t } from "../i18n/strings.js";

/** The server takes up to about 500 KB a picture; logos and favicons are far smaller. */
export const MAXIMUM_PICTURE_BYTES = 500 * 1024;

const acceptedTypes = "image/png,image/jpeg,image/webp,image/gif,image/svg+xml,image/x-icon";

interface BrandingImageFieldProps {
  label: string;
  hint: string;
  /** An uploaded picture (a data: URL) or a web address; null for none. */
  value: string | null;
  onChange: (value: string | null) => void;
  /** "square" for marks and favicons, "wide" for logos and backgrounds. */
  shape?: "square" | "wide";
  /** Show the preview on a dark background, for dark-mode logos. */
  onDark?: boolean;
  disabled?: boolean;
}

/** Choose, preview and remove one of the branding pictures. */
export function BrandingImageField({
  label,
  hint,
  value,
  onChange,
  shape = "wide",
  onDark = false,
  disabled = false,
}: BrandingImageFieldProps) {
  const inputId = useId();
  const hintId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState("");

  async function choose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > MAXIMUM_PICTURE_BYTES) {
      setProblem(t("branding.image.tooBig"));
      return;
    }
    setProblem("");
    onChange(await readAsDataUrl(file));
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-footnote font-medium text-label">
        {label}
      </label>
      <div className="flex items-center gap-4">
        <div
          className={classNames(
            "flex shrink-0 items-center justify-center overflow-hidden rounded-control hairline-ring",
            shape === "square" ? "size-14" : "h-14 w-40",
            onDark ? "bg-[#1c1c1e]" : "bg-fill/60",
          )}
        >
          {value ? (
            <img
              src={value}
              alt={t("branding.image.preview", { label })}
              className="max-h-full max-w-full object-contain p-1.5"
            />
          ) : (
            <ImagePlus
              aria-hidden="true"
              strokeWidth={1.5}
              className="size-5 text-label-tertiary"
            />
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <input
            ref={input}
            id={inputId}
            type="file"
            accept={acceptedTypes}
            className="sr-only"
            disabled={disabled}
            aria-describedby={hintId}
            onChange={(event) => void choose(event)}
          />
          <Button
            variant="tinted"
            size="small"
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            {value ? t("branding.image.replace") : t("branding.image.choose")}
          </Button>
          {value && (
            <Button variant="plain" size="small" disabled={disabled} onClick={() => onChange(null)}>
              {t("branding.image.remove")}
            </Button>
          )}
        </div>
      </div>
      <p
        id={hintId}
        role={problem ? "alert" : undefined}
        className={classNames("text-footnote", problem ? "text-danger" : "text-label-secondary")}
      >
        {problem || hint}
      </p>
    </div>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("The picture couldn't be read."));
    reader.readAsDataURL(file);
  });
}
