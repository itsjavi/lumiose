// Row keys (TASK-553): a key may read the item's destructured bindings, the index (passed to the
// key function only when read), a nested arrow's parameters and row consts (inlined), and a
// callback with several returns keeps the key its returned elements share.
import { signal } from "lumiose";
import { template, bind, setText, insertText, list } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<div> `);
const _t1 = /* @__PURE__ */ template(`<p> `);
const _t2 = /* @__PURE__ */ template(`<b> `);
const _t3 = /* @__PURE__ */ template(`<s>hidden`);
const _t4 = /* @__PURE__ */ template(`<u> `);
const _t5 = /* @__PURE__ */ template(`<div><!><!><!><!>`);
export function RowKeys() {
	const entries = signal([]);
	const _el6 = _t5(), _marker = _el6.firstChild, _marker2 = _marker.nextSibling, _marker3 = _marker2.nextSibling, _marker4 = _marker3.nextSibling;
	list(_el6, _marker, entries, ({ row, index }) => {
		const _el = _t0(), _text = _el.firstChild;
		bind(_text, () => row.length, setText);
		return _el;
	}, ({ row, index }) => `${index}:${row.map((p) => p.id).join("|")}`);
	list(_el6, _marker2, entries, (entry) => {
		const _el2 = _t1(), _text2 = _el2.firstChild;
		insertText(_text2, () => entry.key);
		return _el2;
	}, (entry, i) => `${i}:${entry.key}`);
	list(_el6, _marker3, entries, (entry, i) => {
		const _el3 = _t1(), _text3 = _el3.firstChild;
		insertText(_text3, () => i());
		return _el3;
	}, (entry) => entry.key);
	list(_el6, _marker4, entries, (entry) => {
		const id = entry.key;
		const same = id;
		const { index: at } = entry;
		const _el4 = _t2(), _text4 = _el4.firstChild;
		insertText(_text4, id);
		return _el4;
	}, (entry) => `${entry.key}@${entry.index}`);
	list(_el6, null, entries, (entry) => {
		if (entry.index < 0) return _t3();
		const _el5 = _t4(), _text5 = _el5.firstChild;
		insertText(_text5, () => entry.index);
		return _el5;
	}, (entry) => entry.key);
	return _el6;
}
