/**
 * The few element defaults the stand-in components need to look tidy: the theme's fonts and
 * colours on the body, pictures that fit their box, lists and quotes without browser
 * indents. Every element's own look is in its class. `@lintel/site-components` brings its
 * own base styles, which replace these.
 */
export const standInBaseStylesheet = `*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: var(--lintel-font-body);
  line-height: 1.55;
  color: var(--lintel-color-text);
  background-color: var(--lintel-color-background);
}

h1, h2, h3, h4, h5, h6 {
  margin: 0;
  font-family: var(--lintel-font-heading);
  line-height: 1.15;
  letter-spacing: -0.01em;
}

h1 { font-size: clamp(2.25rem, 5vw, 3.5rem); }
h2 { font-size: clamp(1.75rem, 3.5vw, 2.5rem); }
h3 { font-size: 1.375rem; }
h4 { font-size: 1.125rem; }
h5, h6 { font-size: 1rem; }

p, ul, ol, figure, blockquote {
  margin: 0;
}

ul, ol {
  padding-left: 1.25em;
}

img {
  display: block;
  max-width: 100%;
}

figure img {
  width: 100%;
  height: auto;
  border-radius: inherit;
}

figcaption {
  margin-top: var(--lintel-space-2);
  font-size: 0.875rem;
  color: var(--lintel-color-text-secondary);
}

a {
  color: var(--lintel-color-link, var(--lintel-color-brand));
}

nav ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--lintel-space-5);
  padding: 0;
  list-style: none;
}

nav a {
  color: inherit;
  text-decoration: none;
}

hr {
  margin: 0;
  border: 0;
}
`;
