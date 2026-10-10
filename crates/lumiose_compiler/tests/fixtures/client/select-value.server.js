// <select value> marks the matching <option> selected in SSR output (static options, options
// from .map(), option text as value, optgroups, bind:value); the client sets the property.
import { signal } from "lumiose";
import { ssr, insertText, attr, list } from "lumiose/server";
const _s0 = [
	"<select><option value=a",
	">A</option><option value=b",
	">B</option><option",
	"> Plain   text </option><option value=c selected>C</option><optgroup label=More><option value=d",
	">D</option></optgroup></select>"
];
const _s1 = [
	"<option",
	"",
	">",
	"</option>"
];
const _s2 = ["<select>", "</select>"];
const _s3 = [
	"<form><select><option value=a",
	">A</option><option value=b",
	">B</option></select></form>"
];
const choice = signal("b");
const items = signal([{
	id: 1,
	label: "One"
}]);
export function Static() {
	const _selected = choice();
	return ssr(_s0, attr("selected", String(_selected) === "a"), attr("selected", String(_selected) === "b"), attr("selected", String(_selected) === "Plain text"), attr("selected", String(_selected) === "d"));
}
export function Mapped(props) {
	const _selected2 = props.selected;
	return ssr(_s2, list(items(), (item) => ssr(_s1, attr("value", item.id), attr("selected", String(_selected2) === String(item.id)), insertText(item.label))));
}
export function Bound() {
	const _selected3 = choice();
	return ssr(_s3, attr("selected", String(_selected3) === "a"), attr("selected", String(_selected3) === "b"));
}
