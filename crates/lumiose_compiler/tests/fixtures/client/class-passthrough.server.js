import { ssr, SSRHtml, insertText, classAttr, spreadAttrs, restProps } from "lumiose/server";
const _s0 = [
	"<button",
	"",
	">",
	"</button>"
];
const _c0 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<button" + h0 + h1 + ">" + h2 + "</button>") : ssr(_s0, h0, h1, h2);
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
const _c1 = (h0, h1, h2, h3, h4, h5, h6) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && typeof h4 === "string" && typeof h5 === "string" && typeof h6 === "string" ? new SSRHtml("<div" + h0 + h1 + "><button" + h2 + h3 + ">" + h4 + "</button><span" + h5 + ">" + h6 + "</span></div>") : ssr(_s1, h0, h1, h2, h3, h4, h5, h6);
const _s2 = [
	"<article",
	"",
	">",
	"</article>"
];
const _c2 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<article" + h0 + h1 + ">" + h2 + "</article>") : ssr(_s2, h0, h1, h2);
const _s3 = [
	"<p",
	"",
	">",
	"</p>"
];
const _c3 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<p" + h0 + h1 + ">" + h2 + "</p>") : ssr(_s3, h0, h1, h2);
const _s4 = [
	"<em",
	"",
	">",
	"</em>"
];
const _c4 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<em" + h0 + h1 + ">" + h2 + "</em>") : ssr(_s4, h0, h1, h2);
const _s5 = [
	"<i",
	">",
	"</i>"
];
const _c5 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<i" + h0 + ">" + h1 + "</i>") : ssr(_s5, h0, h1);
function variantClass(props) {
	return [
		"btn",
		{ primary: props.variant === "primary" },
		props.class
	];
}
// `props` passed whole to a helper.
export function Helper(props) {
	return _c0(classAttr(variantClass(props)), spreadAttrs({ $$scope: props.$$scope }), insertText(props.label));
}
// A local closure and an alias read `props.class`.
export function Closure(props) {
	const classes = () => ["btn", props.class];
	const extra = props.class;
	function wrap() {
		return ["wrap", extra];
	}
	return _c1(classAttr(wrap()), spreadAttrs({ $$scope: props.$$scope }), classAttr(classes()), spreadAttrs({ $$scope: props.$$scope }), insertText(props.label), classAttr(props.variant), insertText(props.label));
}
// Destructured: the `class` prop, and the rest of the props.
export function Destructured(props) {
	const list = () => ["card", props.class];
	return _c2(classAttr(list().join(" ")), spreadAttrs({ $$scope: props.$$scope }), insertText(props.label));
}
export function Rest(props) {
	const rest = restProps(props, ["label"]);
	return _c3(classAttr(["note", rest.class]), spreadAttrs({ $$scope: props.$$scope }), insertText(props.label));
}
// A computed key on props may read `class`.
export function Computed(props) {
	return _c4(classAttr(props[props.key]), spreadAttrs({ $$scope: props.$$scope }), insertText(props.label));
}
// No flow: only other props reach the class.
export function Other(props) {
	const tone = () => props.variant ?? "ghost";
	return _c5(classAttr(`tone-${tone()}`), insertText(props.label));
}
