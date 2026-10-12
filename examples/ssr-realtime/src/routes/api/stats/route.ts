// How many event streams are open: the e2e tests check that a closed page unsubscribes.
import type { Endpoint } from "lumiose";
import { subscriberCount } from "../../../server/bus.server.ts";

export const mode = "server";

export const GET: Endpoint<"/api/stats"> = () =>
  Response.json({ subscribers: subscriberCount() }, { headers: { "cache-control": "no-store" } });
