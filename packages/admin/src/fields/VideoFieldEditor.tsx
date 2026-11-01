import { describeVideoAddress } from "@lintel/core/video-addresses";
import { classNames } from "../design/classNames.js";
import { controlClasses } from "../design/controlStyles.js";
import { t } from "../i18n/strings.js";
import type { FieldEditorProps } from "./fieldEditorProps.js";
import { textValue } from "./fieldValues.js";

/**
 * A video's address, with the player shown underneath once the address is one Lintel knows
 * (YouTube, Vimeo, or an https link to a video file), so editors can see it is the right one.
 */
export function VideoFieldEditor({
  field,
  value,
  onChange,
  controlId,
  describedBy,
  hasError,
}: FieldEditorProps) {
  const address = textValue(value);
  const video = address === "" ? null : describeVideoAddress(address.trim());

  return (
    <div className="flex flex-col gap-2">
      <input
        id={controlId}
        type="url"
        inputMode="url"
        value={address}
        placeholder={field.placeholder || t("fields.video.placeholder")}
        onChange={(event) => onChange(event.target.value === "" ? null : event.target.value)}
        aria-required={field.required || undefined}
        aria-invalid={hasError || undefined}
        aria-describedby={describedBy}
        className={classNames("h-10", controlClasses({ hasError }))}
      />
      {address !== "" && !video && (
        <p className="text-footnote text-label-secondary">{t("fields.video.unknown")}</p>
      )}
      {video && (
        <div className="aspect-video w-full max-w-md overflow-hidden rounded-card bg-fill">
          {video.provider === "file" ? (
            <video src={video.embedUrl} controls preload="metadata" className="size-full" />
          ) : (
            <iframe
              src={video.embedUrl}
              title={t("fields.video.preview", { label: field.label })}
              loading="lazy"
              allow="encrypted-media; picture-in-picture"
              sandbox="allow-scripts allow-same-origin allow-presentation"
              className="size-full"
            />
          )}
        </div>
      )}
    </div>
  );
}
