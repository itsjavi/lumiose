// Component call props (TASK-78, contract doc-2 §3.1): literal children are data properties on
// both targets; on the server, trivially safe expressions (local identifiers, single-level
// `props.x`, template literals of those) are data properties too. Everything else stays a lazy
// getter, so nothing runs earlier than on the client.
import { signal } from "lumiose";
import { Badge, Detail } from "./ui.tsx";
import { ssr, insert, createComponent } from "lumiose/server";
const _s0 = ["<i>★</i>"];
const _s1 = [
	"<main>",
	"",
	"",
	"</main>"
];
export function Page(props) {
	const user = signal(props.user);
	const size = 2;
	return ssr(_s1, insert(createComponent(Badge, {
		kind: "ok",
		children: "active"
	})), insert(createComponent(Badge, {
		kind: "count",
		children: "42"
	})), insert(createComponent(Detail, ((_d, _v, _d2, _v2, _d3, _v3, _d4, _v4, _d5, _v5, _d6, _v6) => ({
		title: props.title,
		size,
		label: `${props.tone}-${size}`,
		get name() {
			return _d ? _v : (_v = user().name, _d = true, _v);
		},
		get deep() {
			return _d2 ? _v2 : (_v2 = props.user.name, _d2 = true, _v2);
		},
		get maybe() {
			return _d3 ? _v3 : (_v3 = props.user?.name, _d3 = true, _v3);
		},
		get show() {
			return _d4 ? _v4 : (_v4 = user() != null, _d4 = true, _v4);
		},
		get icon() {
			return _d5 ? _v5 : (_v5 = ssr(_s0), _d5 = true, _v5);
		},
		get children() {
			return _d6 ? _v6 : (_v6 = props.title, _d6 = true, _v6);
		}
	}))())));
}
export function Defaults(props) {
	return createComponent(Badge, ((_d7, _v7) => ({
		get kind() {
			return _d7 ? _v7 : (_v7 = props.tone === void 0 ? "plain" : props.tone, _d7 = true, _v7);
		},
		label: props.label
	}))());
}
