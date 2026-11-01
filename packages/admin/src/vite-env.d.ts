/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the API runs. Defaults to http://localhost:4000. */
  readonly VITE_API_URL?: string;
  /** Set to "true" to include the /design-system review page in a production build. */
  readonly VITE_DESIGN_REVIEW?: string;
  /** Where the full docs are published, for the help panel's links. See src/help/docsLinks.ts. */
  readonly VITE_DOCS_URL?: string;
  /** Set to "true" to offer the pseudo-languages for testing translations. See src/i18n. */
  readonly VITE_PSEUDO_LANGUAGES?: string;
}
