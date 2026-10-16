// Arrays of renderables are created in document order, so that hydration claims the server nodes
// in the same order (TASK-234). Dynamic items render into `insertValue` ranges on the client and
// `insert` blocks on the server; runs of static items are templates of their own.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";
import { template, insertText, branch, listValue, insertValue, createComponent } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<span class=item> `);
const _t1 = /* @__PURE__ */ template(`<label>static`);
const _t2 = /* @__PURE__ */ template(`<div class=panel>`);
const _t3 = /* @__PURE__ */ template(`<div>`);
const _t4 = /* @__PURE__ */ template(`<h1>Title`);
const _t5 = /* @__PURE__ */ template(`<p>middle`);
const _t6 = /* @__PURE__ */ template(`<footer>end`);
const _t7 = /* @__PURE__ */ template(`<b>inner`);
const _t8 = /* @__PURE__ */ template(`<i>after`);
const _t9 = /* @__PURE__ */ template(`<li> `);
const _t10 = /* @__PURE__ */ template(`<label>after the list`);
const _t11 = /* @__PURE__ */ template(`Hello `);
const _t12 = /* @__PURE__ */ template(`, you have `);
const _t13 = /* @__PURE__ */ template(`<em>!`);
const _t14 = /* @__PURE__ */ template(`Footer `);
const show = signal(true);
const items = signal(["x", "y"]);
const name = signal("Ada");
function item(label) {
	const _el = _t0(), _text = _el.firstChild;
	insertText(_text, label);
	return _el;
}
// The TASK-218 repro: inserts before a static element in a conditional fragment.
export function InsertsBeforeStatic() {
	const _el3 = _t2();
	branch(_el3, null, show, () => {
		const _v = insertValue(() => item("a"));
		const _v2 = insertValue(() => item("b"));
		const _el2 = _t1();
		return [
			_v,
			_v2,
			_el2
		];
	});
	return _el3;
}
export function InsertsAfterStatic() {
	const _el5 = _t3();
	branch(_el5, null, show, () => {
		const _el4 = _t1();
		return [
			_el4,
			insertValue(() => item("a")),
			insertValue(() => item("b"))
		];
	});
	return _el5;
}
export function Interleaved() {
	const _el6 = _t4();
	const _v3 = insertValue(() => item("a"));
	const _v4 = createComponent(Card, {});
	const _el7 = _t5();
	const _v5 = insertValue(() => item("b"));
	const _el8 = _t6();
	return [
		_el6,
		_v3,
		_v4,
		_el7,
		_v5,
		_el8
	];
}
export function NestedFragments() {
	const _el11 = _t3();
	branch(_el11, null, show, () => {
		const _v6 = insertValue(() => item("a"));
		const _el9 = _t7();
		const _v7 = insertValue(() => item("b"));
		const _el10 = _t8();
		return [
			_v6,
			_el9,
			_v7,
			_el10
		];
	});
	return _el11;
}
export function MapInFragment() {
	const _el14 = _t3();
	branch(_el14, null, show, () => {
		const _v8 = listValue(items, (x) => {
			const _el12 = _t9(), _text2 = _el12.firstChild;
			insertText(_text2, x);
			return _el12;
		});
		const _el13 = _t10();
		return [_v8, _el13];
	});
	return _el14;
}
export function TextAndInserts() {
	const _el18 = _t3();
	branch(_el18, null, show, () => {
		const _el15 = _t11();
		const _v9 = insertValue(name);
		const _el16 = _t12();
		const _v10 = insertValue(() => item("a"));
		const _el17 = _t13();
		return [
			_el15,
			_v9,
			_el16,
			_v10,
			_el17
		];
	});
	return _el18;
}
export function ChildrenTextAndInsert() {
	return createComponent(Card, { get children() {
		const _el19 = _t14();
		return [_el19, insertValue(name)];
	} });
}
export function SingleInsert() {
	const _el20 = _t3();
	branch(_el20, null, show, () => insertValue(() => item("a")));
	return _el20;
}
