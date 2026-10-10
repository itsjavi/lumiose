// Async components: only awaits whose nearest function is the component are rewritten (site
// indices in source order); `for await` is lowered; every async component form is tagged.
import { fetchJSON } from "lumiose";
import { ssr, text, insertText, createComponent, $await, $leave, $async } from "lumiose/server";
const _s0 = [
	"<main><h1>",
	"</h1><p>",
	"</p><button>",
	"</button></main>"
];
const _s1 = ["<pre>", "</pre>"];
const _s2 = ["<p>", "</p>"];
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
		return ssr(_s0, insertText(first.title), insertText((await $await(() => load("inline"), 2))()), insertText(total));
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
		return ssr(_s1, text(lines.join("\n")));
	} finally {
		$leave();
	}
});
const Quick = /* @__PURE__ */ $async(async () => {
	try {
		return ssr(_s2, insertText((await $await(() => Promise.resolve("quick"), 0))()));
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
		return ssr(_s2, text(String(handle)));
	} finally {
		$leave();
	}
}

// --- diagnostics ---
// LUM1007 error 43:3 `await using` cannot be used in a component: its disposal awaits after the body, outside the component's run
