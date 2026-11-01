import { createServer, type Socket } from "node:net";
import type { AddressInfo } from "node:net";

/**
 * Just enough of an SMTP server for tests: it greets, accepts AUTH PLAIN or LOGIN with the
 * expected user name and password, and keeps every message it is given. No encryption, so
 * the driver is used with `secure: false` and the server never offers STARTTLS.
 */
export interface ReceivedMail {
  from: string;
  to: string[];
  data: string;
}

export interface FakeSmtpServer {
  port: number;
  received: ReceivedMail[];
  close(): Promise<void>;
}

export async function startFakeSmtpServer(login: {
  user: string;
  password: string;
}): Promise<FakeSmtpServer> {
  const received: ReceivedMail[] = [];
  const sockets = new Set<Socket>();

  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
    let buffer = "";
    let mail: ReceivedMail = { from: "", to: [], data: "" };
    let readingData = false;
    let awaiting: "login-user" | "login-password" | undefined;
    let loginUser = "";
    const reply = (line: string) => socket.write(`${line}\r\n`);

    const accepts = (user: string, password: string) =>
      user === login.user && password === login.password;

    reply("220 fake-smtp ready");
    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      let end: number;
      while ((end = buffer.indexOf("\r\n")) !== -1) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 2);

        if (readingData) {
          if (line === ".") {
            readingData = false;
            received.push(mail);
            mail = { from: "", to: [], data: "" };
            reply("250 OK: queued");
          } else {
            mail.data += `${line.startsWith("..") ? line.slice(1) : line}\n`;
          }
          continue;
        }
        if (awaiting === "login-user") {
          loginUser = Buffer.from(line, "base64").toString();
          awaiting = "login-password";
          reply(`334 ${Buffer.from("Password:").toString("base64")}`);
          continue;
        }
        if (awaiting === "login-password") {
          awaiting = undefined;
          reply(
            accepts(loginUser, Buffer.from(line, "base64").toString())
              ? "235 OK"
              : "535 Authentication failed",
          );
          continue;
        }

        const command = line.toUpperCase();
        if (command.startsWith("EHLO") || command.startsWith("HELO")) {
          socket.write("250-fake-smtp\r\n250 AUTH PLAIN LOGIN\r\n");
        } else if (command.startsWith("AUTH PLAIN")) {
          const [, user = "", password = ""] = Buffer.from(line.slice(11), "base64")
            .toString()
            .split("\0");
          reply(accepts(user, password) ? "235 OK" : "535 Authentication failed");
        } else if (command.startsWith("AUTH LOGIN")) {
          awaiting = "login-user";
          reply(`334 ${Buffer.from("Username:").toString("base64")}`);
        } else if (command.startsWith("MAIL FROM:")) {
          mail.from = line.slice(10).replace(/[<>]/g, "").split(" ")[0] ?? "";
          reply("250 OK");
        } else if (command.startsWith("RCPT TO:")) {
          mail.to.push(line.slice(8).replace(/[<>]/g, "").trim());
          reply("250 OK");
        } else if (command === "DATA") {
          readingData = true;
          reply("354 End data with <CR><LF>.<CR><LF>");
        } else if (command === "QUIT") {
          reply("221 Bye");
          socket.end();
        } else {
          reply("250 OK");
        }
      }
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    port: (server.address() as AddressInfo).port,
    received,
    close: () =>
      new Promise<void>((resolve) => {
        for (const socket of sockets) socket.destroy();
        server.close(() => resolve());
      }),
  };
}
