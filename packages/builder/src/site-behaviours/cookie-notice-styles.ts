/**
 * The cookie notice's look, added by its script, so sites without the notice carry none of
 * it. It follows the site's theme (colours, fonts, corners, light or dark), sits over the
 * page without moving anything, and only slides in for people who don't prefer less motion.
 */
export const cookieNoticeCss = `
.lintel-cookie-notice {
  position: fixed; z-index: 60; inset-inline: 0; inset-block-end: 0; box-sizing: border-box;
  padding: var(--lintel-space-3, 0.75rem); pointer-events: none;
  font-family: var(--lintel-font-body, system-ui, sans-serif); color: var(--lintel-color-text, #1c1c1e);
}
.lintel-cookie-notice *, .lintel-cookie-notice *::before, .lintel-cookie-notice *::after { box-sizing: border-box; }
.lintel-cookie-notice[hidden] { display: none; }
.lintel-cookie-notice__panel {
  pointer-events: auto; display: flex; flex-wrap: wrap; align-items: center;
  gap: var(--lintel-space-3, 0.75rem) var(--lintel-space-5, 1.5rem);
  max-inline-size: 68rem; margin-inline: auto; padding: var(--lintel-space-4, 1rem) var(--lintel-space-5, 1.5rem);
  background: var(--lintel-color-background, #fff); color: inherit;
  border: 1px solid var(--lintel-color-border, rgb(0 0 0 / 0.12)); border-radius: var(--lintel-radius-large, 16px);
  box-shadow: 0 10px 36px rgb(0 0 0 / 0.16);
}
.lintel-cookie-notice--corner { inset-inline-end: auto; max-inline-size: 26rem; }
.lintel-cookie-notice--corner .lintel-cookie-notice__panel { flex-direction: column; align-items: stretch; }
.lintel-cookie-notice__words { flex: 1 1 22rem; min-inline-size: 0; }
.lintel-cookie-notice--corner .lintel-cookie-notice__words { flex: none; }
.lintel-cookie-notice__heading {
  margin: 0 0 0.25rem; font-family: var(--lintel-font-heading, inherit); font-size: 1rem; font-weight: 600;
  line-height: 1.3; letter-spacing: normal; text-transform: none; color: inherit;
}
.lintel-cookie-notice__heading:focus { outline: none; }
.lintel-cookie-notice__heading:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
.lintel-cookie-notice__message { margin: 0; font-size: 0.9375rem; line-height: 1.5; color: var(--lintel-color-text-secondary, inherit); }
.lintel-cookie-notice__message a { color: inherit; text-decoration: underline; text-underline-offset: 0.2em; }
.lintel-cookie-notice__choices { flex-basis: 100%; display: grid; gap: 0.25rem; margin: 0; padding: 0; border: 0; min-inline-size: 0; }
.lintel-cookie-notice__choices[hidden] { display: none; }
.lintel-cookie-notice__legend {
  position: absolute; inline-size: 1px; block-size: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}
.lintel-cookie-notice__choice {
  display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-block-size: 2.75rem;
  padding: 0 0.25rem; border-block-end: 1px solid var(--lintel-color-border, rgb(0 0 0 / 0.12)); font-size: 0.9375rem; cursor: pointer;
}
.lintel-cookie-notice__choice:last-of-type { border-block-end: 0; }
.lintel-cookie-notice__choice input { inline-size: 1.25rem; block-size: 1.25rem; margin: 0; accent-color: var(--lintel-color-brand, currentColor); cursor: pointer; }
.lintel-cookie-notice__actions { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.lintel-cookie-notice__button {
  flex: 1 1 auto; min-block-size: 2.75rem; padding: 0 1.125rem; border-radius: var(--lintel-radius-button, 999px);
  font: inherit; font-size: 0.9375rem; font-weight: 600; line-height: 1.2; cursor: pointer; white-space: nowrap;
  border: 1px solid var(--lintel-color-text, #1c1c1e); background: var(--lintel-color-text, #1c1c1e); color: var(--lintel-color-background, #fff);
}
.lintel-cookie-notice__button--quiet { background: transparent; color: inherit; border-color: var(--lintel-color-border, rgb(0 0 0 / 0.2)); }
.lintel-cookie-notice__button:hover { opacity: 0.88; }
.lintel-cookie-notice__button:focus-visible { outline: 2px solid var(--lintel-color-text, currentColor); outline-offset: 2px; }
.lintel-cookie-notice-space { block-size: var(--lintel-cookie-notice-space, 0px); }
@media (max-width: 40rem) {
  .lintel-cookie-notice { padding: 0.5rem; }
  .lintel-cookie-notice__panel { padding: 1rem; }
  .lintel-cookie-notice--corner { max-inline-size: none; inset-inline-end: 0; }
  .lintel-cookie-notice__actions { inline-size: 100%; }
}
@media (prefers-reduced-motion: no-preference) {
  .lintel-cookie-notice__panel { animation: lintel-cookie-notice-in 0.24s ease-out both; }
}
@keyframes lintel-cookie-notice-in { from { opacity: 0; translate: 0 0.75rem; } }
@media (forced-colors: active) {
  .lintel-cookie-notice__panel { border-color: CanvasText; }
  .lintel-cookie-notice__button { border-color: ButtonText; }
}
`;
