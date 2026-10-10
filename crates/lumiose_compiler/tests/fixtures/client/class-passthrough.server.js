import { ssr, insertText, classAttr, spreadAttrs, restProps } from "lumiose/server";
const _s0 = [
	"<button",
	"",
	">",
	"</button>"
];
const _s1 = [
	"<div",
	"",
	"><button",
	"",
	">",
	"</button><span",
	">",
	"</span></div>"
];
const _s2 = [
	"<article",
	"",
	">",
	"</article>"
];
const _s3 = [
	"<p",
	"",
	">",
	"</p>"
];
const _s4 = [
	"<em",
	"",
	">",
	"</em>"
];
const _s5 = [
	"<i",
	">",
	"</i>"
];
function variantClass(props) {
	return [
		"btn",
		{ primary: props.variant === "primary" },
		props.class
	];
}
// `props` passed whole to a helper.
export function Helper(props) {
	return ssr(_s0, classAttr(variantClass(props)), spreadAttrs({ $$scope: props.$$scope }), insertText(props.label));
}
// A local closure and an alias read `props.class`.
export function Closure(props) {
	const classes = () => ["btn", props.class];
	const extra = props.class;
	function wrap() {
		return ["wrap", extra];
	}
	return ssr(_s1, classAttr(wrap()), spreadAttrs({ $$scope: props.$$scope }), classAttr(classes()), spreadAttrs({ $$scope: props.$$scope }), insertText(props.label), classAttr(props.variant), insertText(props.label));
}
// Destructured: the `class` prop, and the rest of the props.
export function Destructured(props) {
	const list = () => ["card", props.class];
	return ssr(_s2, classAttr(list().join(" ")), spreadAttrs({ $$scope: props.$$scope }), insertText(props.label));
}
export function Rest(props) {
	const rest = restProps(props, ["label"]);
	return ssr(_s3, classAttr(["note", rest.class]), spreadAttrs({ $$scope: props.$$scope }), insertText(props.label));
}
// A computed key on props may read `class`.
export function Computed(props) {
	return ssr(_s4, classAttr(props[props.key]), spreadAttrs({ $$scope: props.$$scope }), insertText(props.label));
}
// No flow: only other props reach the class.
export function Other(props) {
	const tone = () => props.variant ?? "ghost";
	return ssr(_s5, classAttr(`tone-${tone()}`), insertText(props.label));
}
