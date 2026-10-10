// LUM2001 in server pages (TASK-86): calls of `lumiose`'s request APIs and of imports from
// server-only modules (`*.server.*`, `src/server/**`) are not reactive reads. Signals, props and
// `lumiose/router`'s accessors still are.
import { locals, url as requestUrl, signal } from "lumiose";
import { url } from "lumiose/router";
import { queries } from "../server/queries.server.ts";
import { session } from "./server/session.ts";
import { template, setAttr, insert } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<main><!>`);
const _t1 = /* @__PURE__ */ template(`<p> `);
export default function BookPage(props) {
	const book = queries().getBook("0-00");
	const featured = queries().featuredBooks(6);
	const user = locals().user ?? null;
	const next = requestUrl().searchParams.get("next");
	const search = requestUrl().searchParams;
	const theme = session().theme;
	if (!locals().user) {
		return null;
	}
	const _el = _t0(), _marker = _el.firstChild;
	setAttr(_el, "data-user", user);
	setAttr(_el, "data-next", next);
	setAttr(_el, "data-search", search);
	setAttr(_el, "data-theme", theme);
	insert(_el, () => book.title, _marker);
	insert(_el, () => featured.length);
	return _el;
}
export function Island(props) {
	const count = signal(0);
	const doubled = count() * 2;
	const upper = props.isbn.toUpperCase();
	const query = url().searchParams.get("q");
	const _el2 = _t1(), _text = _el2.firstChild;
	setAttr(_el2, "data-isbn", upper);
	setAttr(_el2, "data-query", query);
	_text.data = doubled;
	return _el2;
}

// --- diagnostics ---
// LUM2001 warning 29:9 `doubled` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 30:9 `upper` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 31:9 `query` is computed once from a reactive value, so the JSX that uses it never updates
