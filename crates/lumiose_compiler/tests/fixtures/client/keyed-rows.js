// Keyed rows (TASK-554, decision-83): the client's row callback gets the row, whose `v` reads its
// current item, so reads of the item (`item.v`) and of a destructured item's bindings
// (`_item.v.name`) are live, like props. Data-slot handlers get the row; a component prop becomes
// a getter. Setup reads that the JSX uses are LUM2001, an early return on the item is LUM2003 (a
// warning), and copies of the key itself are neither. A pattern with a rest element is read once
// (LUM2001). A render that reads no item takes no parameter. Unkeyed lists are unchanged.
import { signal } from "lumiose";
import { Card } from "./Card.tsx";
import { template, bind, toggleClass, insert, insertText, list, selector, createComponent, delegateEvents } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<b> `);
const _t1 = /* @__PURE__ */ template(`<li><!><!><!>`);
const _t2 = /* @__PURE__ */ template(`<li><!><!>`);
const _t3 = /* @__PURE__ */ template(`<s> `);
const _t4 = /* @__PURE__ */ template(`<i><!><!><!>`);
const _t5 = /* @__PURE__ */ template(`<a>static`);
const _t6 = /* @__PURE__ */ template(`<a> `);
const _t7 = /* @__PURE__ */ template(`<div><ul></ul><ol></ol><p></p><section></section><nav></nav><aside>`);
const _a0 = (el, v) => toggleClass(el, "on", v);
const _a1 = (el, v) => toggleClass(el, "done", v);
const _onClick = (item) => select(item.v.id);
const format = (s) => s.toUpperCase();
const selected = signal(0);
const select = (id) => selected.set(id);
export function KeyedRows() {
	const items = signal([]);
	const _el7 = _t7(), _ul = _el7.firstChild, _ol = _ul.nextSibling, _p = _ol.nextSibling, _section = _p.nextSibling, _nav = _section.nextSibling, _aside = _nav.nextSibling;
	const _isSelected = selector(selected);
	list(_ul, null, items, (item) => {
		const _el2 = _t1(), _marker = _el2.firstChild, _marker2 = _marker.nextSibling, _marker3 = _marker2.nextSibling;
		bind(_el2, () => _isSelected(item.v.id), _a0);
		bind(_el2, () => item.v.done, _a1);
		_el2.$$click = _onClick;
		_el2.$$clickData = item;
		insert(_el2, () => item.v.name, _marker);
		insert(_el2, () => item.v.label(), _marker2);
		insert(_el2, createComponent(Card, { get item() {
			return item.v;
		} }), _marker3);
		list(_el2, null, () => item.v.tags, (tag) => {
			const _el = _t0(), _text = _el.firstChild;
			insertText(_text, () => tag.v);
			return _el;
		}, (tag) => tag);
		return _el2;
	}, (item) => item.id);
	list(_ol, null, items, (_item, i) => {
		const _el3 = _t2(), _marker4 = _el3.firstChild, _marker5 = _marker4.nextSibling;
		insert(_el3, () => _item.v.name, _marker4);
		insert(_el3, () => _item.v.tags[0] === void 0 ? "none" : _item.v.tags[0], _marker5);
		insert(_el3, () => i());
		return _el3;
	}, ({ id, name, tags: [first = "none"] }) => id);
	list(_p, null, items, (item) => {
		const id = item.v.id;
		const name = item.v.name;
		const upper = format(item.v.name);
		const local = signal(item.v.done);
		if (item.v.done) return (() => {
			const _el4 = _t3(), _text2 = _el4.firstChild;
			insertText(_text2, id);
			return _el4;
		})();
		const _el5 = _t4(), _marker6 = _el5.firstChild, _marker7 = _marker6.nextSibling, _marker8 = _marker7.nextSibling;
		insert(_el5, id, _marker6);
		insert(_el5, name, _marker7);
		insert(_el5, upper, _marker8);
		insert(_el5, local);
		return _el5;
	}, (item) => item.id);
	list(_section, null, items, (_item2) => {
		let { id, ...rest } = _item2.v;
		return createComponent(Card, rest);
	}, ({ id, ...rest }) => id);
	list(_nav, null, items, () => _t5(), (item) => item.id);
	list(_aside, null, items, (item) => {
		const _el6 = _t6(), _text3 = _el6.firstChild;
		insertText(_text3, () => item.name);
		return _el6;
	});
	return _el7;
}
delegateEvents(["click"]);

// --- diagnostics ---
// LUM2001 warning 47:17 `name` is read once from the row's item, so the JSX that uses it keeps the first value when the item changes in place
// LUM2001 warning 48:17 `upper` is read once from the row's item, so the JSX that uses it keeps the first value when the item changes in place
// LUM2003 warning 50:15 this early return depends on the row's item, but a keyed row renders once: it does not re-run when the item changes in place
// LUM2001 warning 62:23 the item of this keyed row is destructured with a rest element, so its bindings are read once and keep the first value when the item changes in place
