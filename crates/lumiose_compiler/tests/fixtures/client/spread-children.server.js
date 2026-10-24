import { ssr, SSRHtml, insert, insertText, spreadAttrs, restProps, mergeProps } from "lumiose/server";
const _s0 = [
	"<button",
	">",
	"</button>"
];
const _c0 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<button" + h0 + ">" + h1 + "</button>") : ssr(_s0, h0, h1);
const _s1 = [
	"<div",
	">",
	"</div>"
];
const _c1 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<div" + h0 + ">" + h1 + "</div>") : ssr(_s1, h0, h1);
const _s2 = [
	"<span",
	">",
	"</span>"
];
const _c2 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<span" + h0 + ">" + h1 + "</span>") : ssr(_s2, h0, h1);
const _s3 = [
	"<section><p",
	">",
	"</p><p",
	">",
	"</p><p",
	">",
	"</p><p>text</p></section>"
];
const _c3 = (h0, h1, h2, h3, h4, h5) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && typeof h4 === "string" && typeof h5 === "string" ? new SSRHtml("<section><p" + h0 + ">" + h1 + "</p><p" + h2 + ">" + h3 + "</p><p" + h4 + ">" + h5 + "</p><p>text</p></section>") : ssr(_s3, h0, h1, h2, h3, h4, h5);
const _s4 = [
	"<div><p",
	">",
	"</p><p",
	">",
	"</p></div>"
];
const _c4 = (h0, h1, h2, h3) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" ? new SSRHtml("<div><p" + h0 + ">" + h1 + "</p><p" + h2 + ">" + h3 + "</p></div>") : ssr(_s4, h0, h1, h2, h3);
const _s5 = [
	"<div><p",
	">own</p><p>own</p><input",
	"><textarea",
	"></textarea></div>"
];
const _c5 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<div><p" + h0 + ">own</p><p>own</p><input" + h1 + "><textarea" + h2 + "></textarea></div>") : ssr(_s5, h0, h1, h2);
// An element without content of its own renders the `children` of its spreads and `children`
// attribute, as in React and Solid (TASK-347): the last source that has `children` wins, written
// content wins over all of them. Spreads alone insert `children` only when their props object has
// the key, so content that scripts or the browser own stays when they have none. Void, raw-text
// and form-value elements never render them.
export function Button(props) {
	return _c0(spreadAttrs(props), "children" in props ? insert(props.children) : "");
}
export function Empty(props) {
	return _c1(spreadAttrs(props), "children" in props ? insert(props.children) : "");
}
export function Rest(props) {
	const rest = restProps(props, ["title"]);
	return _c2(spreadAttrs(mergeProps({ title: props.title }, rest)), "children" in rest ? insert(rest.children) : "");
}
export function Merged(props) {
	return _c3(spreadAttrs(mergeProps(props.a, props.b)), "children" in mergeProps(props.a, props.b) ? insert(mergeProps(props.a, props.b).children) : "", spreadAttrs(props.a), insertText(props.label), spreadAttrs(props.b), insertText(mergeProps({ get children() {
		return props.label;
	} }, props.b).children));
}
// A spread may be nullish or `false`, which `in` throws on, so it is checked as `object || {}`
// (TASK-569). The component's props, its `...rest` and merged spreads are always objects.
export function Optional(props) {
	return _c4(spreadAttrs(props.extra), "children" in (props.extra || {}) ? insert(props.extra.children) : "", spreadAttrs(props.open && props.attrs), "children" in (props.open && props.attrs || {}) ? insert((props.open && props.attrs).children) : "");
}
export function Written(props) {
	return _c5(spreadAttrs(props), spreadAttrs(props), spreadAttrs(props));
}
