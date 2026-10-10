// Reactivity diagnostics: LUM2001 stale derived value, LUM2002 write during render, LUM2003
// reactive early return, LUM2004 component called as a function, LUM2005 children inserted
// twice, LUM2006 reactive index read in row setup.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";
import { ssr, insert, insertText, attr, list } from "lumiose/server";
const _s0 = [
	"<div",
	"",
	"",
	">",
	"",
	"",
	"<span>",
	"</span></div>"
];
const _s1 = [
	"<li",
	">",
	": ",
	"</li>"
];
const _s2 = ["<ul>", "</ul>"];
const shared = signal(0);
export function Child(props) {
	const upper = props.name.toUpperCase();
	const { name } = props;
	const once = signal(props.name);
	shared.set(1);
	if (!props.name) {
		return null;
	}
	return ssr(_s0, attr("title", upper), attr("data-name", name), attr("data-once", once()), insert(props.children), insert(props.children), insert(Card({ title: "x" })), insertText(shared.set(2)));
}
export function Rows(props) {
	return ssr(_s2, list(props.items, (item, i) => {
		const position = i();
		return ssr(_s1, attr("data-i", i()), insert(position), insert(item));
	}));
}

// --- diagnostics ---
// LUM2001 warning 10:9 `upper` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 11:9 `name` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2002 error 13:3 `shared` is written while the component renders
// LUM2003 error 14:7 this early return depends on a reactive value, but a component body runs once
// LUM2005 warning 20:7 `children` is inserted more than once; children are created lazily and can only be placed once
// LUM2004 error 21:8 the component `Card` is called as a function
// LUM2002 error 22:14 `shared` is written while the component renders
// LUM2006 warning 31:26 the list index `i` is read once here, so this value goes stale when rows move
