// Parentless branch and list values (TASK-50): reactive conditionals and .map() in component
// children, fragments, branch arms and returned rows compile to branchValue/listValue (the server's
// branch/list); other props and plain functions keep their values.
import { signal } from "lumen";
import { Card } from "./Card.stsx";
import { ssr, insert, insertText, list, branchArm, createComponent } from "lumen/server";
const _s0 = ["<p>Open</p>"];
const _s1 = ["<p>Closed</p>"];
const _s2 = ["<span>Visible</span>"];
const _s3 = ["<li>", "</li>"];
const _s4 = ["<h2>Title</h2>"];
const _s5 = [
	"<li>",
	": ",
	"</li>"
];
const _s6 = ["<b>T</b>"];
const _s7 = ["<i>", "</i>"];
const _s8 = ["<p>None</p>"];
const _s9 = [
	"<div>",
	"",
	"",
	"",
	"",
	"",
	"</div>"
];
const _s10 = ["<span>end</span>"];
const _s11 = ["<b>", "</b>"];
const _s12 = ["<ul>", "</ul>"];
export function Values(props) {
	const open = signal(false);
	const items = signal([]);
	return ssr(_s9, insert(createComponent(Card, ((_d, _v) => ({ get children() {
		return _d ? _v : (_v = open() ? branchArm(true, ssr(_s0)) : branchArm(false, ssr(_s1)), _d = true, _v);
	} }))())), insert(createComponent(Card, ((_d2, _v2) => ({ get children() {
		return _d2 ? _v2 : (_v2 = open() ? branchArm(true, ssr(_s2)) : branchArm(false), _d2 = true, _v2);
	} }))())), insert(createComponent(Card, ((_d3, _v3) => ({ get children() {
		return _d3 ? _v3 : (_v3 = list(items(), (item) => ssr(_s3, insertText(item.name))), _d3 = true, _v3);
	} }))())), insert(createComponent(Card, ((_d4, _v4) => ({ get children() {
		return _d4 ? _v4 : (_v4 = [ssr(_s4), list(items(), (item, i) => ssr(_s5, insert(i()), insert(item.name)))], _d4 = true, _v4);
	} }))())), insert(createComponent(Card, ((_d5, _v5) => ({ get title() {
		return _d5 ? _v5 : (_v5 = open() ? ssr(_s6) : null, _d5 = true, _v5);
	} }))())), open() ? branchArm(true, list(items(), (item) => ssr(_s7, insertText(item.name)))) : branchArm(false, ssr(_s8)));
}
export function Frag() {
	const open = signal(false);
	const items = signal([]);
	return [
		open() ? branchArm(true, ssr(_s0)) : branchArm(false, ssr(_s1)),
		list(items(), (name) => ssr(_s3, insertText(name))),
		ssr(_s10)
	];
}
export function Rows() {
	const items = signal([]);
	return ssr(_s12, list(items(), (name) => name.length > 3 ? branchArm(true, ssr(_s11, insertText(name))) : branchArm(false, ssr(_s7, insertText(name)))));
}
export function Plain(props) {
	return props.list.map((name) => ssr(_s3, insertText(name)));
}
