import { Container } from "../layout/Container.js";
import { Section } from "../layout/Section.js";
import type { CallToActionBlock } from "./block.types.js";
import { Button } from "./Button.js";

export type CallToActionProps = Omit<CallToActionBlock, "type">;

/** A short invitation with a button, such as "Book a call", on a soft background. */
export function CallToAction({ id, heading, text, button }: CallToActionProps) {
  const headingId = `call-to-action-${id}`;
  return (
    <Section
      component="call_to_action"
      tone="muted"
      labelledBy={headingId}
      className="lintel-call-to-action"
    >
      <Container width="narrow">
        <div className="lintel-call-to-action__content">
          <h2 id={headingId} className="lintel-call-to-action__heading" data-lintel-field="heading">
            {heading}
          </h2>
          {text && (
            <p className="lintel-call-to-action__text" data-lintel-field="text">
              {text}
            </p>
          )}
          {button && <Button link={button} field="button" />}
        </div>
      </Container>
    </Section>
  );
}
