import { template, bind, setText, setProp, insertText } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<div><script type=application/ld+json> <\/script><script type=application/ld+json><\/script><script type=importmap>{"imports": {"a": "./a.js?x=1&y=\\u003c2"}}<\/script>`);
const _t1 = /* @__PURE__ */ template(`<div><script>if (1 < 2 && ok) document.title = '<\\/script>';<\/script><script> <\/script><style> </style><style>a > b::after { content: '<\\/style>' }</style><script><\/script><svg><style>a &lt; b</style>`);
const _t2 = /* @__PURE__ */ template(`<g><style> </style>`, 2);
const _t3 = /* @__PURE__ */ template(`<mi>x</mi><script> <\/script>`, 5);
const _t4 = /* @__PURE__ */ template(`<style> </style><style>a::after { content: '<\\69 mg src=x>' }</style>`, 1);
const _a0 = (el, v) => setProp(el, "textContent", v);
// `<script>` and `<style>` content is raw text, which HTML does not decode (TASK-472 L7): static
// text is written as it is, with `<\/script`, `</style` and `<!--` neutralized; in a JSON script
// every `<` is `\u003c`. On the server, dynamic text, `innerHTML` and `textContent` go through
// `rawText()`; the client writes DOM text. Mixed text and values are one text. In SVG, `<style>`
// text is escaped as usual.
export function JsonLd(props) {
	const _el = _t0(), _script = _el.firstChild, _text = _script.firstChild, _script2 = _script.nextSibling;
	insertText(_text, () => JSON.stringify(props.data));
	bind(_script2, () => JSON.stringify(props.data), _a0);
	return _el;
}
export function Inline(props) {
	const _el2 = _t1(), _script3 = _el2.firstChild.nextSibling, _text2 = _script3.firstChild, _style = _script3.nextSibling, _text3 = _style.firstChild, _script4 = _style.nextSibling.nextSibling;
	bind(_text2, () => [
		"var name = ",
		JSON.stringify(props.name),
		";"
	].join(""), setText);
	insertText(_text3, () => props.css);
	bind(_script4, () => props.name, _a0);
	return _el2;
}
// TASK-495: a `<style>` or `<script>` under a root such as `<g>` or `<mi>` is SVG or MathML, as on
// the client: its text is escaped (and the parser decodes it). A root `<style>` or `<script>` may
// still end up inside `<svg>`, where its text is parsed as markup: `rawText()` escapes the
// character after each `<` that could open a tag, as in the static text here.
export function Layer(props) {
	const _el3 = _t2(), _text4 = _el3.firstChild.firstChild;
	insertText(_text4, () => props.css);
	return _el3;
}
export function Formula(props) {
	const _nodes = _t3(), _script5 = _nodes[1], _text5 = _script5.firstChild;
	insertText(_text5, () => props.code);
	return _nodes;
}
export function Sheet(props) {
	const _nodes2 = _t4(), _style2 = _nodes2[0], _text6 = _style2.firstChild;
	insertText(_text6, () => props.css);
	return _nodes2;
}
