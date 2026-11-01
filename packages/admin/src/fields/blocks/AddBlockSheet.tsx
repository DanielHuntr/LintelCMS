import { Dialog } from "../../design/Dialog.js";
import { t } from "../../i18n/strings.js";
import type { BlockType } from "../field.types.js";
import { BlockTypeIcon } from "./blockIcons.js";

interface AddBlockSheetProps {
  open: boolean;
  fieldLabel: string;
  blockTypes: readonly BlockType[];
  onClose: () => void;
  onPick: (blockType: BlockType) => void;
}

/** "Add a block": every block type with its plain description, so editors pick by purpose. */
export function AddBlockSheet({
  open,
  fieldLabel,
  blockTypes,
  onClose,
  onPick,
}: AddBlockSheetProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("fields.blocks.addTitle")}
      description={t("fields.blocks.addDescription", { label: fieldLabel })}
    >
      <ul className="-mx-2 grid grid-cols-1 gap-1 pb-4 sm:grid-cols-2">
        {blockTypes.map((blockType, index) => {
          return (
            <li key={blockType.handle}>
              <button
                type="button"
                data-autofocus={index === 0 ? true : undefined}
                onClick={() => onPick(blockType)}
                className="flex w-full items-start gap-3 rounded-card p-2.5 text-start transition-colors duration-150 ease-standard hover:bg-fill focus-visible:focus-ring"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-[9px] bg-accent/12 text-accent">
                  <BlockTypeIcon handle={blockType.handle} className="size-[18px]" />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5 pt-0.5">
                  <span className="text-body font-medium text-label">{blockType.name}</span>
                  {blockType.description && (
                    <span className="text-footnote text-label-secondary">
                      {blockType.description}
                    </span>
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}
