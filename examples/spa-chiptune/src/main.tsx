import { mount } from "lumen/dom";
import { frameStats, resetFrameStats } from "./frame.ts";
import { readSong, restoreSession } from "./state.ts";
import { App } from "./ui/App.stsx";

// Reopen the last song (or save the demo as the first one) before the first render.
restoreSession();
mount(() => <App />, document.getElementById("app")!);

// A small handle for the e2e tests and the curious: frame timing and the open song.
Object.assign(globalThis, { chiptune: { frameStats, resetFrameStats, song: readSong } });
