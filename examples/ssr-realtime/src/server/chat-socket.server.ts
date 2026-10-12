// The WebSocket chat, with `ws`. Nothing in Lumiose handles WebSockets: the Node adapter's
// `createServer()` returns the `node:http` server, and server.ts passes its `upgrade` events here
// (in dev, vite.config.ts does the same with Vite's server). Every text message is broadcast to
// every connected socket.
import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import { MAX_TEXT, type Message } from "../lib/messages.ts";

export const CHAT_PATH = "/ws";

const sockets = new WebSocketServer({ noServer: true, maxPayload: 4 * MAX_TEXT });
let nextId = 1;

sockets.on("connection", (socket) => {
  socket.on("message", (data, isBinary) => {
    if (isBinary) return;
    const text = data.toString().trim().slice(0, MAX_TEXT);
    if (text === "") return;
    const message: Message = { id: nextId++, text, at: new Date().toISOString() };
    const payload = JSON.stringify(message);
    for (const client of sockets.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  });
});

/**
 * Handles an `upgrade` event for the chat's path and returns true; returns false for any other
 * path, which the caller refuses (or leaves to another handler, such as Vite's HMR in dev).
 */
export function handleUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer,
  origin: string | undefined = process.env.ORIGIN,
): boolean {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  if (pathname !== CHAT_PATH) return false;
  // A browser sends its page's origin with the handshake, and the same-origin policy does not apply
  // to WebSockets: refuse other sites (cross-site WebSocket hijacking), as the form check does.
  if (!sameSite(request, origin)) {
    socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\nContent-Length: 0\r\n\r\n");
    return true;
  }
  sockets.handleUpgrade(request, socket, head, (ws) => sockets.emit("connection", ws, request));
  return true;
}

function sameSite(request: IncomingMessage, origin: string | undefined): boolean {
  const from = request.headers.origin;
  if (from === undefined) return true; // not a browser
  try {
    const host = origin === undefined ? request.headers.host : new URL(origin).host;
    return new URL(from).host === host;
  } catch {
    return false;
  }
}

/** Closes every socket, for a graceful shutdown. */
export function closeChat(): void {
  for (const client of sockets.clients) client.close(1001, "server shutting down");
}
