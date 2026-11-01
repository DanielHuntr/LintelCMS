import {
  buildBlockDesign,
  cannotMakeBlockFrom,
  type ComponentCatalogue,
  type CustomBlock,
  type PageDocument,
  type PageNode,
} from "@lintel/builder-model";
import { Component } from "lucide-react";
import { useMemo, useState } from "react";
import { useBuilderText } from "../i18n/builder-text.js";
import { currentChoices, remapBlockDesign } from "./block-commands.js";
import { useBlockMaster, useBuilderBlocks } from "./blocks-context.js";
import { MakeBlockDialog } from "./MakeBlockDialog.js";

/**
 * Under the selected element's panel: **Make into a block** for people who may make blocks,
 * and, while editing a block's design, **Choose what editors can change**.
 */
export function BlockTools({
  document,
  node,
  nodeName,
  catalogue,
  onMadeBlock,
  onReplaceDesign,
}: {
  document: PageDocument;
  node: PageNode | null;
  nodeName: string;
  catalogue: ComponentCatalogue;
  onMadeBlock: (nodeId: string, block: CustomBlock) => void;
  onReplaceDesign: (nodeId: string, design: PageNode) => void;
}) {
  const text = useBuilderText();
  const blocks = useBuilderBlocks();
  const master = useBlockMaster();
  const [dialog, setDialog] = useState<"make" | "map" | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const categories = useMemo(
    () => [...new Set(blocks.library.map((block) => block.category).filter(Boolean))],
    [blocks.library],
  );
  const design = master ? document.root.children[0] : undefined;

  if (master) {
    if (master.isReadOnly || !design) return null;
    return (
      <div className="hairline-top px-4 py-3">
        <button
          type="button"
          onClick={() => setDialog("map")}
          className="flex h-8 w-full items-center justify-center gap-2 rounded-control bg-fill px-3 text-footnote font-medium text-accent hover:bg-fill-secondary focus-visible:focus-ring"
        >
          <Component aria-hidden="true" className="size-4" />
          {text("pageBuilder.blocks.mapButton")}
        </button>
        {dialog === "map" && (
          <MakeBlockDialog
            mode="map"
            design={design}
            designName={master.block.name}
            catalogue={catalogue}
            initialChoices={currentChoices(design, master.block.properties, catalogue)}
            onCancel={() => setDialog(null)}
            onSubmit={async ({ choices }) => {
              const remapped = remapBlockDesign(
                design,
                choices,
                master.block.properties,
                catalogue,
              );
              onReplaceDesign(design.id, remapped.design);
              master.onPropertiesChange(remapped.properties);
              setDialog(null);
              return null;
            }}
          />
        )}
      </div>
    );
  }

  if (!node || !blocks.canManage || !blocks.create || node.type === "customBlock") return null;
  const create = blocks.create;
  const open = () => {
    const reason = cannotMakeBlockFrom(node);
    if (reason) {
      setRefusal(
        text(
          reason === "page"
            ? "pageBuilder.blocks.cantMakePage"
            : "pageBuilder.blocks.cantMakeWithBlock",
        ),
      );
      return;
    }
    setRefusal(null);
    setDialog("make");
  };

  return (
    <div className="flex flex-col gap-1.5 hairline-top px-4 py-3">
      <button
        type="button"
        onClick={open}
        className="flex h-8 w-full items-center justify-center gap-2 rounded-control bg-fill px-3 text-footnote font-medium text-accent hover:bg-fill-secondary focus-visible:focus-ring"
      >
        <Component aria-hidden="true" className="size-4" />
        {text("pageBuilder.blocks.make")}
      </button>
      {refusal && (
        <p role="alert" className="text-caption text-warning">
          {refusal}
        </p>
      )}
      {dialog === "make" && (
        <MakeBlockDialog
          mode="create"
          design={node}
          designName={nodeName}
          catalogue={catalogue}
          categories={categories}
          onCancel={() => setDialog(null)}
          onSubmit={async ({ name, icon, category, choices }) => {
            const { design: blockDesign, properties } = buildBlockDesign(node, choices, catalogue);
            const made = await create({ name, icon, category, design: blockDesign, properties });
            if ("problem" in made) return made.problem;
            onMadeBlock(node.id, made);
            setDialog(null);
            return null;
          }}
        />
      )}
    </div>
  );
}
