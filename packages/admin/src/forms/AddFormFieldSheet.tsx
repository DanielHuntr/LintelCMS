import { Dialog } from "../design/Dialog.js";
import { t } from "../i18n/strings.js";
import { formFieldTypeInfo } from "./formFieldTypes.js";
import { formFieldTypes, type FormFieldType } from "./forms.types.js";

interface AddFormFieldSheetProps {
  open: boolean;
  onPick: (type: FormFieldType) => void;
  onClose: () => void;
}

/** Every kind of field, each with one plain line about what visitors get. */
export function AddFormFieldSheet({ open, onPick, onClose }: AddFormFieldSheetProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("forms.builder.addTitle")}
      description={t("forms.builder.addDescription")}
    >
      <ul className="grid gap-1 pt-1 sm:grid-cols-2">
        {formFieldTypes.map((type, index) => {
          const info = formFieldTypeInfo[type];
          const Icon = info.icon;
          return (
            <li key={type}>
              <button
                type="button"
                data-autofocus={index === 0 ? true : undefined}
                onClick={() => onPick(type)}
                className="flex w-full items-start gap-3 rounded-control p-2.5 text-left transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-control bg-accent/12 text-accent">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-body font-medium text-label">{t(info.name)}</span>
                  <span className="text-footnote text-label-secondary">{t(info.description)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
