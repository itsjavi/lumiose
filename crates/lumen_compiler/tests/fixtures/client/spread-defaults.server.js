import { ssr, spreadAttrs, restProps, mergeProps } from "lumen/server";
const _s0 = ["<svg", "><path d=\"M1 1h22\"></path></svg>"];
const _s1 = ["<input", ">"];
const _s2 = ["<div", "></div>"];
// Constant attributes before a spread of the props object or its `...rest` stay in the template
// (TASK-97): those keys are fixed, so the spread only sets what the caller passed. `class`,
// `style`, properties, events and attributes after the spread keep going through the spread, and
// so does everything when a spread may change its keys (any other object).
export function Icon(props) {
	const rest = restProps(props, ["title"]);
	return ssr(_s0, spreadAttrs(mergeProps({
		viewBox: "0 0 24 24",
		fill: "none",
		focusable: true,
		"aria-label": props.title
	}, rest)));
}
export function Field(props) {
	return ssr(_s1, spreadAttrs(mergeProps({
		type: "text",
		class: "field",
		style: "margin: 0",
		value: "x"
	}, props, { "data-after": "1" })));
}
export function Dynamic(props) {
	const attrs = props.attrs;
	return ssr(_s2, spreadAttrs(mergeProps({ role: "note" }, attrs())));
}
