// Reactivity diagnostics: LUM2001 stale derived value, LUM2002 write during render, LUM2003
// reactive early return, LUM2004 component called as a function, LUM2005 children inserted
// twice, LUM2006 reactive index read in row setup.
import { signal } from "lumiose";
import { Card } from "./Card.stsx";
import { ssr, SSRHtml, insert, insertText, attr, list } from "lumiose/server";
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
const _c0 = (h0, h1, h2, h3, h4, h5, h6) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && typeof h4 === "string" && typeof h5 === "string" && typeof h6 === "string" ? new SSRHtml("<div" + h0 + h1 + h2 + ">" + h3 + h4 + h5 + "<span>" + h6 + "</span></div>") : ssr(_s0, h0, h1, h2, h3, h4, h5, h6);
const _s1 = [
	"<li",
	">",
	": ",
	"</li>"
];
const _c1 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<li" + h0 + ">" + h1 + ": " + h2 + "</li>") : ssr(_s1, h0, h1, h2);
const _s2 = ["<ul>", "</ul>"];
const _c2 = (h0) => h0 instanceof SSRHtml ? new SSRHtml("<ul>" + h0.t + "</ul>") : ssr(_s2, h0);
const _s3 = ["<p>Sign in</p>"];
const _s4 = ["<p>", "</p>"];
const _c4 = (h0) => typeof h0 === "string" ? new SSRHtml("<p>" + h0 + "</p>") : ssr(_s4, h0);
const shared = signal(0);
export function Child(props) {
	const upper = props.name.toUpperCase();
	const once = signal(props.name);
	shared.set(1);
	if (!props.name) {
		return null;
	}
	return _c0(attr("title", upper), attr("data-name", props.name), attr("data-once", once()), insert(props.children), insert(props.children), insert(Card({ title: "x" })), insertText(shared.set(2)));
}
export function Rows(props) {
	return _c2(list(props.items, (item, i) => {
		const position = i();
		return _c1(attr("data-i", i()), insert(position), insert(item));
	}));
}
// LUM2003 is an error on a signal or accessor read and a warning on a prop read (decision-77),
// also through a derived local and in a `switch`.
export function Account(props) {
	const kind = props.kind;
	switch (kind) {
		case "guest": return null;
	}
	if (!props.user()) return ssr(_s3);
	return _c4(insertText(props.user()));
}

// --- diagnostics ---
// LUM2001 warning 10:9 `upper` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2002 error 13:3 `shared` is written while the component renders
// LUM2003 warning 14:7 this early return depends on a prop, but a component body runs once: it never updates if a parent passes a changing value
// LUM2005 warning 20:7 `children` is inserted more than once; children are created lazily and can only be placed once
// LUM2004 error 21:8 the component `Card` is called as a function
// LUM2002 error 22:14 `shared` is written while the component renders
// LUM2006 warning 31:26 the list index `i` is read once here, so this value goes stale when rows move
// LUM2003 warning 42:11 this early return depends on a prop, but a component body runs once: it never updates if a parent passes a changing value
// LUM2003 error 46:7 this early return depends on a reactive value, but a component body runs once
