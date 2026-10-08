// Async components: only awaits whose nearest function is the component are rewritten (site
// indices in source order); `for await` is lowered; every async component form is tagged.
import { fetchJSON } from "lumen";
import { template, bind, setText, insert, createComponent, delegateEvents, $await, $leave, $async } from "lumen/dom";
const _t0 = /* @__PURE__ */ template(`<main><h1></h1><p></p><button>`);
const _t1 = /* @__PURE__ */ template(`<pre> `);
const _t2 = /* @__PURE__ */ template(`<p>`);
const _t3 = /* @__PURE__ */ template(`<p> `);
$async(Page);
$async(Disposing);
async function load(id) {
	return await fetchJSON(`/api/${id}`);
}
export default async function Page(props) {
	try {
		const first = (await $await(() => load(props.ids[0]), 0))();
		const later = async () => await load("later");
		let total = 0;
		try {
			total = (await $await(() => fetchJSON("/api/total"), 1))() + 1;
		} catch {
			total = -1;
		}
		const _el = _t0(), _h1 = _el.firstChild, _p = _h1.nextSibling, _button = _p.nextSibling;
		insert(_h1, () => first.title);
		insert(_p, (await $await(() => load("inline"), 2))());
		_button.$$click = later;
		insert(_button, total);
		return _el;
	} finally {
		$leave();
	}
}
export const Stream = /* @__PURE__ */ $async(async (props) => {
	try {
		const lines = [];
		{
			const _source = props.source, _iter = _source[Symbol.asyncIterator] ? _source[Symbol.asyncIterator]() : _source[Symbol.iterator]();
			let _step;
			try {
				outer: for (;;) {
					_step = void 0;
					_step = (await $await(() => _iter.next(), 0))();
					if (_step.done) break;
					const line = _step.value;
					{
						if (line === "") continue outer;
						lines.push(line);
					}
				}
			} finally {
				if (_step && !_step.done && _iter.return) _iter.return();
			}
		}
		const _el2 = _t1(), _text = _el2.firstChild;
		bind(_text, () => lines.join("\n"), setText);
		return _el2;
	} finally {
		$leave();
	}
});
const Quick = /* @__PURE__ */ $async(async () => {
	try {
		const _el3 = _t2();
		insert(_el3, (await $await(() => Promise.resolve("quick"), 0))());
		return _el3;
	} finally {
		$leave();
	}
});
export const Anonymous = /* @__PURE__ */ $async(async function Anonymous() {
	try {
		return createComponent(Quick, {});
	} finally {
		$leave();
	}
});
export async function Disposing() {
	try {
		await using handle = (await $await(() => fetchJSON("/api/handle"), 0))();
		const _el4 = _t3(), _text2 = _el4.firstChild;
		bind(_text2, () => String(handle), setText);
		return _el4;
	} finally {
		$leave();
	}
}
delegateEvents(["click"]);

// --- diagnostics ---
// LUM1007 error 43:3 `await using` cannot be used in a component: its disposal awaits after the body, outside the component's run
