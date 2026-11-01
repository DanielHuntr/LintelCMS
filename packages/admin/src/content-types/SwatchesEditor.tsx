import { Plus, X } from "lucide-react";
import { Button } from "../design/Button.js";
import { t } from "../i18n/strings.js";

interface SwatchesEditorProps {
  swatches: readonly string[];
  onChange: (swatches: string[]) => void;
}

/** The colours a colour field suggests, such as the brand's. Each opens the colour picker. */
export function SwatchesEditor({ swatches, onChange }: SwatchesEditorProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-footnote font-medium text-label">{t("builder.swatches")}</p>
      {swatches.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {swatches.map((swatch, index) => (
            <li key={index} className="flex items-center gap-1 rounded-full bg-fill py-1 pe-1 ps-1">
              <input
                type="color"
                value={swatch}
                aria-label={t("builder.swatchNumbered", { number: index + 1 })}
                onChange={(event) =>
                  onChange(
                    swatches.map((existing, position) =>
                      position === index ? event.target.value : existing,
                    ),
                  )
                }
                className="size-7 cursor-pointer rounded-full bg-transparent focus-visible:focus-ring"
              />
              <span className="font-mono text-caption text-label-secondary">{swatch}</span>
              <button
                type="button"
                onClick={() => onChange(swatches.filter((_, position) => position !== index))}
                aria-label={t("builder.removeSwatch", { colour: swatch })}
                className="flex size-6 items-center justify-center rounded-full text-label-secondary hover:text-danger focus-visible:focus-ring"
              >
                <X aria-hidden="true" strokeWidth={2} className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-footnote text-label-secondary">{t("builder.swatchesHint")}</p>
      <Button
        variant="plain"
        size="small"
        icon={<Plus aria-hidden="true" />}
        onClick={() => onChange([...swatches, "#0071e3"])}
        disabled={swatches.length >= 24}
        className="self-start"
      >
        {t("builder.addSwatch")}
      </Button>
    </div>
  );
}
