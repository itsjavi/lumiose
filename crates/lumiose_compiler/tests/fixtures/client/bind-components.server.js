// `bind:x` on components and custom elements (decision-62, TASK-360).
import { signal } from "lumiose";
import { Dialog, Combobox, useSelection } from "./ui.ts";
import { ssr, SSRHtml, text, insert, attr, spreadAttrs, createComponent, restProps, mergeProps } from "lumiose/server";
const _s0 = ["<p>", "</p>"];
const _c0 = (h0) => typeof h0 === "string" ? new SSRHtml("<p>" + h0 + "</p>") : ssr(_s0, h0);
const _s1 = [
	"<section>",
	"",
	"",
	"",
	"<lu-menu class=menu",
	"></lu-menu><lu-combobox name=fruit",
	"></lu-combobox><lu-combobox",
	"",
	"></lu-combobox><input",
	"",
	"></section>"
];
const _c1 = (h0, h1, h2, h3, h4, h5, h6, h7, h8, h9) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && typeof h4 === "string" && typeof h5 === "string" && typeof h6 === "string" && typeof h7 === "string" && typeof h8 === "string" && typeof h9 === "string" ? new SSRHtml("<section>" + h0 + h1 + h2 + h3 + "<lu-menu class=menu" + h4 + "></lu-menu><lu-combobox name=fruit" + h5 + "></lu-combobox><lu-combobox" + h6 + h7 + "></lu-combobox><input" + h8 + h9 + "></section>") : ssr(_s1, h0, h1, h2, h3, h4, h5, h6, h7, h8, h9);
export function Settings(props) {
	const open = signal(false);
	const fruit = signal(null);
	const state = { checked: signal(true) };
	return _c1(insert(createComponent(Dialog.Root, ((_d, _v, _d2, _v3) => ({
		get open() {
			return _d ? _v : (_v = open(), _d = true, _v);
		},
		onOpenChange: (_v2) => open.set(_v2),
		get children() {
			return _d2 ? _v3 : (_v3 = _c0(text(open() ? "open" : "closed")), _d2 = true, _v3);
		}
	}))())), insert(createComponent(Dialog.Root, ((_d3, _v4) => ({
		get open() {
			return _d3 ? _v4 : (_v4 = open(), _d3 = true, _v4);
		},
		onOpenChange: (_v5, ..._a) => (open.set(_v5), props.onOpenChange?.(_v5, ..._a)),
		role: "alertdialog"
	}))())), insert(createComponent(Dialog.Root, ((_d4, _v6) => ({
		get open() {
			return _d4 ? _v6 : (_v6 = state.checked(), _d4 = true, _v6);
		},
		onOpenChange: (_v7, ..._a2) => (state.checked.set(_v7), ((next) => console.log(next))?.(_v7, ..._a2))
	}))())), insert(createComponent(Combobox.Root, ((_s, _d5, _v8) => ({
		get value() {
			return _d5 ? _v8 : (_v8 = _s(), _d5 = true, _v8);
		},
		onValueChange: (_v9) => _s.set(_v9),
		label: "Fruit"
	}))(useSelection()))), attr("open", open(), true), attr("value", fruit(), true), spreadAttrs(props, true), attr("value", fruit(), true), spreadAttrs(props), attr("value", fruit()));
}
export function Forwarded(props) {
	const rest = restProps(props, ["open"]);
	return createComponent(Dialog.Root, mergeProps(((_d6, _v10) => ({
		get open() {
			return _d6 ? _v10 : (_v10 = props.open(), _d6 = true, _v10);
		},
		onOpenChange: (_v11) => props.open.set(_v11)
	}))(), rest));
}
