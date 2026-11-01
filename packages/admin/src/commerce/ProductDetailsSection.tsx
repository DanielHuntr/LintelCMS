import { ImagePlus } from "lucide-react";
import { Card } from "../design/Card.js";
import { TextField } from "../design/TextField.js";
import { FieldEditor } from "../fields/FieldEditor.js";
import type { Field, RichTextDocument } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { MediaPicker } from "../media/MediaPicker.js";
import type { ProductDraft } from "./productDraft.js";

interface SectionProps {
  draft: ProductDraft;
  onChange: (changes: Partial<ProductDraft>) => void;
  errors: Record<string, string>;
}

const descriptionField: Field = {
  handle: "description",
  label: "",
  type: "richText",
  required: false,
  options: {},
};

/** Title, description and photos: what a shopper reads first. */
export function ProductDetailsSection({ draft, onChange, errors }: SectionProps) {
  return (
    <Card title={t("shop.products.detailsHeader")}>
      <div className="flex flex-col gap-5">
        <TextField
          label={t("shop.products.titleLabel")}
          placeholder={t("shop.products.titlePlaceholder")}
          value={draft.title}
          maxLength={200}
          onChange={(event) => onChange({ title: event.target.value })}
          error={errors.title}
          required
          data-autofocus
        />
        <FieldEditor
          field={{ ...descriptionField, label: t("shop.products.descriptionLabel") }}
          value={draft.description}
          onChange={(_handle, value) => onChange({ description: value as RichTextDocument })}
          error={errors.description}
        />
        <ProductPhotos
          mediaIds={draft.mediaIds}
          onChange={(mediaIds) => onChange({ mediaIds })}
          error={errors.mediaIds}
        />
      </div>
    </Card>
  );
}

interface ProductPhotosProps {
  mediaIds: string[];
  onChange: (mediaIds: string[]) => void;
  error?: string;
}

/** The gallery: the first photo is the main one. Each is a media library image. */
function ProductPhotos({ mediaIds, onChange, error }: ProductPhotosProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-1.5 text-footnote font-medium text-label">
        {t("shop.products.photosLabel")}
      </legend>
      <p className="text-footnote text-label-secondary">{t("shop.products.photosHint")}</p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {mediaIds.map((assetId, index) => (
          <MediaPicker
            key={assetId}
            value={assetId}
            label={
              index === 0
                ? t("shop.products.mainPhoto")
                : t("shop.products.photoNumber", { number: index + 1 })
            }
            onChange={(chosen) =>
              onChange(
                chosen === null
                  ? mediaIds.filter((_, position) => position !== index)
                  : mediaIds.map((existing, position) => (position === index ? chosen : existing)),
              )
            }
          />
        ))}
        <div className="flex flex-col gap-1.5">
          <MediaPicker
            key={`add-${mediaIds.length}`}
            value={null}
            label={
              mediaIds.length === 0 ? t("shop.products.mainPhoto") : t("shop.products.addPhoto")
            }
            onChange={(chosen) => {
              if (chosen && !mediaIds.includes(chosen)) onChange([...mediaIds, chosen]);
            }}
          />
          {mediaIds.length === 0 && (
            <p className="flex items-center gap-1.5 text-footnote text-label-secondary">
              <ImagePlus aria-hidden="true" className="size-4" />
              {t("shop.products.photosEmpty")}
            </p>
          )}
        </div>
      </div>
      {error && (
        <p role="alert" className="text-footnote text-danger">
          {error}
        </p>
      )}
    </fieldset>
  );
}
