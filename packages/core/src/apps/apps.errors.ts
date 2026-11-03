import { HttpError } from "../http/http-errors.js";

export class AppNotFoundError extends HttpError {
  constructor() {
    super(404, "NOT_FOUND", "That app isn't installed. It may have been uninstalled already.");
  }
}

/** The manifest is there but something in it isn't right; `problems` lists each thing. */
export class InvalidAppManifestError extends HttpError {
  constructor(problems: string) {
    super(400, "INVALID_APP_MANIFEST", `This app's lintel-app.json needs fixing:\n${problems}`);
  }
}

export class AppManifestUnreachableError extends HttpError {
  constructor(address: string, reason: string) {
    super(
      400,
      "APP_MANIFEST_UNREACHABLE",
      `Lintel couldn't read the app's details from ${address}: ${reason}. Check the address with the app's developer.`,
    );
  }
}

export class AppAlreadyInstalledError extends HttpError {
  constructor(handle: string) {
    super(
      409,
      "APP_ALREADY_INSTALLED",
      `An app called “${handle}” is installed already. Uninstall it first to install it again.`,
    );
  }
}

/** The manifest asks for other access than the person approved, so nothing was installed. */
export class AppScopesChangedError extends HttpError {
  constructor() {
    super(
      409,
      "APP_SCOPES_CHANGED",
      "The app now asks for different access than you approved, so it wasn't installed. Please review it again.",
    );
  }
}

/** The app's pages would share the admin's own address, so its frames couldn't be sandboxed. */
export class AppOriginNotAllowedError extends HttpError {
  constructor(origin: string) {
    super(
      400,
      "APP_ORIGIN_NOT_ALLOWED",
      `Apps can't run on ${origin}, the address of Lintel itself. Host the app on its own address.`,
    );
  }
}

export class AppWebhookAddressError extends HttpError {
  constructor(hostname: string, onThisComputer: boolean) {
    super(
      400,
      "PRIVATE_WEBHOOK_ADDRESS",
      onThisComputer
        ? `The app wants webhooks sent to ${hostname}, on this computer. While you build an app, turn on development mode in Build → Apps.`
        : `The app wants webhooks sent to ${hostname}, a private or local address, which isn't allowed.`,
    );
  }
}

/** The app asks for access to a feature, such as the shop, that is switched off. */
export class AppNeedsFeaturesError extends HttpError {
  constructor(featureNames: readonly string[]) {
    super(
      409,
      "APP_NEEDS_FEATURES",
      `This app needs ${featureNames.join(" and ")}. Switch it on in Build → Features first.`,
      { features: [...featureNames] },
    );
  }
}

/** The server doesn't allow apps' development mode (APPS_DEVELOPMENT_MODE). */
export class AppDevelopmentModeUnavailableError extends HttpError {
  constructor() {
    super(
      409,
      "APP_DEVELOPMENT_MODE_UNAVAILABLE",
      "Development mode is only for building apps on your own computer. Start Lintel with APPS_DEVELOPMENT_MODE=true to allow it.",
    );
  }
}

/** Session tokens are for people looking at the app in the admin, not for API callers. */
export class SessionTokenNeedsAdminError extends HttpError {
  constructor() {
    super(
      403,
      "SESSION_TOKEN_NEEDS_ADMIN",
      "Session tokens are only given to people signed in to the admin.",
    );
  }
}

export class AppRateLimitedError extends HttpError {
  constructor(retryAfterSeconds: number) {
    super(
      429,
      "APP_RATE_LIMITED",
      `This app has made too many requests. Try again in ${retryAfterSeconds} seconds.`,
      { retryAfterSeconds },
    );
  }
}
