import { signal } from "lumiose";
import { ssr, SSRHtml, insert, attr, spreadAttrs, mergeProps } from "lumiose/server";
const _s0 = [
	"<li",
	">",
	"</li>"
];
const _c0 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<li" + h0 + ">" + h1 + "</li>") : ssr(_s0, h0, h1);
const _s1 = [
	"<input",
	"",
	">"
];
const _c1 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<input" + h0 + h1 + ">") : ssr(_s1, h0, h1);
// Directives next to a spread (TASK-568). `attach` and `bind:` are not props: they apply after the
// spread as they do without one, in either order, and never reach it (where `attach` became an
// attribute holding the function's source); the server drops `attach`. `key` is compile-time
// only. `ref`, handlers and `on:` listeners are props the spread applies, in order with the other
// attributes.
const observe = (el) => el.toggleAttribute("data-seen", true);
export function Row(props) {
	return _c0(spreadAttrs(mergeProps(props.itemProps?.(props.item), { "data-row": props.i })), "children" in (props.itemProps?.(props.item) || {}) ? insert((props.itemProps?.(props.item)).children) : "");
}
export function Before(props) {
	return _c0(spreadAttrs(mergeProps({ id: "before" }, props.attrs)), "children" in (props.attrs || {}) ? insert(props.attrs.children) : "");
}
export function Single(props) {
	return _c0(spreadAttrs(props.attrs), "children" in (props.attrs || {}) ? insert(props.attrs.children) : "");
}
export function Props(props) {
	const value = signal("");
	return _c1(spreadAttrs(mergeProps(props.attrs, {
		ref: (el) => observe(el),
		onClick: props.onPick,
		"on:custom-event": props.onPick
	})), attr("value", value()));
}
