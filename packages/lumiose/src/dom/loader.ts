// `lumiose/dom/loader` (owner: Spark): the island loader's client entry (spec §7.2). The server adds
// it to pages with islands as `<script type="module" async src="…">` (async, so islands hydrate
// while the rest of the stream is still arriving). It hydrates islands from the app's manifest.
import islands from "virtual:lumiose/islands";
import { loadIslands } from "./islands.ts";

loadIslands(islands);
