import { template, bind, setClass, insert, createComponent, applyScope } from "lumen/dom";
import "/src/doc2-component-call.stsx?lumen&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(`<article data-l-c2><h2 data-l-c2>`);
const _t1 = /* @__PURE__ */ template(`<main data-l-p1>`);
export function Card(props) {
	const _el = _t0(), _h2 = _el.firstChild;
	bind(_el, () => props.class, setClass);
	applyScope(_el, props.$$scope);
	insert(_h2, () => props.title);
	insert(_el, () => props.children);
	return _el;
}
export function Page(props) {
	const _el2 = _t1();
	insert(_el2, createComponent(Card, {
		get title() {
			return props.post().title;
		},
		class: "featured",
		$$scope: "data-l-p1",
		get children() {
			return props.post().body;
		}
	}));
	return _el2;
}
