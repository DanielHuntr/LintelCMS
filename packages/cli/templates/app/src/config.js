/**
 * Everything the app needs to know, from the environment (and .env, read by main.js).
 * The client id and secret come from Lintel when the app is installed.
 *
 * @typedef {object} AppConfig
 * @property {number} port Where the app listens.
 * @property {string} appUrl Where Lintel and browsers reach the app.
 * @property {string} lintelAdminOrigin The Lintel admin that may show the app's pages.
 * @property {string} lintelApiUrl The Lintel API the app calls.
 * @property {string | undefined} clientId From Lintel, when the app is installed.
 * @property {string | undefined} clientSecret From Lintel, when the app is installed.
 */

/** @returns {AppConfig} */
export function readConfig(environment = process.env) {
  const port = Number(environment.PORT || 3200);
  return {
    port,
    appUrl: (environment.APP_URL || `http://localhost:${port}`).replace(/\/+$/, ""),
    lintelAdminOrigin: new URL(environment.LINTEL_ADMIN_URL || "http://localhost:5173").origin,
    lintelApiUrl: (environment.LINTEL_API_URL || "http://localhost:4000").replace(/\/+$/, ""),
    clientId: environment.LINTEL_CLIENT_ID || undefined,
    clientSecret: environment.LINTEL_CLIENT_SECRET || undefined,
  };
}
