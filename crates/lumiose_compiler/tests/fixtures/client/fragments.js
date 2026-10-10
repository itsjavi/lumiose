// Fragments: multi-root templates, mixed with dynamic items in an array of renderables.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";
import { template, createComponent, delegateEvents } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<h1>Title</h1><p>Body`, 1);
const _t1 = /* @__PURE__ */ template(`<h1>Count</h1><p>reset`, 1);
const _t2 = /* @__PURE__ */ template(`<p>only`);
const _t3 = /* @__PURE__ */ template(`<div><span>a</span>b`);
export function Multi() {
	return _t0();
}
export function Mixed() {
	const count = signal(0);
	const _nodes = _t1(), _p = _nodes[1];
	_p.$$click = () => count.set(0);
	return [
		_nodes[0],
		count,
		createComponent(Card, {}),
		_p
	];
}
export const Single = () => _t2();
export const Nothing = () => [];
export const TextOnly = () => "Just text";
export function Nested() {
	return _t3();
}
export function TextAndDynamic() {
	const count = signal(0);
	return createComponent(Card, { get children() {
		return ["Footer ", count];
	} });
}
delegateEvents(["click"]);
