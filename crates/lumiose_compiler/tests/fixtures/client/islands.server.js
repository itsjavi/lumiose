// Island call sites (contract doc-2 §5.5): `island(ref, X, props, strategy, value?, slots?)` on the
// server, with JSX-valued props and children as slots; a plain component call on the client.
import { TeamPanel } from "./components/Team.stsx";
import Chart from "../charts/Chart.tsx";
import * as ui from "./ui.stsx";
import { ssr, insert, insertText, createComponent, island } from "lumiose/server";
import "/src/islands.stsx?lumiose&type=style&lang.css";
const _s0 = ["<b>", "</b>"];
const _s1 = ["<i></i>"];
const _s2 = ["<p data-l-k3v7p5ya>footer</p>"];
const _s3 = ["<svg data-l-k3v7p5ya></svg>"];
const _s4 = [
	"<main data-l-k3v7p5ya>",
	"",
	"",
	"",
	"",
	"",
	"",
	"</main>"
];
export function Local(props) {
	return ssr(_s0, insertText(props.n));
}
function Hidden() {
	return ssr(_s1);
}
export default function Page(props) {
	return ssr(_s4, insert(island("/src/components/Team.stsx#TeamPanel", TeamPanel, { ids: props.ids }, "visible", void 0, { children: () => ssr(_s2) })), insert(island("/src/components/Team.stsx#TeamPanel", TeamPanel, { ids: [] }, "visible", "200px")), insert(island("/charts/Chart.tsx#default", Chart, {
		title: "x",
		class: "wide",
		$$scope: "data-l-k3v7p5ya"
	}, "media", props.query, { icon: () => ssr(_s3) })), insert(island("/src/ui.stsx#Tabs", ui.Tabs, {}, "idle")), insert(island("/src/islands.stsx#Local", Local, { n: 1 }, "load")), insert(createComponent(Hidden, {})), insert(createComponent(TeamPanel, { ids: [] })));
}

// --- diagnostics ---
// LUM4001 error 23:8 the island component `Hidden` is not exported, so the browser cannot import it
// LUM1002 error 24:18 unknown island directive `client:soon`
