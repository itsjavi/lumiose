// LUM2001 in server pages (TASK-86): calls of `lumiose`'s request APIs and of imports from
// server-only modules (`*.server.*`, `src/server/**`) are not reactive reads. Signals, props and
// `lumiose/router`'s accessors still are.
import { locals, url as requestUrl, signal } from "lumiose";
import { url } from "lumiose/router";
import { queries } from "../server/queries.server.ts";
import { session } from "./server/session.ts";
import { ssr, SSRHtml, text, insert, attr } from "lumiose/server";
const _s0 = [
	"<main",
	"",
	"",
	"",
	">",
	"",
	"</main>"
];
const _c0 = (h0, h1, h2, h3, h4, h5) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" && typeof h3 === "string" && typeof h4 === "string" && typeof h5 === "string" ? new SSRHtml("<main" + h0 + h1 + h2 + h3 + ">" + h4 + h5 + "</main>") : ssr(_s0, h0, h1, h2, h3, h4, h5);
const _s1 = [
	"<p",
	"",
	">",
	"</p>"
];
const _c1 = (h0, h1, h2) => typeof h0 === "string" && typeof h1 === "string" && typeof h2 === "string" ? new SSRHtml("<p" + h0 + h1 + ">" + h2 + "</p>") : ssr(_s1, h0, h1, h2);
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
	return _c0(attr("data-user", user), attr("data-next", next), attr("data-search", search), attr("data-theme", theme), insert(book.title), insert(featured.length));
}
export function Island(props) {
	const count = signal(0);
	const doubled = count() * 2;
	const upper = props.isbn.toUpperCase();
	const query = url().searchParams.get("q");
	return _c1(attr("data-isbn", upper), attr("data-query", query), text(doubled));
}

// --- diagnostics ---
// LUM2001 warning 29:9 `doubled` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 30:9 `upper` is computed once from a reactive value, so the JSX that uses it never updates
// LUM2001 warning 31:9 `query` is computed once from a reactive value, so the JSX that uses it never updates
