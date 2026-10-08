// LUM2001 in server pages (TASK-86): calls of `lumen`'s request APIs and of imports from
// server-only modules (`*.server.*`, `src/server/**`) are not reactive reads. Signals, props and
// `lumen/router`'s accessors still are.
import { locals, url as requestUrl, signal } from "lumen";
import { url } from "lumen/router";
import { queries } from "../server/queries.server.ts";
import { session } from "./server/session.ts";
import { ssr, text, insert, attr } from "lumen/server";
const _s0 = [
	"<main",
	"",
	"",
	"",
	">",
	"",
	"</main>"
];
const _s1 = [
	"<p",
	"",
	">",
	"</p>"
];
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
	return ssr(_s0, attr("data-user", user), attr("data-next", next), attr("data-search", search), attr("data-theme", theme), insert(book.title), insert(featured.length));
}
export function Island(props) {
	const count = signal(0);
	const doubled = count() * 2;
	const upper = props.isbn.toUpperCase();
	const query = url().searchParams.get("q");
	return ssr(_s1, attr("data-isbn", upper), attr("data-query", query), text(doubled));
}

// --- diagnostics ---
// LUM2001 warning 29:9 `doubled` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 30:9 `upper` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 31:9 `query` is computed once from a reactive value, so the JSX that uses it never updates
