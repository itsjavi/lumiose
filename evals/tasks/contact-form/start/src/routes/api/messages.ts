// GET /api/messages: the stored contact messages as JSON.
import type { Endpoint } from "lumen";
import { listMessages } from "../../server/messages.server.ts";

export const GET: Endpoint<"/api/messages"> = () => Response.json(listMessages());
