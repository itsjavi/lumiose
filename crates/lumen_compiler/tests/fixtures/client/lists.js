// .map() → keyed list: key from the root's key prop, index accessor only when used, selector
// hoisting for both operand orders and !==, block-bodied callbacks, nested lists.
import { signal } from "lumen";
import { Row } from "./Row.stsx";
import { template, bind, setText, setAttr, setClass, toggleClass, insert, insertText, list, branchValue, selector, createComponent } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<li>. `);
const _t1 = /* @__PURE__ */ template(`<li> `);
const _t2 = /* @__PURE__ */ template(`<td> `);
const _t3 = /* @__PURE__ */ template(`<tr>`);
const _t4 = /* @__PURE__ */ template(`<b> `);
const _t5 = /* @__PURE__ */ template(`<i>-`);
const _t6 = /* @__PURE__ */ template(`<dt> </dt><dd> `, 1);
const _t7 = /* @__PURE__ */ template(`<div><ul></ul><ol></ol><ol></ol><table><tbody></tbody></table><p> </p><!><!>`);
const _a0 = (el, v) => toggleClass(el, "active", v);
const _a1 = (el, v) => toggleClass(el, "first", v);
const _a2 = (el, v) => setAttr(el, "data-selected", v);
export function Lists(props) {
	const items = signal([]);
	const active = signal(0);
	const _el7 = _t7(), _ul = _el7.firstChild, _ol = _ul.nextSibling, _ol2 = _ol.nextSibling, _table = _ol2.nextSibling, _tbody = _table.firstChild, _p = _table.nextSibling, _text8 = _p.firstChild, _marker = _p.nextSibling, _marker2 = _marker.nextSibling;
	const _isSelected = selector(active);
	list(_ul, null, items, (item, i) => {
		const _el = _t0(), _text = _el.firstChild;
		bind(_el, () => _isSelected(item.id), _a0);
		bind(_el, () => i() === 0, _a1);
		insert(_el, () => i() + 1, _text);
		insert(_el, () => item.name);
		return _el;
	}, (item) => item.id);
	const _isSelected2 = selector(active);
	list(_ol, null, items, (item) => {
		const _el2 = _t1(), _text2 = _el2.firstChild;
		bind(_el2, () => !_isSelected2(item.id) ? "off" : "on", setClass);
		insertText(_text2, () => item.name);
		return _el2;
	});
	const _isSelected3 = selector(() => props.selectedId);
	list(_ol2, null, () => props.items, function(item) {
		const label = item.name.toUpperCase();
		const _el3 = _t1(), _text3 = _el3.firstChild;
		bind(_el3, () => _isSelected3(item.id), _a2);
		_text3.data = label;
		return _el3;
	}, (item) => item.id);
	list(_tbody, null, items, (row) => {
		const _el5 = _t3();
		list(_el5, null, () => row.tags, (tag) => {
			const _el4 = _t2(), _text4 = _el4.firstChild;
			insertText(_text4, tag);
			return _el4;
		});
		return _el5;
	});
	bind(_text8, () => items().map((item) => item.name).join(", "), setText);
	list(_el7, _marker, items, (item) => createComponent(Row, { item }), (item) => item.id);
	list(_el7, _marker2, items, (item) => branchValue(() => active() > 0, () => {
		const _el6 = _t4(), _text5 = _el6.firstChild;
		insertText(_text5, () => item.name);
		return _el6;
	}, () => _t5()));
	list(_el7, null, items, (item, i) => {
		const _nodes = _t6(), _dt = _nodes[0], _dd = _nodes[1], _text6 = _dt.firstChild, _text7 = _dd.firstChild;
		insertText(_text6, () => item.name);
		insertText(_text7, () => i());
		return _nodes;
	});
	return _el7;
}
