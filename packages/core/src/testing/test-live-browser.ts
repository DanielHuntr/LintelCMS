import type { LiveClientMessage, LiveServerMessage } from "@lintel/builder-model";
import WebSocket from "ws";
import { SESSION_COOKIE_NAME } from "../auth/session-cookie.js";

type MessageOf<Type extends LiveServerMessage["type"]> = Extract<LiveServerMessage, { type: Type }>;

export interface TestBrowser {
  send: (message: LiveClientMessage) => void;
  sendRaw: (text: string) => void;
  /** Takes the first message of a type that passes `test`, already here or still to come. */
  next: <Type extends LiveServerMessage["type"]>(
    type: Type,
    test?: (message: MessageOf<Type>) => boolean,
  ) => Promise<MessageOf<Type>>;
  received: <Type extends LiveServerMessage["type"]>(type: Type) => MessageOf<Type>[];
  /** Resolves with the code the connection closed with. */
  closed: () => Promise<number>;
  close: () => void;
}

const WAIT_MILLISECONDS = 5000;

/** A browser for tests: a real WebSocket to a real listening server, signed in as someone. */
export function connectAs(
  address: string,
  cookies: Record<string, string>,
  origin = "http://localhost:5173",
): Promise<TestBrowser> {
  const socket = new WebSocket(`${address}/live`, {
    headers: { origin, cookie: `${SESSION_COOKIE_NAME}=${cookies[SESSION_COOKIE_NAME] ?? ""}` },
  });
  const messages: LiveServerMessage[] = [];
  const waiting = new Set<() => void>();
  let closeCode: number | undefined;
  socket.on("message", (data: Buffer) => {
    messages.push(JSON.parse(data.toString()) as LiveServerMessage);
    for (const check of [...waiting]) check();
  });
  socket.on("close", (code) => {
    closeCode = code;
    for (const check of [...waiting]) check();
  });
  socket.on("error", () => undefined);

  const until = <Value>(find: () => Value | undefined, what: string) =>
    new Promise<Value>((resolve, reject) => {
      const check = () => {
        const found = find();
        if (found === undefined) return;
        clearTimeout(timer);
        waiting.delete(check);
        resolve(found);
      };
      const timer = setTimeout(() => {
        waiting.delete(check);
        reject(new Error(`Waited for ${what}. Seen: ${JSON.stringify(messages).slice(0, 2000)}`));
      }, WAIT_MILLISECONDS);
      waiting.add(check);
      check();
    });

  const browser: TestBrowser = {
    send: (message) => socket.send(JSON.stringify(message)),
    sendRaw: (text) => socket.send(text),
    next: <Type extends LiveServerMessage["type"]>(
      type: Type,
      test: (message: MessageOf<Type>) => boolean = () => true,
    ) =>
      until(() => {
        const index = messages.findIndex(
          (message) => message.type === type && test(message as MessageOf<Type>),
        );
        if (index === -1) return undefined;
        return messages.splice(index, 1)[0] as MessageOf<Type>;
      }, type),
    received: <Type extends LiveServerMessage["type"]>(type: Type) =>
      messages.filter((message) => message.type === type) as MessageOf<Type>[],
    closed: () => until(() => closeCode, "the connection to close"),
    close: () => socket.close(),
  };
  return new Promise((resolve, reject) => {
    socket.on("open", () => resolve(browser));
    socket.on("unexpected-response", (_request, response) =>
      reject(new Error(`Refused with ${response.statusCode}`)),
    );
  });
}
