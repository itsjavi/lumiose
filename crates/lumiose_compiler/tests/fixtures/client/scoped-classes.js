import { template, bind, setClass, toggleClass, insert, insertText, list, createComponent, spread, applyScope } from "lumiose/dom";
import "/src/scoped-classes.stsx?lumiose&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(`<span class=lum-x0zlxyw0> `);
const _t1 = /* @__PURE__ */ template(`<tr class="lum-x0zlxyw0 lum-plznucjw"><td class="lum-x0zlxyw0 lum-plznucjw"> `);
const _t2 = /* @__PURE__ */ template(`<article class="card lum-x0zlxyw0 lum-plznucjw"><h2 class="lum-x0zlxyw0 lum-plznucjw"> </h2><p class="lead lum-x0zlxyw0 lum-plznucjw">lead</p><p class="a b lum-x0zlxyw0 lum-plznucjw">static array</p><p class="lum-x0zlxyw0 lum-plznucjw">computed</p><p class="lum-x0zlxyw0 lum-plznucjw">spread</p><table class="lum-x0zlxyw0 lum-plznucjw"><tbody class="lum-x0zlxyw0 lum-plznucjw">`);
const _a0 = (el, v) => toggleClass(el, "on", v);
function Inner(props) {
	const _el = _t0(), _text = _el.firstChild;
	bind(_el, () => props.class, setClass);
	applyScope(_el, props.$$scope);
	insertText(_text, () => props.label);
	return _el;
}
export function Card(props) {
	const _el3 = _t2(), _h2 = _el3.firstChild, _text3 = _h2.firstChild, _p = _h2.nextSibling, _p2 = _p.nextSibling.nextSibling, _p3 = _p2.nextSibling, _table = _p3.nextSibling, _tbody = _table.firstChild;
	insertText(_text3, () => props.label);
	bind(_p, () => props.on, _a0);
	bind(_p2, () => props.on ? "x" : "y", setClass);
	spread(_p3, () => props);
	insert(_el3, createComponent(Inner, {
		class: "cta",
		label: "passthrough",
		rows: [],
		on: true,
		$$scope: ".lum-x0zlxyw0 .lum-plznucjw"
	}), _table);
	list(_tbody, null, () => props.rows, (row) => {
		const _el2 = _t1(), _text2 = _el2.firstChild.firstChild;
		insertText(_text2, row);
		return _el2;
	});
	return _el3;
}
