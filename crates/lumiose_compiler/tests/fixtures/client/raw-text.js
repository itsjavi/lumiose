import { template, bind, setText, setProp, insertText } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<div><script type=application/ld+json> <\/script><script type=application/ld+json><\/script><script type=importmap>{"imports": {"a": "./a.js?x=1&y=\\u003c2"}}<\/script>`);
const _t1 = /* @__PURE__ */ template(`<div><script>if (1 < 2 && ok) document.title = '<\\/script>';<\/script><script> <\/script><style> </style><style>a > b::after { content: '<\\/style>' }</style><script><\/script><svg><style>a &lt; b</style>`);
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
