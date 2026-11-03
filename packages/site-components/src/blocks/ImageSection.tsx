import { Container } from "../layout/Container.js";
import { Section } from "../layout/Section.js";
import { FigureCaption } from "../media/PhotoCredit.js";
import { ResponsiveImage } from "../media/ResponsiveImage.js";
import type { ImageBlock } from "./block.types.js";

export type ImageSectionProps = Omit<ImageBlock, "type">;

/**
 * A picture across the page in its own shape, with an optional caption below and the
 * photo's credit when its licence asks for one.
 */
export function ImageSection({ image, caption }: ImageSectionProps) {
  if (!image) {
    return null;
  }
  return (
    <Section component="image" className="lintel-image-section">
      <Container width="wide">
        <figure className="lintel-figure">
          <ResponsiveImage
            image={image}
            sizes="(max-width: 80rem) 100vw, 80rem"
            className="lintel-figure__image"
            field="image"
          />
          <FigureCaption
            caption={caption}
            credit={image.credit}
            className="lintel-figure__caption"
            captionProps={{ "data-lintel-field": "caption" }}
          />
        </figure>
      </Container>
    </Section>
  );
}
