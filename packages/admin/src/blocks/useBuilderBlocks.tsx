import type { BuilderBlocks } from "@lintel/builder";
import type { PageNode } from "@lintel/builder-model";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useMemo } from "react";
import { describeError } from "../api/describeError.js";
import type { Field } from "../fields/field.types.js";
import { useCan } from "../session/SessionContext.js";
import { asCustomBlock, createBlock } from "./blocks.api.js";
import { blockKeys, useBlocks } from "./blocks.queries.js";
import { BlockPropertyForm } from "./BlockPropertyForm.js";
import { pictureIdsOnPage, useBlockPictures } from "./useBlockPictures.js";
import { useServerBlocks } from "./useServerBlocks.js";

/**
 * What the page builder is given about the site's blocks: the library, the pictures and
 * server-drawn HTML the page's instances need, saving a new block (with `builder:blocks`),
 * opening one's design, and the property form drawn with the admin's field editors.
 * `root` is the page as it is now, so pictures picked in a form show straight away.
 */
export function useBuilderBlocks({
  root,
  beforeLeaving,
}: {
  root: PageNode | null;
  /** Saves the page before the builder opens a block's design. */
  beforeLeaving: () => void;
}): BuilderBlocks {
  const blocks = useBlocks();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const canManage = useCan("builder:blocks");
  const library = useMemo(() => (blocks.data ?? []).map(asCustomBlock), [blocks.data]);
  const pictures = useBlockPictures(
    useMemo(() => (root ? pictureIdsOnPage(root, library) : []), [root, library]),
  );
  const renderedBlocks = useServerBlocks(root, library);

  const create = useCallback<NonNullable<BuilderBlocks["create"]>>(
    async (draft) => {
      try {
        const made = await createBlock({
          name: draft.name,
          icon: draft.icon,
          category: draft.category,
          properties: draft.properties as unknown as Field[],
          design: draft.design,
        });
        await queryClient.invalidateQueries({ queryKey: blockKeys.blocks() });
        return asCustomBlock(made);
      } catch (error) {
        return { problem: describeError(error) };
      }
    },
    [queryClient],
  );

  const editDesign = useCallback(
    (handle: string) => {
      beforeLeaving();
      void navigate({ to: "/design/blocks/$handle/design", params: { handle } });
    },
    [beforeLeaving, navigate],
  );

  return useMemo(
    () => ({
      library,
      pictures,
      renderedBlocks,
      canManage,
      create: canManage ? create : undefined,
      editDesign: canManage ? editDesign : undefined,
      renderProperties: (form) => <BlockPropertyForm {...form} />,
    }),
    [library, pictures, renderedBlocks, canManage, create, editDesign],
  );
}
