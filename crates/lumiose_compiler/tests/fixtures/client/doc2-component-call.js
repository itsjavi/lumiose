import { template, bind, setClass, insert, insertText, createComponent, applyScope } from "lumiose/dom";
import "/src/doc2-component-call.stsx?lumiose&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(`<article data-lum-ar7z1gx1><h2 data-lum-ar7z1gx1> </h2> `);
const _t1 = /* @__PURE__ */ template(`<main data-lum-qlayfokw>`);
export function Card(props) {
	const _el = _t0(), _h2 = _el.firstChild, _text = _h2.firstChild, _text2 = _h2.nextSibling;
	bind(_el, () => props.class, setClass);
	applyScope(_el, props.$$scope);
	insertText(_text, () => props.title);
	insertText(_text2, () => props.children);
	return _el;
}
export function Page(props) {
	const _el2 = _t1();
	insert(_el2, createComponent(Card, {
		get title() {
			return props.post().title;
		},
		class: "featured",
		$$scope: "data-lum-qlayfokw",
		get children() {
			return props.post().body;
		}
	}));
	return _el2;
}
