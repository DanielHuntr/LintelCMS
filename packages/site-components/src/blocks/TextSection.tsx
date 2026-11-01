import { Container } from "../layout/Container.js";
import { Section } from "../layout/Section.js";
import type { TextBlock } from "./block.types.js";
import { RichText } from "./RichText.js";

export type TextSectionProps = Omit<TextBlock, "type">;

/** Paragraphs, lists and subheadings, at a comfortable reading width. */
export function TextSection({ id, heading, body }: TextSectionProps) {
  const headingId = heading ? `text-${id}` : undefined;
  return (
    <Section component="text" labelledBy={headingId} className="lintel-text-section">
      <Container width="narrow">
        {heading && (
          <h2 id={headingId} className="lintel-text-section__heading" data-lintel-field="heading">
            {heading}
          </h2>
        )}
        <RichText html={body} field="body" />
      </Container>
    </Section>
  );
}
