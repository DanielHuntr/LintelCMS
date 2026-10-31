/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set to "true" to include the /design-system review page in a production build. */
  readonly VITE_DESIGN_REVIEW?: string;
}
