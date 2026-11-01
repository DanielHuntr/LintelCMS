import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A small S3-compatible server for tests, speaking the part of the S3 API Lintel uses:
 * HEAD bucket, and PUT, GET, HEAD and DELETE object, in the path style MinIO uses
 * (`/<bucket>/<key>`), plus presigned GET links. The real AWS SDK talks to it, so tests
 * exercise the same requests a real bucket gets.
 *
 * It checks which access key signed each request (not the signature itself), which is
 * enough to test the "wrong keys" message. Run MinIO for a full check (see src/media/README.md).
 */
export const FAKE_S3_ACCESS_KEY = "test-access-key";
export const FAKE_S3_SECRET_KEY = "test-secret-key";

interface StoredObject {
  body: Buffer;
  contentType: string;
}

export interface FakeS3Request {
  method: string;
  path: string;
  headers: IncomingMessage["headers"];
  presigned: boolean;
}

export interface FakeS3Server {
  endpoint: string;
  /** Objects by bucket, then key. */
  buckets: Map<string, Map<string, StoredObject>>;
  requests: FakeS3Request[];
  close(): Promise<void>;
}

export async function startFakeS3Server(bucketNames: string[]): Promise<FakeS3Server> {
  const buckets = new Map(bucketNames.map((name) => [name, new Map<string, StoredObject>()]));
  const requests: FakeS3Request[] = [];

  const server = createServer((request, response) => {
    void handle(request, response).catch((error: unknown) => {
      sendError(response, 500, "InternalError", String(error));
    });
  });

  async function handle(request: IncomingMessage, response: ServerResponse) {
    const url = new URL(request.url ?? "/", "http://fake-s3");
    const [bucketName = "", ...keyParts] = url.pathname.slice(1).split("/");
    const key = keyParts.map(decodeURIComponent).join("/");
    const presigned = url.searchParams.has("X-Amz-Signature");
    const body = await readBody(request);
    requests.push({
      method: request.method ?? "",
      path: url.pathname,
      headers: request.headers,
      presigned,
    });

    if (!signedWithTestKey(request, url)) {
      return sendError(response, 403, "InvalidAccessKeyId", "The access key doesn't exist.");
    }
    const bucket = buckets.get(bucketName);
    if (!bucket) {
      return sendError(response, 404, "NoSuchBucket", "The bucket doesn't exist.");
    }

    if (key === "") {
      return response.writeHead(request.method === "HEAD" ? 200 : 405).end();
    }

    const stored = bucket.get(key);
    switch (request.method) {
      case "PUT":
        bucket.set(key, {
          body,
          contentType: request.headers["content-type"] ?? "application/octet-stream",
        });
        return response.writeHead(200, { etag: '"fake"' }).end();
      case "DELETE":
        bucket.delete(key);
        return response.writeHead(204).end();
      case "HEAD":
      case "GET": {
        if (!stored) {
          return sendError(
            response,
            404,
            "NoSuchKey",
            "The key doesn't exist.",
            request.method === "HEAD",
          );
        }
        response.writeHead(200, {
          "content-type": url.searchParams.get("response-content-type") ?? stored.contentType,
          "content-length": stored.body.length,
          ...(url.searchParams.has("response-content-disposition")
            ? { "content-disposition": url.searchParams.get("response-content-disposition") ?? "" }
            : {}),
        });
        return response.end(request.method === "GET" ? stored.body : undefined);
      }
      default:
        return response.writeHead(405).end();
    }
  }

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    endpoint: `http://127.0.0.1:${port}`,
    buckets,
    requests,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

function signedWithTestKey(request: IncomingMessage, url: URL): boolean {
  const credential =
    url.searchParams.get("X-Amz-Credential") ??
    /Credential=([^,\s]+)/.exec(request.headers.authorization ?? "")?.[1] ??
    "";
  return credential.startsWith(`${FAKE_S3_ACCESS_KEY}/`);
}

async function readBody(request: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

function sendError(
  response: ServerResponse,
  status: number,
  code: string,
  message: string,
  headOnly = false,
) {
  response.writeHead(status, { "content-type": "application/xml" });
  response.end(
    headOnly
      ? undefined
      : `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${message}</Message></Error>`,
  );
}
