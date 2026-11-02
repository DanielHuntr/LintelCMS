import { markedSegments, planMarkDrawings, type TextMark } from "@lintel/builder-model";
import { Fragment, type ReactNode } from "react";

/**
 * A heading's or paragraph's text with its styled parts: italics as `<em>`, other styles as
 * `<span>` with a class from the page's stylesheet (`.title-mark-1`), linked words inside an
 * `<a>`, and line breaks typed in a text box as `<br>`. Without marks it is just the text.
 */
export function MarkedText({
  text,
  marks,
  className,
  linksWork = true,
}: {
  text: string;
  marks: readonly TextMark[] | undefined;
  /** The element's own class, which mark classes start with. */
  className: string;
  /** False on the canvas, where a click selects rather than follows a link. */
  linksWork?: boolean;
}): ReactNode {
  if (!marks || marks.length === 0) return withLineBreaks(text);
  const drawings = planMarkDrawings(marks);
  return markedSegments(text, marks).map((segment, index) => {
    const drawing = segment.markIndex === null ? undefined : drawings[segment.markIndex];
    if (!drawing) return <Fragment key={index}>{withLineBreaks(segment.text)}</Fragment>;
    const Tag = drawing.tag;
    const markClass =
      drawing.classNumber === null ? undefined : `${className}-mark-${drawing.classNumber}`;
    const href = segment.markIndex === null ? undefined : marks[segment.markIndex]?.href;
    const styled =
      href && drawing.tag === "span" && drawing.classNumber === null ? (
        withLineBreaks(segment.text)
      ) : (
        <Tag className={markClass}>{withLineBreaks(segment.text)}</Tag>
      );
    if (!href) return <Fragment key={index}>{styled}</Fragment>;
    return (
      <a key={index} href={linksWork ? href : undefined}>
        {styled}
      </a>
    );
  });
}

/** Line breaks typed in a text box become <br>, so a paragraph keeps its lines. */
export function withLineBreaks(text: string): ReactNode {
  const lines = text.split("\n");
  return lines.map((line, index) => (
    <Fragment key={index}>
      {index > 0 && <br />}
      {line}
    </Fragment>
  ));
}
