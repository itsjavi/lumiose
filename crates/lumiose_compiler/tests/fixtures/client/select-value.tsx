// <select value> marks the matching <option> selected in SSR output (static options, options
// from .map(), option text as value, optgroups, bind:value); the client sets the property.
import { signal } from "lumiose";

const choice = signal("b");
const items = signal([{ id: 1, label: "One" }]);

export function Static() {
  return (
    <select value={choice()}>
      <option value="a">A</option>
      <option value="b">B</option>
      <option> Plain   text </option>
      <option value="c" selected>C</option>
      <optgroup label="More"><option value="d">D</option></optgroup>
    </select>
  );
}

export function Mapped(props: { selected: number }) {
  return (
    <select value={props.selected}>
      {items().map((item) => <option value={item.id}>{item.label}</option>)}
    </select>
  );
}

export function Bound() {
  return (
    <form>
      <select bind:value={choice}>
        <option value="a">A</option>
        <option value="b">B</option>
      </select>
    </form>
  );
}
