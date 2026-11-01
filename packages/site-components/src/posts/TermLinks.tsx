import type { TermLink } from "../site.types.js";

/** A post's categories or tags as links to their archive pages. */
export function TermLinks({ label, terms }: { label: string; terms: readonly TermLink[] }) {
  if (terms.length === 0) {
    return null;
  }
  return (
    <div className="lintel-terms">
      <h2 className="lintel-terms__label">{label}</h2>
      <ul className="lintel-terms__list">
        {terms.map((term) => (
          <li key={term.url}>
            <a className="lintel-terms__link" href={term.url}>
              {term.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
