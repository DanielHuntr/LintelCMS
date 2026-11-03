import { lazy, Suspense, useMemo } from "react";
import { Skeleton } from "../design/Skeleton.js";
import type { BlockType } from "../fields/field.types.js";
import { t } from "../i18n/strings.js";
import { asCustomBlock } from "./blocks.api.js";
import { useBlocks } from "./blocks.queries.js";

// The renderer is large; it loads with the first preview.
const BlockPreview = lazy(async () => ({
  default: (await import("./BlockPreview.js")).BlockPreview,
}));

/**
 * Under a block's fields in a blocks field, when the block type is one of the site's
 * blocks: how it will look with what has been filled in, updated as editors type, drawn as
 * the website will draw it.
 */
export function SiteBlockPreview({
  blockType,
  values,
}: {
  blockType: BlockType;
  values: Readonly<Record<string, unknown>>;
}) {
  const blocks = useBlocks();
  const found = blocks.data?.find((block) => block.handle === blockType.block);
  const block = useMemo(() => (found ? asCustomBlock(found) : null), [found]);
  if (!block) return null;
  return (
    <div className="flex flex-col gap-1.5" data-block-preview={block.handle}>
      <p className="text-footnote font-medium text-label-secondary">{t("blocksField.preview")}</p>
      <Suspense fallback={<Skeleton className="h-40 rounded-control" />}>
        <BlockPreview
          block={block}
          values={values}
          label={t("blocksField.previewLabel", { name: block.name })}
        />
      </Suspense>
    </div>
  );
}
