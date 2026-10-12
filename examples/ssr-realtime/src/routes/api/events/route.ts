// Server-sent events: GET /api/events streams every message published on the bus until the client
// disconnects. The browser's EventSource reconnects by itself after a dropped connection.
import type { Endpoint } from "lumiose";
import { subscribe } from "../../../server/bus.server.ts";
import { eventStream } from "../../../server/event-stream.server.ts";

export const mode = "server";

export const GET: Endpoint<"/api/events"> = ({ request }) =>
  eventStream(request, (send) =>
    // The unsubscribe is the stream's cleanup: it runs when the client goes away.
    subscribe((message) => send("message", message, message.id)),
  );
