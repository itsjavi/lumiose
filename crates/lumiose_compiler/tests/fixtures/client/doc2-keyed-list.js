// Contract doc-2 §5.2: keyed list, selector, data-slot event.
import { signal } from "lumiose";
import { template, bind, toggleClass, insertText, list, selector, delegateEvents } from "lumiose/dom";
import "/src/doc2-keyed-list.stsx?lumiose&type=style&lang.css";
const _t0 = /* @__PURE__ */ template(`<tr data-l-tavixavi><td data-l-tavixavi><a data-l-tavixavi> `);
const _t1 = /* @__PURE__ */ template(`<tbody data-l-tavixavi>`);
const _a0 = (el, v) => toggleClass(el, "danger", v);
const _onClick = (row) => select(row.id);
const rows = signal([]);
const selected = signal(0);
const select = (id) => selected.set(id);
export function Rows() {
	const _el2 = _t1();
	const _isSelected = selector(selected);
	list(_el2, null, rows, (row) => {
		const _el = _t0(), _a = _el.firstChild.firstChild, _text = _a.firstChild;
		bind(_el, () => _isSelected(row.id), _a0);
		_a.$$click = _onClick;
		_a.$$clickData = row;
		insertText(_text, () => row.label());
		return _el;
	});
	return _el2;
}
delegateEvents(["click"]);
