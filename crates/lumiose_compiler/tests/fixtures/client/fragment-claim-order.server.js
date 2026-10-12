// Arrays of renderables are created in document order, so that hydration claims the server nodes
// in the same order (TASK-234). Dynamic items render into `insertValue` ranges on the client and
// `insert` blocks on the server; runs of static items are templates of their own.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";
import { ssr, SSRHtml, insertText, insertValue, list, branchArm, createComponent } from "lumiose/server";
const _s0 = ["<span class=item>", "</span>"];
const _c0 = (h0) => typeof h0 === "string" ? new SSRHtml("<span class=item>" + h0 + "</span>") : ssr(_s0, h0);
const _s1 = ["<label>static</label>"];
const _s2 = ["<div class=panel>", "</div>"];
const _c2 = (h0) => h0 instanceof SSRHtml ? new SSRHtml("<div class=panel>" + h0.t + "</div>") : ssr(_s2, h0);
const _s3 = ["<div>", "</div>"];
const _c3 = (h0) => h0 instanceof SSRHtml ? new SSRHtml("<div>" + h0.t + "</div>") : ssr(_s3, h0);
const _s4 = ["<h1>Title</h1>"];
const _s5 = ["<p>middle</p>"];
const _s6 = ["<footer>end</footer>"];
const _s7 = ["<b>inner</b>"];
const _s8 = ["<i>after</i>"];
const _s9 = ["<li>", "</li>"];
const _c9 = (h0) => typeof h0 === "string" ? new SSRHtml("<li>" + h0 + "</li>") : ssr(_s9, h0);
const _s10 = ["<label>after the list</label>"];
const _s11 = ["<em>!</em>"];
const show = signal(true);
const items = signal(["x", "y"]);
const name = signal("Ada");
function item(label) {
	return _c0(insertText(label));
}
// The TASK-218 repro: inserts before a static element in a conditional fragment.
export function InsertsBeforeStatic() {
	return _c2(show() ? branchArm(true, [
		insertValue(item("a")),
		insertValue(item("b")),
		ssr(_s1)
	]) : branchArm(false));
}
export function InsertsAfterStatic() {
	return _c3(show() ? branchArm(true, [
		ssr(_s1),
		insertValue(item("a")),
		insertValue(item("b"))
	]) : branchArm(false));
}
export function Interleaved() {
	return [
		ssr(_s4),
		insertValue(item("a")),
		createComponent(Card, {}),
		ssr(_s5),
		insertValue(item("b")),
		ssr(_s6)
	];
}
export function NestedFragments() {
	return _c3(show() ? branchArm(true, [
		insertValue(item("a")),
		ssr(_s7),
		insertValue(item("b")),
		ssr(_s8)
	]) : branchArm(false));
}
export function MapInFragment() {
	return _c3(show() ? branchArm(true, [list(items(), (x) => _c9(insertText(x))), ssr(_s10)]) : branchArm(false));
}
export function TextAndInserts() {
	return _c3(show() ? branchArm(true, [
		"Hello ",
		insertValue(name()),
		", you have ",
		insertValue(item("a")),
		ssr(_s11)
	]) : branchArm(false));
}
export function ChildrenTextAndInsert() {
	return createComponent(Card, ((_d, _v) => ({ get children() {
		return _d ? _v : (_v = ["Footer ", insertValue(name())], _d = true, _v);
	} }))());
}
export function SingleInsert() {
	return _c3(show() ? branchArm(true, item("a")) : branchArm(false));
}
