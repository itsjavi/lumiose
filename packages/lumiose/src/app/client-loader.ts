// The island loader of apps with `src/instrumentation.client.ts` (decision-49, TASK-295): the
// loader of `lumiose/dom/loader`, whose islands load once the client entry ran (./client-entry.ts).
// `lumiose dev` and `lumiose build` use it instead of `lumiose/dom/loader` only for those apps.
import islands from "virtual:lumiose/islands";
import { loadIslands } from "../dom/islands.ts";
import { afterClientEntry, clientEntry } from "./client-entry.ts";

loadIslands(afterClientEntry(clientEntry())(islands));
