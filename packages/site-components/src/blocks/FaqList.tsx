import { Container } from "../layout/Container.js";
import { Section } from "../layout/Section.js";
import type { FaqBlock } from "./block.types.js";
import { RichText } from "./RichText.js";

export interface FaqListProps {
  /** Questions next to each other on the page are shown as one list. */
  questions: ReadonlyArray<Omit<FaqBlock, "type">>;
}

/**
 * Questions that open to show their answers. Each is a native `<details>` disclosure, so
 * it works by keyboard, touch and screen reader, with no script, and the answers are in the
 * page for search engines. Output: `<div class="lintel-faq">` of
 * `<details class="lintel-faq__item"><summary>`.
 */
export function FaqList({ questions }: FaqListProps) {
  if (questions.length === 0) {
    return null;
  }
  return (
    <Section component="faq" className="lintel-faq-section">
      <Container width="narrow">
        <div className="lintel-faq">
          {questions.map((question) => (
            <details key={question.id} className="lintel-faq__item" data-lintel-block={question.id}>
              <summary className="lintel-faq__question" data-lintel-field="question">
                {question.question}
              </summary>
              <RichText html={question.answer} field="answer" className="lintel-faq__answer" />
            </details>
          ))}
        </div>
      </Container>
    </Section>
  );
}
