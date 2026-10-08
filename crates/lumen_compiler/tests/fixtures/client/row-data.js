// Row consts (TASK-65): `const`s of a `.map()` callback initialised from row data without calls
// count as row data, so selectors and data-slot handlers see through them.
import { signal } from "lumen";
import { template, bind, toggleClass, insert, list, selector, delegateEvents } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<tr><td></td><td></td><td></td><td>both: per-row closure</td><td>call: per-row closure`);
const _t1 = /* @__PURE__ */ template(`<table><tbody>`);
const _a0 = (el, v) => toggleClass(el, "danger", v);
const _onClick = (id) => select(id);
const rows = signal([]);
const selected = signal(0);
const select = (id) => selected.set(id);
const log = (...values) => console.log(...values);
export function RowData() {
	const _onClick2 = (text) => log(prefix, text);
	const prefix = "#";
	const _el2 = _t1(), _tbody = _el2.firstChild;
	const _isSelected = selector(selected);
	list(_tbody, null, rows, (row) => {
		const id = row.id;
		const key = id;
		const { name, label: text } = row;
		const upper = row.name.toUpperCase();
		const _el = _t0(), _td = _el.firstChild, _td2 = _td.nextSibling, _td3 = _td2.nextSibling, _td4 = _td3.nextSibling, _td5 = _td4.nextSibling;
		bind(_el, () => _isSelected(key), _a0);
		insert(_td, id);
		_td2.$$click = _onClick;
		_td2.$$clickData = id;
		insert(_td2, name);
		_td3.$$click = _onClick2;
		_td3.$$clickData = text;
		insert(_td3, text);
		_td4.$$click = () => log(row, id);
		_td5.$$click = () => log(upper);
		return _el;
	}, (row) => row.id);
	return _el2;
}
delegateEvents(["click"]);
