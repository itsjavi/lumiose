// Island call sites (contract doc-2 §5.5): `island(ref, X, props, strategy, value?, slots?)` on the
// server, with JSX-valued props and children as slots; a plain component call on the client.
import { TeamPanel } from "./components/Team.stsx";
import Chart from "../charts/Chart.tsx";
import * as ui from "./ui.stsx";
import { template, insert, insertText, createComponent } from "lumiose/dom";
import "/src/islands.stsx?lumiose&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(`<b> `);
const _t1 = /* @__PURE__ */ template(`<i>`);
const _t2 = /* @__PURE__ */ template(`<p data-lum-k3v7p5ya>footer`);
const _t3 = /* @__PURE__ */ template(`<svg data-lum-k3v7p5ya>`);
const _t4 = /* @__PURE__ */ template(`<main data-lum-k3v7p5ya><!><!><!><!><!><!>`);
export function Local(props) {
	const _el = _t0(), _text = _el.firstChild;
	insertText(_text, () => props.n);
	return _el;
}
function Hidden() {
	return _t1();
}
export default function Page(props) {
	const _el2 = _t4(), _marker = _el2.firstChild, _marker2 = _marker.nextSibling, _marker3 = _marker2.nextSibling, _marker4 = _marker3.nextSibling, _marker5 = _marker4.nextSibling, _marker6 = _marker5.nextSibling;
	insert(_el2, createComponent(TeamPanel, {
		get ids() {
			return props.ids;
		},
		get children() {
			return _t2();
		}
	}), _marker);
	insert(_el2, createComponent(TeamPanel, { ids: [] }), _marker2);
	insert(_el2, createComponent(Chart, {
		title: "x",
		get icon() {
			return _t3();
		},
		class: "wide",
		$$scope: "data-lum-k3v7p5ya"
	}), _marker3);
	insert(_el2, createComponent(ui.Tabs, {}), _marker4);
	insert(_el2, createComponent(Local, { n: 1 }), _marker5);
	insert(_el2, createComponent(Hidden, {}), _marker6);
	insert(_el2, createComponent(TeamPanel, { ids: [] }));
	return _el2;
}

// --- diagnostics ---
// LUM4001 error 23:8 the island component `Hidden` is not exported, so the browser cannot import it
// LUM1002 error 24:18 unknown island directive `client:soon`
