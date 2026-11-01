/**
 * A small client for the API, used to set up the content a test starts with. Tests then
 * check the result in the browser. It signs in like the admin does and keeps the cookie.
 */

const SESSION_COOKIE = "lintel_session";

export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    method: string,
    path: string,
    body: string,
  ) {
    super(`${method} ${path} answered ${status}: ${body}`);
    this.name = "ApiRequestError";
  }
}

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class ApiClient {
  #sessionToken: string | undefined;

  constructor(
    readonly apiUrl: string,
    sessionToken?: string,
  ) {
    this.#sessionToken = sessionToken;
  }

  /** The signed-in session, for handing to a browser as its cookie. */
  get sessionToken(): string {
    if (!this.#sessionToken) {
      throw new Error("This API client hasn't signed in.");
    }
    return this.#sessionToken;
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.send("POST", "/auth/sign-in", { email, password });
  }

  get<Result>(path: string) {
    return this.send<Result>("GET", path);
  }
  post<Result>(path: string, body?: unknown) {
    return this.send<Result>("POST", path, body);
  }
  put<Result>(path: string, body: unknown) {
    return this.send<Result>("PUT", path, body);
  }
  patch<Result>(path: string, body: unknown) {
    return this.send<Result>("PATCH", path, body);
  }
  delete(path: string) {
    return this.send<undefined>("DELETE", path);
  }

  /** Uploads a file the way the media library's file input does. */
  async upload<Result>(filename: string, contents: Buffer, contentType: string): Promise<Result> {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(contents)], { type: contentType }), filename);
    return this.request<Result>("POST", "/media", { body: form });
  }

  send<Result>(method: Method, path: string, body?: unknown): Promise<Result> {
    return this.request<Result>(method, path, {
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body), headers: { "content-type": "application/json" } }),
    });
  }

  private async request<Result>(
    method: Method,
    path: string,
    init: { body?: BodyInit; headers?: Record<string, string> },
  ): Promise<Result> {
    const headers: Record<string, string> = { ...init.headers };
    if (this.#sessionToken) {
      headers.cookie = `${SESSION_COOKIE}=${this.#sessionToken}`;
    }
    const response = await fetch(`${this.apiUrl}${path}`, { method, body: init.body, headers });
    this.keepSessionCookie(response);

    if (!response.ok) {
      throw new ApiRequestError(response.status, method, path, await response.text());
    }
    if (response.status === 204) {
      return undefined as Result;
    }
    const type = response.headers.get("content-type") ?? "";
    return (type.includes("json") ? await response.json() : await response.text()) as Result;
  }

  private keepSessionCookie(response: Response): void {
    for (const header of response.headers.getSetCookie()) {
      const match = new RegExp(`^${SESSION_COOKIE}=([^;]*)`).exec(header);
      if (match?.[1]) {
        this.#sessionToken = match[1];
      }
    }
  }
}
