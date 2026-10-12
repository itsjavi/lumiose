// <select value> marks the matching <option> selected in SSR output (static options, options
// from .map(), option text as value, optgroups, bind:value); the client sets the property.
import { signal } from "lumiose";
import { ssr, SSRHtml, insertText, attr, list } from "lumiose/server";
const _s0 = [
	"<select><option value=a",
	">A</option><option value=b",
	">B</option><option",
	"> Plain   text </option><option value=c selected>C</option><optgroup label=More><option value=d",
	">D</option></optgroup></select>"
];
const _c0 = (h0, h1, h2, h3) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" ? new SSRHtml("<select><option value=a" + h0 + ">A</option><option value=b" + h1 + ">B</option><option" + h2 + "> Plain   text </option><option value=c selected>C</option><optgroup label=More><option value=d" + h3 + ">D</option></optgroup></select>") : ssr(_s0, h0, h1, h2, h3);
const _s1 = [
	"<option",
	"",
	">",
	"</option>"
];
const _c1 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<option" + h0 + h1 + ">" + h2 + "</option>") : ssr(_s1, h0, h1, h2);
const _s2 = ["<select>", "</select>"];
const _c2 = (h0) => h0 instanceof SSRHtml ? new SSRHtml("<select>" + h0.t + "</select>") : ssr(_s2, h0);
const _s3 = [
	"<form><select><option value=a",
	">A</option><option value=b",
	">B</option></select></form>"
];
const _c3 = (h0, h1) => typeof h0 === "string" && typeof h1 === "string" ? new SSRHtml("<form><select><option value=a" + h0 + ">A</option><option value=b" + h1 + ">B</option></select></form>") : ssr(_s3, h0, h1);
const choice = signal("b");
const items = signal([{
	id: 1,
	label: "One"
}]);
export function Static() {
	const _selected = choice();
	return _c0(attr("selected", String(_selected) === "a"), attr("selected", String(_selected) === "b"), attr("selected", String(_selected) === "Plain text"), attr("selected", String(_selected) === "d"));
}
export function Mapped(props) {
	const _selected2 = props.selected;
	return _c2(list(items(), (item) => _c1(attr("value", item.id), attr("selected", String(_selected2) === String(item.id)), insertText(item.label))));
}
export function Bound() {
	const _selected3 = choice();
	return _c3(attr("selected", String(_selected3) === "a"), attr("selected", String(_selected3) === "b"));
}
