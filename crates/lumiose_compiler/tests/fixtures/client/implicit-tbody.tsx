// The HTML parser wraps rows of a <table> in an implicit <tbody>: both targets spell it out for
// static <tr>s, row-producing .map() calls and conditionals, so walks match the parsed DOM.
import { signal } from "lumiose";

const rows = signal([{ id: 1, name: "a" }]);
const open = signal(true);

export function Mapped() {
  return <table>{rows().map((row) => <tr><td>{row.name}</td></tr>)}</table>;
}

export function Mixed() {
  return (
    <table>
      <caption>Rows</caption>
      <thead><tr><th>Name</th></tr></thead>
      <tr><td>first</td></tr>
      {rows().map((row) => {
        const label = row.name.toUpperCase();
        return <tr><td>{label}</td></tr>;
      })}
      {open() ? <tr><td>open</td></tr> : null}
      {open() && <tr><td>also</td></tr>}
      <tfoot><tr><td>total</td></tr></tfoot>
    </table>
  );
}

export function Explicit() {
  return <table><tbody>{rows().map((row) => <tr><td>{row.name}</td></tr>)}</tbody></table>;
}
