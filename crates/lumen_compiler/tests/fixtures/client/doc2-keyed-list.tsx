// @scope file=data-l-x
// Contract doc-2 §5.2: keyed list, selector, data-slot event.
import { signal } from "lumen";

type Row = { id: number; label: () => string };
const rows = signal<Row[]>([]);
const selected = signal(0);
const select = (id: number) => selected.set(id);

export function Rows() {
  return (
    <tbody>
      {rows().map((row) => (
        <tr class={{ danger: selected() === row.id }}>
          <td><a onClick={() => select(row.id)}>{row.label()}</a></td>
        </tr>
      ))}
    </tbody>
  );
}
