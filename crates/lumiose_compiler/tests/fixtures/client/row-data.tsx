// Row consts (TASK-65): `const`s of a `.map()` callback initialised from row data without calls
// count as row data, so selectors and data-slot handlers see through them.
import { signal } from "lumiose";

type Row = { id: number; name: string; label: () => string };

const rows = signal<Row[]>([]);
const selected = signal(0);
const select = (id: number) => selected.set(id);
const log = (...values: unknown[]) => console.log(...values);

export function RowData() {
  const prefix = "#";
  return (
    <table>
      {rows().map((row) => {
        const id = row.id;
        const key = id;
        const { name, label: text } = row;
        const upper = row.name.toUpperCase();
        return (
          <tr key={row.id} class={{ danger: selected() === key }}>
            <td>{id}</td>
            <td onClick={() => select(id)}>{name}</td>
            <td onClick={() => log(prefix, text)}>{text()}</td>
            <td onClick={() => log(row, id)}>both: per-row closure</td>
            <td onClick={() => log(upper)}>call: per-row closure</td>
          </tr>
        );
      })}
    </table>
  );
}
