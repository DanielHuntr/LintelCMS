/**
 * The app's lintel-app.json: what Lintel reads when someone adds the app, and shows them
 * in plain English before they agree. Every address is on the app's own address.
 *
 * Ask for as little as the app needs. Scopes: read_content, write_content,
 * publish_content, read_media, write_media, read_forms, and read_orders and write_orders
 * (only while the site's shop is on). Apps never get people, roles or settings.
 *
 * @param {import("./config.js").AppConfig} config
 */
export function appManifest(config) {
  const at = (path) => new URL(path, config.appUrl).href;
  return {
    name: "__APP_NAME__",
    handle: "__APP_HANDLE__",
    description: "Says hello inside Lintel and lists what was published lately.",
    appUrl: config.appUrl,
    scopes: ["read_content"],
    webhooks: [{ event: "entry.published", url: at("/webhooks") }],
    admin: {
      page: { label: "__APP_NAME__", url: at("/admin/page") },
    },
  };
}
