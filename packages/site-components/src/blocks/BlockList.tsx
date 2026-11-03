import type { FaqBlock, SiteBlock } from "./block.types.js";
import { CallToAction } from "./CallToAction.js";
import { FaqList } from "./FaqList.js";
import { FormSection } from "./FormSection.js";
import { Hero } from "./Hero.js";
import { ImageSection } from "./ImageSection.js";
import { TextSection } from "./TextSection.js";

export interface BlockListProps {
  blocks: readonly SiteBlock[];
  /** True when the page shows no title of its own, so an opening hero's heading is the h1. */
  heroIsTitle?: boolean;
}

/** One run of the page: a block on its own, or questions next to each other. */
type BlockGroup =
  { kind: "single"; block: Exclude<SiteBlock, FaqBlock> } | { kind: "faq"; questions: FaqBlock[] };

/** Groups questions next to each other into one list, keeping everything else in order. */
export function groupBlocks(blocks: readonly SiteBlock[]): BlockGroup[] {
  const groups: BlockGroup[] = [];
  for (const block of blocks) {
    const last = groups[groups.length - 1];
    if (block.type === "faq") {
      if (last?.kind === "faq") {
        last.questions.push(block);
      } else {
        groups.push({ kind: "faq", questions: [block] });
      }
    } else {
      groups.push({ kind: "single", block });
    }
  }
  return groups;
}

/** A page's sections in order, each drawn by its own component. */
export function BlockList({ blocks, heroIsTitle = false }: BlockListProps) {
  return (
    <>
      {groupBlocks(blocks).map((group, index) =>
        group.kind === "faq" ? (
          <FaqList key={group.questions[0]?.id ?? index} questions={group.questions} />
        ) : (
          <SingleBlock
            key={group.block.id}
            block={group.block}
            isPageTitle={heroIsTitle && index === 0}
          />
        ),
      )}
    </>
  );
}

function SingleBlock({
  block,
  isPageTitle,
}: {
  block: Exclude<SiteBlock, FaqBlock>;
  isPageTitle: boolean;
}) {
  switch (block.type) {
    case "hero":
      return <Hero {...block} headingLevel={isPageTitle ? 1 : 2} />;
    case "text":
      return <TextSection {...block} />;
    case "image":
      return <ImageSection {...block} />;
    case "call_to_action":
      return <CallToAction {...block} />;
    case "design":
      return <DesignedSection html={block.html} css={block.css} />;
    case "form":
      return <FormSection {...block} />;
  }
}

/** The builder's own HTML, made safe by its renderer, in `.lintel-design` as on designed pages. */
function DesignedSection({ html, css }: { html: string; css: string }) {
  return (
    <>
      {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
      <div
        className="lintel-design"
        data-lintel-component="block"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
