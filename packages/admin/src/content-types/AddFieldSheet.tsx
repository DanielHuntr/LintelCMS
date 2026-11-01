import { LoadError } from "../api/LoadError.js";
import { Dialog } from "../design/Dialog.js";
import { Skeleton } from "../design/Skeleton.js";
import type { FieldType } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { useFieldtypes } from "./blueprints.queries.js";
import { FieldtypeIcon } from "./fieldtypeIcons.js";

interface AddFieldSheetProps {
  open: boolean;
  onClose: () => void;
  onPick: (type: FieldType, name: string) => void;
}

/** "Add a field": every fieldtype, described in plain words, so people pick by what they need. */
export function AddFieldSheet({ open, onClose, onPick }: AddFieldSheetProps) {
  const fieldtypes = useFieldtypes();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("builder.addField.title")}
      description={t("builder.addField.description")}
    >
      {fieldtypes.isError && (
        <LoadError error={fieldtypes.error} onRetry={() => void fieldtypes.refetch()} />
      )}
      {fieldtypes.isPending && (
        <div className="flex flex-col gap-2 pb-5" aria-hidden="true">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-14 rounded-card" />
          ))}
        </div>
      )}
      {fieldtypes.data && (
        <ul className="-mx-2 grid grid-cols-1 gap-1 pb-4 sm:grid-cols-2">
          {fieldtypes.data.map((fieldtype) => (
            <li key={fieldtype.type}>
              <button
                type="button"
                onClick={() => onPick(fieldtype.type, fieldtype.name)}
                className="flex w-full items-start gap-3 rounded-card p-2.5 text-left transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-accent/12 text-accent">
                  <FieldtypeIcon type={fieldtype.type} className="size-[18px]" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                  <span className="text-body font-medium text-label">{fieldtype.name}</span>
                  <span className="text-footnote text-label-secondary">
                    {fieldtype.description}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
