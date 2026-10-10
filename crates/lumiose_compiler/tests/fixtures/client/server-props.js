// Component call props (TASK-78, contract doc-2 §3.1): literal children are data properties on
// both targets; on the server, trivially safe expressions (local identifiers, single-level
// `props.x`, template literals of those) are data properties too. Everything else stays a lazy
// getter, so nothing runs earlier than on the client.
import { signal } from "lumiose";
import { Badge, Detail } from "./ui.tsx";
import { template, insert, createComponent } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<i>★`);
const _t1 = /* @__PURE__ */ template(`<main><!><!>`);
export function Page(props) {
	const user = signal(props.user);
	const size = 2;
	const _el = _t1(), _marker = _el.firstChild, _marker2 = _marker.nextSibling;
	insert(_el, createComponent(Badge, {
		kind: "ok",
		children: "active"
	}), _marker);
	insert(_el, createComponent(Badge, {
		kind: "count",
		children: "42"
	}), _marker2);
	insert(_el, createComponent(Detail, {
		get title() {
			return props.title;
		},
		size,
		get label() {
			return `${props.tone}-${size}`;
		},
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
			return _t0();
		},
		get children() {
			return props.title;
		}
	}));
	return _el;
}
export function Defaults(props) {
	return createComponent(Badge, {
		get kind() {
			return props.tone === void 0 ? "plain" : props.tone;
		},
		get label() {
			return props.label;
		}
	});
}
