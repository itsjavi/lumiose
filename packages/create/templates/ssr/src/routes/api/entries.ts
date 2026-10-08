// GET /api/entries: the guestbook as JSON.
import type { Endpoint } from "lumen";
import { listEntries } from "../../server/guestbook.server.ts";

export const GET: Endpoint = () => Response.json(listEntries());
