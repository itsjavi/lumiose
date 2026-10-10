// GET /api/entries: the guestbook as JSON.
import type { Endpoint } from "lumiose";
import { listEntries } from "../../server/guestbook.server.ts";

export const GET: Endpoint<"/api/entries"> = () => Response.json(listEntries());
