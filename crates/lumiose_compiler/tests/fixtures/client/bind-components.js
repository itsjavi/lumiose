// `bind:x` on components and custom elements (decision-62, TASK-360).
import { signal } from "lumiose";
import { Dialog, Combobox, useSelection } from "./ui.ts";
import { template, bind, setText, insert, createComponent, restProps, mergeProps, spread, bindValue, bindProperty } from "lumiose/dom";
const _t0 = /* @__PURE__ */ template(`<p> `);
const _t1 = /* @__PURE__ */ template(`<section><!><!><!><lu-menu class=menu></lu-menu><lu-combobox name=fruit></lu-combobox><lu-combobox></lu-combobox><input>`);
export function Settings(props) {
	const open = signal(false);
	const fruit = signal(null);
	const state = { checked: signal(true) };
	const _el2 = _t1(), _marker = _el2.firstChild, _marker2 = _marker.nextSibling, _marker3 = _marker2.nextSibling, _lu_menu = _marker3.nextSibling, _lu_combobox = _lu_menu.nextSibling, _lu_combobox2 = _lu_combobox.nextSibling, _input = _lu_combobox2.nextSibling;
	insert(_el2, createComponent(Dialog.Root, {
		get open() {
			return open();
		},
		onOpenChange: (_v) => open.set(_v),
		get children() {
			const _el = _t0(), _text = _el.firstChild;
			bind(_text, () => open() ? "open" : "closed", setText);
			return _el;
		}
	}), _marker);
	insert(_el2, createComponent(Dialog.Root, {
		get open() {
			return open();
		},
		onOpenChange: (_v2, ..._a) => (open.set(_v2), props.onOpenChange?.(_v2, ..._a)),
		role: "alertdialog"
	}), _marker2);
	insert(_el2, createComponent(Dialog.Root, {
		get open() {
			return state.checked();
		},
		onOpenChange: (_v3, ..._a2) => (state.checked.set(_v3), ((next) => console.log(next))?.(_v3, ..._a2))
	}), _marker3);
	insert(_el2, createComponent(Combobox.Root, ((_s) => ({
		get value() {
			return _s();
		},
		onValueChange: (_v4) => _s.set(_v4),
		label: "Fruit"
	}))(useSelection())), _lu_menu);
	bindProperty(_lu_menu, "open", open);
	bindProperty(_lu_combobox, "value", fruit);
	spread(_lu_combobox2, () => props);
	bindProperty(_lu_combobox2, "value", fruit);
	spread(_input, () => props);
	bindValue(_input, fruit);
	return _el2;
}
export function Forwarded(props) {
	const rest = restProps(props, ["open"]);
	return createComponent(Dialog.Root, mergeProps({
		get open() {
			return props.open();
		},
		onOpenChange: (_v5) => props.open.set(_v5)
	}, rest));
}
