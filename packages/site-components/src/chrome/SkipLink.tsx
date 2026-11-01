/** The id of the `<main>` element, which the skip link jumps to. */
export const MAIN_CONTENT_ID = "main-content";

/**
 * The first thing keyboard users reach: a link past the header to the page itself. Hidden
 * until it has focus. Output: `<a class="lintel-skip-link" href="#main-content">`.
 */
export function SkipLink({ label }: { label: string }) {
  return (
    <a className="lintel-skip-link" href={`#${MAIN_CONTENT_ID}`}>
      {label}
    </a>
  );
}
