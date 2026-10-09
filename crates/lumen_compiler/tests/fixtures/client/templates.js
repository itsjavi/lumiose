import { template, insertText } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<div id=main class="a b" data-x="say &quot;hi&quot;" title="<tag> &amp; co" hidden tabindex=0 draggable=true><img src=/logo.png alt=""><br><p>Multi-line text   with    spaces</p><span>  literal  42</span>a bc<textarea>keep</textarea><label for=x aria-hidden=false spellcheck=true>Label</label><em>Don't © \`tick\` \${x} \\back`);
const _t1 = /* @__PURE__ */ template(`<div>`);
const _t2 = /* @__PURE__ */ template(`<table><caption>Implicit tbody</caption><tbody><tr><td> </td></tr><tr><td>static`);
const _t3 = /* @__PURE__ */ template(`<pre>\n\nkeeps the leading newline`);
const _t4 = /* @__PURE__ */ template(`<ul><li><a href=/a>A</a></li><li><a href=/b>B`);
// Templates: static attributes and their quoting, entities, void elements, trailing closing tags,
// raw-text elements and JSX whitespace rules.
export function Static() {
	return _t0();
}
export const Empty = () => _t1();
export function Table(props) {
	const _el = _t2(), _text = _el.firstChild.nextSibling.firstChild.firstChild.firstChild;
	insertText(_text, () => props.cell);
	return _el;
}
export const Pre = () => _t3();
export function Nested() {
	return _t4();
}
