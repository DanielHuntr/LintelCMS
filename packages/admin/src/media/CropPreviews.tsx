import { coverPositionForFocalPoint, type FocalPoint } from "@lintel/core/media-crop";
import { t, type StringKey } from "../i18n/strings.js";

interface CropPreviewsProps {
  imageUrl: string;
  aspectRatio: number;
  focalPoint: FocalPoint;
}

const shapes: readonly { label: StringKey; ratio: number; width: string }[] = [
  { label: "media.detail.crops.square", ratio: 1, width: "w-[30%]" },
  { label: "media.detail.crops.wide", ratio: 16 / 9, width: "w-[40%]" },
  { label: "media.detail.crops.portrait", ratio: 4 / 5, width: "w-[24%]" },
];

/**
 * The image cropped to common shapes, around the focal point, using the same geometry as
 * the API, so editors see what their pages will show before they publish.
 */
export function CropPreviews({ imageUrl, aspectRatio, focalPoint }: CropPreviewsProps) {
  return (
    <section aria-labelledby="crop-previews-title">
      <h3 id="crop-previews-title" className="mb-2 text-footnote font-semibold text-label">
        {t("media.detail.crops.title")}
      </h3>
      <div className="flex items-end gap-3">
        {shapes.map((shape) => {
          const position = coverPositionForFocalPoint(aspectRatio, shape.ratio, focalPoint);
          return (
            <figure key={shape.label} className={`${shape.width} flex flex-col gap-1.5`}>
              <img
                src={imageUrl}
                alt=""
                draggable={false}
                className="w-full rounded-control bg-fill object-cover hairline-ring"
                style={{
                  aspectRatio: shape.ratio,
                  objectPosition: `${position.x * 100}% ${position.y * 100}%`,
                }}
              />
              <figcaption className="text-center text-caption text-label-secondary">
                {t(shape.label)}
              </figcaption>
            </figure>
          );
        })}
      </div>
    </section>
  );
}
