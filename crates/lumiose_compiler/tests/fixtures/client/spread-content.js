import { template, bind, setProp, restProps, spread } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<div>`);
const _t1 = /* @__PURE__ */ template(`<section><p></p><p></p><article>`);
const _a0 = (el, v) => setProp(el, "innerHTML", v);
const _a1 = (el, v) => setProp(el, "textContent", v);
// A written `innerHTML` or `textContent` next to a spread applies as written, after the spread,
// on both targets (TASK-478): a spread never writes content (TASK-470), so it cannot go through
// it. It replaces the spread's `children` (TASK-347), as it replaces written children.
export function Html(props) {
	const rest = restProps(props, ["html"]);
	const _el = _t0();
	spread(_el, () => rest);
	bind(_el, () => props.html, _a0);
	return _el;
}
export function Text(props) {
	const _el2 = _t1(), _p = _el2.firstChild, _p2 = _p.nextSibling, _article = _p2.nextSibling;
	spread(_p, () => props.attrs);
	bind(_p, () => props.text, _a1);
	spread(_p2, () => props.attrs);
	_p2.textContent = "static";
	spread(_article, () => props.attrs);
	_article.innerHTML = "<b>static</b>";
	return _el2;
}
