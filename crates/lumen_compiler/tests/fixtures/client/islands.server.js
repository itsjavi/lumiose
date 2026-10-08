// @scope Page=data-l-p1
// Island call sites (contract doc-2 §5.5): `island(ref, X, props, strategy, value?, slots?)` on the
// server, with JSX-valued props and children as slots; a plain component call on the client.
import { TeamPanel } from "./components/Team.stsx";
import Chart from "../charts/Chart.tsx";
import * as ui from "./ui.stsx";
import { ssr, insert, createComponent, island } from "lumen/server";
const _s0 = ["<b>", "</b>"];
const _s1 = ["<i></i>"];
const _s2 = ["<p data-l-p1>footer</p>"];
const _s3 = ["<svg data-l-p1></svg>"];
const _s4 = [
	"<main data-l-p1>",
	"",
	"",
	"",
	"",
	"",
	"",
	"</main>"
];
export function Local(props) {
	return ssr(_s0, insert(props.n));
}
function Hidden() {
	return ssr(_s1);
}
export default function Page(props) {
	return ssr(_s4, insert(island("/src/components/Team.stsx#TeamPanel", TeamPanel, { get ids() {
		return props.ids;
	} }, "visible", void 0, { children: () => ssr(_s2) })), insert(island("/src/components/Team.stsx#TeamPanel", TeamPanel, { ids: [] }, "visible", "200px")), insert(island("/charts/Chart.tsx#default", Chart, {
		title: "x",
		class: "wide",
		$$scope: "data-l-p1"
	}, "media", props.query, { icon: () => ssr(_s3) })), insert(island("/src/ui.stsx#Tabs", ui.Tabs, {}, "idle")), insert(island("/src/islands.stsx#Local", Local, { n: 1 }, "load")), insert(createComponent(Hidden, {})), insert(createComponent(TeamPanel, { ids: [] })));
}

// --- diagnostics ---
// LUM4001 error 24:8 the island component `Hidden` is not exported, so the browser cannot import it
// LUM1002 error 25:18 unknown island directive `client:soon`
