/**
 * Everything the app needs to know, from the environment. The client id and secret come
 * from Lintel when the app is installed (Build → Apps → Add an app).
 */
export interface AppConfig {
  port: number;
  /** Where this app is reached, as Lintel and browsers see it. */
  appUrl: string;
  /** The Lintel admin that may embed the app's pages. */
  lintelAdminOrigin: string;
  /** The Lintel API the app calls. */
  lintelApiUrl: string;
  clientId: string | undefined;
  clientSecret: string | undefined;
}

export function readConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(environment.PORT ?? 3100);
  return {
    port,
    appUrl: environment.APP_URL ?? `http://localhost:${port}`,
    lintelAdminOrigin: new URL(environment.LINTEL_ADMIN_URL ?? "http://localhost:5173").origin,
    lintelApiUrl: environment.LINTEL_API_URL ?? "http://localhost:4000",
    clientId: environment.LINTEL_CLIENT_ID || undefined,
    clientSecret: environment.LINTEL_CLIENT_SECRET || undefined,
  };
}

/** The app's `lintel-app.json`, with its own address filled in. */
export function appManifest(config: AppConfig) {
  const at = (path: string) => new URL(path, config.appUrl).href;
  return {
    name: "Publishing Log",
    handle: "publishing-log",
    description: "Keeps a log of everything published on your site, with who can see it.",
    icon: at("/assets/icon.svg"),
    appUrl: config.appUrl,
    developer: { name: "Lintel examples" },
    scopes: ["read_content"],
    webhooks: [
      { event: "entry.published", url: at("/webhooks") },
      { event: "entry.unpublished", url: at("/webhooks") },
    ],
    admin: {
      page: { label: "Publishing log", url: at("/admin/log") },
      dashboardWidgets: [
        {
          id: "recently-published",
          title: "Recently published",
          description: "The last few things that went live",
          url: at("/admin/widget"),
          size: "medium",
        },
      ],
      editorPanels: [{ id: "history", title: "Publishing log", url: at("/admin/panel") }],
      settingsPage: { url: at("/admin/settings") },
    },
  };
}
