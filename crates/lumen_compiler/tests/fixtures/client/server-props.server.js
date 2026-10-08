// Component call props (TASK-78, contract doc-2 §3.1): literal children are data properties on
// both targets; on the server, trivially safe expressions (local identifiers, single-level
// `props.x`, template literals of those) are data properties too. Everything else stays a lazy
// getter, so nothing runs earlier than on the client.
import { signal } from "lumen";
import { Badge, Detail } from "./ui.tsx";
import { ssr, insert, createComponent } from "lumen/server";
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
	})), insert(createComponent(Detail, {
		title: props.title,
		size,
		label: `${props.tone}-${size}`,
		get name() {
			return user().name;
		},
		get deep() {
			return props.user.name;
		},
		get maybe() {
			return props.user?.name;
		},
		get show() {
			return user() != null;
		},
		get icon() {
			return ssr(_s0);
		},
		get children() {
			return props.title;
		}
	})));
}
export function Defaults(props) {
	return createComponent(Badge, {
		get kind() {
			return props.tone === void 0 ? "plain" : props.tone;
		},
		label: props.label
	});
}
