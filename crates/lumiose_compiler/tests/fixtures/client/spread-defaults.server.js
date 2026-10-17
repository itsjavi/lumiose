import { ssr, SSRHtml, insert, spreadAttrs, restProps, mergeProps } from "lumiose/server";
const _s0 = ["<svg", "><path d=\"M1 1h22\"></path></svg>"];
const _c0 = (h0) => typeof h0 === "string" ? new SSRHtml("<svg" + h0 + "><path d=\"M1 1h22\"></path></svg>") : ssr(_s0, h0);
const _s1 = ["<input", ">"];
const _c1 = (h0) => typeof h0 === "string" ? new SSRHtml("<input" + h0 + ">") : ssr(_s1, h0);
const _s2 = [
	"<div",
	">",
	"</div>"
];
const _c2 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<div" + h0 + ">" + h1 + "</div>") : ssr(_s2, h0, h1);
// Constant attributes before a spread of the props object or its `...rest` stay in the template
// (TASK-97): those keys are fixed, so the spread only sets what the caller passed. `class`,
// `style`, properties, events and attributes after the spread keep going through the spread, and
// so does everything when a spread may change its keys (any other object).
export function Icon(props) {
	const rest = restProps(props, ["title"]);
	return _c0(spreadAttrs(mergeProps({
		viewBox: "0 0 24 24",
		fill: "none",
		focusable: true,
		"aria-label": props.title
	}, rest)));
}
export function Field(props) {
	return _c1(spreadAttrs(mergeProps({
		type: "text",
		class: "field",
		style: "margin: 0",
		value: "x"
	}, props, { "data-after": "1" })));
}
export function Dynamic(props) {
	const attrs = props.attrs;
	return _c2(spreadAttrs(mergeProps({ role: "note" }, attrs())), "children" in attrs() ? insert(attrs().children) : "");
}

// --- diagnostics ---
// LUM2001 warning 18:9 `attrs` is computed once from a reactive value, so the JSX that uses it never updates
