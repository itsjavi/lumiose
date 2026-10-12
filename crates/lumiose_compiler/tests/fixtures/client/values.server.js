// Parentless branch and list values (TASK-50): reactive conditionals and .map() in component
// children, fragments, branch arms and returned rows compile to branchValue/listValue (the server's
// branch/list); other props and plain functions keep their values.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";
import { ssr, SSRHtml, insert, insertText, list, branchArm, createComponent } from "lumiose/server";
const _s0 = ["<p>Open</p>"];
const _s1 = ["<p>Closed</p>"];
const _s2 = ["<span>Visible</span>"];
const _s3 = ["<li>", "</li>"];
const _c3 = (h0) => typeof h0 === "string" ? new SSRHtml("<li>" + h0 + "</li>") : ssr(_s3, h0);
const _s4 = ["<h2>Title</h2>"];
const _s5 = [
	"<li>",
	": ",
	"</li>"
];
const _c5 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<li>" + h0 + ": " + h1 + "</li>") : ssr(_s5, h0, h1);
const _s6 = ["<b>T</b>"];
const _s7 = ["<i>", "</i>"];
const _c7 = (h0) => typeof h0 === "string" ? new SSRHtml("<i>" + h0 + "</i>") : ssr(_s7, h0);
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
const _c9 = (h0, h1, h2, h3, h4, h5) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && typeof h4 === "string" && h5 instanceof SSRHtml ? new SSRHtml("<div>" + h0 + h1 + h2 + h3 + h4 + h5.t + "</div>") : ssr(_s9, h0, h1, h2, h3, h4, h5);
const _s10 = ["<span>end</span>"];
const _s11 = ["<b>", "</b>"];
const _c11 = (h0) => typeof h0 === "string" ? new SSRHtml("<b>" + h0 + "</b>") : ssr(_s11, h0);
const _s12 = ["<ul>", "</ul>"];
const _c12 = (h0) => h0 instanceof SSRHtml ? new SSRHtml("<ul>" + h0.t + "</ul>") : ssr(_s12, h0);
export function Values(props) {
	const open = signal(false);
	const items = signal([]);
	return _c9(insert(createComponent(Card, ((_d, _v) => ({ get children() {
		return _d ? _v : (_v = open() ? branchArm(true, ssr(_s0)) : branchArm(false, ssr(_s1)), _d = true, _v);
	} }))())), insert(createComponent(Card, ((_d2, _v2) => ({ get children() {
		return _d2 ? _v2 : (_v2 = open() ? branchArm(true, ssr(_s2)) : branchArm(false), _d2 = true, _v2);
	} }))())), insert(createComponent(Card, ((_d3, _v3) => ({ get children() {
		return _d3 ? _v3 : (_v3 = list(items(), (item) => _c3(insertText(item.name))), _d3 = true, _v3);
	} }))())), insert(createComponent(Card, ((_d4, _v4) => ({ get children() {
		return _d4 ? _v4 : (_v4 = [ssr(_s4), list(items(), (item, i) => _c5(insert(i()), insert(item.name)))], _d4 = true, _v4);
	} }))())), insert(createComponent(Card, ((_d5, _v5) => ({ get title() {
		return _d5 ? _v5 : (_v5 = open() ? ssr(_s6) : null, _d5 = true, _v5);
	} }))())), open() ? branchArm(true, list(items(), (item) => _c7(insertText(item.name)))) : branchArm(false, ssr(_s8)));
}
export function Frag() {
	const open = signal(false);
	const items = signal([]);
	return [
		open() ? branchArm(true, ssr(_s0)) : branchArm(false, ssr(_s1)),
		list(items(), (name) => _c3(insertText(name))),
		ssr(_s10)
	];
}
export function Rows() {
	const items = signal([]);
	return _c12(list(items(), (name) => name.length > 3 ? branchArm(true, _c11(insertText(name))) : branchArm(false, _c7(insertText(name)))));
}
export function Plain(props) {
	return props.list.map((name) => _c3(insertText(name)));
}
