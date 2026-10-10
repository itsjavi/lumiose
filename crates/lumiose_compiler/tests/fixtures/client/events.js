// Events: camelCase onX delegated for bubbling events, direct listeners for the others and for
// on:x; row handlers that only capture the item and stable bindings move out of the row.
import { signal } from "lumiose";
import { template, list, delegateEvents, listen } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<li><button>module</button><button>setup</button><button>no item</button><button>index</button><button>mutable</button><button>function</button><button>pointer`);
const _t1 = /* @__PURE__ */ template(`<div><input><ul>`);
const _onClick = (item) => log(String(item.id));
const _onClick4 = function() {
	log(String(this));
};
const _onPointerdown = (item) => log(String(item.id));
const log = (message) => console.log(message);
export function Events(props) {
	const _onClick2 = (item) => props.onPick(item.id);
	const _onClick3 = (e) => {
		e.preventDefault();
		reset();
	};
	const count = signal(0);
	const reset = () => count.set(0);
	let changing = 0;
	changing = 1;
	const _el2 = _t1(), _input = _el2.firstChild, _ul = _input.nextSibling;
	_el2.$$click = () => count.update((n) => n + 1);
	_el2.$$keydown = (e) => log(e.key);
	_el2.$$dblclick = reset;
	_input.$$input = (e) => log(e.currentTarget.value);
	listen(_input, "focus", () => log("focus"));
	listen(_input, "mouseenter", reset);
	listen(_input, "my-event", reset);
	listen(_input, "scroll", () => log("scroll"));
	list(_ul, null, () => props.items(), (item, index) => {
		const _el = _t0(), _button = _el.firstChild, _button2 = _button.nextSibling, _button3 = _button2.nextSibling, _button4 = _button3.nextSibling, _button5 = _button4.nextSibling, _button6 = _button5.nextSibling, _button7 = _button6.nextSibling;
		_button.$$click = _onClick;
		_button.$$clickData = item;
		_button2.$$click = _onClick2;
		_button2.$$clickData = item;
		_button3.$$click = _onClick3;
		_button4.$$click = () => log(`${index()}`);
		_button5.$$click = () => log(String(changing + item.id));
		_button6.$$click = _onClick4;
		_button7.$$pointerdown = _onPointerdown;
		_button7.$$pointerdownData = item;
		listen(_button7, "wheel", () => log("wheel"));
		return _el;
	});
	return _el2;
}
delegateEvents([
	"click",
	"dblclick",
	"input",
	"keydown",
	"pointerdown"
]);
