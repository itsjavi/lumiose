// Fragments: multi-root templates, mixed with dynamic items in an array of renderables.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";
import { ssr, insertValue, createComponent } from "lumiose/server";
const _s0 = ["<h1>Title</h1><p>Body</p>"];
const _s1 = ["<h1>Count</h1>"];
const _s2 = ["<p>reset</p>"];
const _s3 = ["<p>only</p>"];
const _s4 = ["<div><span>a</span>b</div>"];
export function Multi() {
	return ssr(_s0);
}
export function Mixed() {
	const count = signal(0);
	return [
		ssr(_s1),
		insertValue(count()),
		createComponent(Card, {}),
		ssr(_s2)
	];
}
export const Single = () => ssr(_s3);
export const Nothing = () => [];
export const TextOnly = () => "Just text";
export function Nested() {
	return ssr(_s4);
}
export function TextAndDynamic() {
	const count = signal(0);
	return createComponent(Card, ((_d, _v) => ({ get children() {
		return _d ? _v : (_v = ["Footer ", insertValue(count())], _d = true, _v);
	} }))());
}
