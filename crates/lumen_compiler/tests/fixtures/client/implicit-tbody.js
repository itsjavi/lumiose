// The HTML parser wraps rows of a <table> in an implicit <tbody>: both targets spell it out for
// static <tr>s, row-producing .map() calls and conditionals, so walks match the parsed DOM.
import { signal } from "lumen";
import { template, insertText, list, branch } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<tr><td> `);
const _t1 = /* @__PURE__ */ template(`<table><tbody>`);
const _t2 = /* @__PURE__ */ template(`<tr><td>open`);
const _t3 = /* @__PURE__ */ template(`<tr><td>also`);
const _t4 = /* @__PURE__ */ template(`<table><caption>Rows</caption><thead><tr><th>Name</th></tr></thead><tbody><tr><td>first</td></tr><!><!></tbody><tfoot><tr><td>total`);
const rows = signal([{
	id: 1,
	name: "a"
}]);
const open = signal(true);
export function Mapped() {
	const _el2 = _t1(), _tbody = _el2.firstChild;
	list(_tbody, null, rows, (row) => {
		const _el = _t0(), _text = _el.firstChild.firstChild;
		insertText(_text, () => row.name);
		return _el;
	});
	return _el2;
}
export function Mixed() {
	const _el4 = _t4(), _tbody2 = _el4.firstChild.nextSibling.nextSibling, _marker = _tbody2.firstChild.nextSibling, _marker2 = _marker.nextSibling;
	list(_tbody2, _marker, rows, (row) => {
		const label = row.name.toUpperCase();
		const _el3 = _t0(), _text2 = _el3.firstChild.firstChild;
		_text2.data = label;
		return _el3;
	});
	branch(_tbody2, _marker2, open, () => _t2());
	branch(_tbody2, null, open, () => _t3());
	return _el4;
}
export function Explicit() {
	const _el6 = _t1(), _tbody3 = _el6.firstChild;
	list(_tbody3, null, rows, (row) => {
		const _el5 = _t0(), _text3 = _el5.firstChild.firstChild;
		insertText(_text3, () => row.name);
		return _el5;
	});
	return _el6;
}
