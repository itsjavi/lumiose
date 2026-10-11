// Fragments: multi-root templates, mixed with dynamic items in an array of renderables.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";
import { template, insertValue, createComponent, delegateEvents } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<h1>Title</h1><p>Body`, 1);
const _t1 = /* @__PURE__ */ template(`<h1>Count`);
const _t2 = /* @__PURE__ */ template(`<p>reset`);
const _t3 = /* @__PURE__ */ template(`<p>only`);
const _t4 = /* @__PURE__ */ template(`<div><span>a</span>b`);
const _t5 = /* @__PURE__ */ template(`Footer `);
export function Multi() {
	return _t0();
}
export function Mixed() {
	const count = signal(0);
	const _el = _t1();
	const _v = insertValue(count);
	const _v2 = createComponent(Card, {});
	const _el2 = _t2();
	_el2.$$click = () => count.set(0);
	return [
		_el,
		_v,
		_v2,
		_el2
	];
}
export const Single = () => _t3();
export const Nothing = () => [];
export const TextOnly = () => "Just text";
export function Nested() {
	return _t4();
}
export function TextAndDynamic() {
	const count = signal(0);
	return createComponent(Card, { get children() {
		const _el3 = _t5();
		return [_el3, insertValue(count)];
	} });
}
delegateEvents(["click"]);
