// Parentless branch and list values (TASK-50): reactive conditionals and .map() in component
// children, fragments, branch arms and returned rows compile to branchValue/listValue (the server's
// branch/list); other props and plain functions keep their values.
import { signal } from "lumen";
import { Card } from "./Card.stsx";
import { ssr, insert, list, branchArm, createComponent } from "lumen/server";
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
	return ssr(_s9, insert(createComponent(Card, { get children() {
		return open() ? branchArm(true, ssr(_s0)) : branchArm(false, ssr(_s1));
	} })), insert(createComponent(Card, { get children() {
		return open() ? branchArm(true, ssr(_s2)) : branchArm(false);
	} })), insert(createComponent(Card, { get children() {
		return list(items(), (item) => ssr(_s3, insert(item.name)));
	} })), insert(createComponent(Card, { get children() {
		return [ssr(_s4), list(items(), (item, i) => ssr(_s5, insert(i()), insert(item.name)))];
	} })), insert(createComponent(Card, { get title() {
		return open() ? ssr(_s6) : null;
	} })), open() ? branchArm(true, list(items(), (item) => ssr(_s7, insert(item.name)))) : branchArm(false, ssr(_s8)));
}
export function Frag() {
	const open = signal(false);
	const items = signal([]);
	return [
		open() ? branchArm(true, ssr(_s0)) : branchArm(false, ssr(_s1)),
		list(items(), (name) => ssr(_s3, insert(name))),
		ssr(_s10)
	];
}
export function Rows() {
	const items = signal([]);
	return ssr(_s12, list(items(), (name) => name.length > 3 ? branchArm(true, ssr(_s11, insert(name))) : branchArm(false, ssr(_s7, insert(name)))));
}
export function Plain(props) {
	return props.list.map((name) => ssr(_s3, insert(name)));
}
