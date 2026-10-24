import { ssr, SSRHtml, insert, insertText, spreadAttrs, createComponent, restProps } from "lumiose/server";
const _s0 = ["<h2>", "</h2>"];
const _c0 = (h0) => typeof h0 === "string" ? new SSRHtml("<h2>" + h0 + "</h2>") : ssr(_s0, h0);
const _s1 = [
	"<div",
	">",
	"</div>"
];
const _c1 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<div" + h0 + ">" + h1 + "</div>") : ssr(_s1, h0, h1);
const _s2 = [
	"<section><div",
	">",
	"</div>",
	"</section>"
];
const _c2 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<section><div" + h0 + ">" + h1 + "</div>" + h2 + "</section>") : ssr(_s2, h0, h1, h2);
const _s3 = [
	"<section><div",
	">own</div><p",
	">text</p><input",
	">",
	"</section>"
];
const _c3 = (h0, h1, h2, h3) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" ? new SSRHtml("<section><div" + h0 + ">own</div><p" + h1 + ">text</p><input" + h2 + ">" + h3 + "</section>") : ssr(_s3, h0, h1, h2, h3);
// The reactivity diagnostics see spreads (TASK-466): a stale derived value that reaches JSX only
// through a spread reports LUM2001, on elements and components, and the `children` an element's
// props spread inserts (TASK-347) counts for LUM2005. A rest without `children`, written content
// and a later `children` attribute insert none.
function Card(props) {
	return _c0(insertText(props.title));
}
export function Stale(props) {
	const attrs = {
		title: props.label,
		style: `color: ${props.color}`
	};
	const extra = { title: props.label };
	return _c1(spreadAttrs(attrs), insert(createComponent(Card, extra)));
}
export function Live(props) {
	const attrs = () => ({ title: props.label });
	return _c1(spreadAttrs(attrs()), "children" in (attrs() || {}) ? insert(attrs().children) : "");
}
export function Twice(props) {
	return _c2(spreadAttrs(props), "children" in props ? insert(props.children) : "", insertText(props.children));
}
export function Once(props) {
	const rest = restProps(props, ["children"]);
	return _c2(spreadAttrs(rest), "children" in rest ? insert(rest.children) : "", insertText(props.children));
}
export function Kept(props) {
	return _c3(spreadAttrs(props), spreadAttrs(props), spreadAttrs(props), insertText(props.children));
}

// --- diagnostics ---
// LUM2001 warning 10:9 `attrs` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 11:9 `extra` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2005 warning 28:7 `children` is inserted more than once; children are created lazily and can only be placed once
