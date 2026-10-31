/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Where the API runs. Defaults to http://localhost:4000. */
  readonly VITE_API_URL?: string;
  /** Set to "true" to include the /design-system review page in a production build. */
  readonly VITE_DESIGN_REVIEW?: string;
}
