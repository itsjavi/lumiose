// Row keys (TASK-553): a key may read the item's destructured bindings, the index (passed to the
// key function only when read), a nested arrow's parameters and row consts (inlined), and a
// callback with several returns keeps the key its returned elements share.
import { signal } from "lumiose";

type Entry = { key: string; index: number; row: Array<{ id: string }> };

export function RowKeys() {
  const entries = signal<Entry[]>([]);
  return (
    <div>
      {entries().map(({ row, index }) => (
        <div key={`${index}:${row.map((p) => p.id).join("|")}`}>{row.length}</div>
      ))}
      {entries().map((entry, i) => (
        <p key={`${i}:${entry.key}`}>{entry.key}</p>
      ))}
      {entries().map((entry, i) => (
        <p key={entry.key}>{i}</p>
      ))}
      {entries().map((entry) => {
        const id = entry.key;
        const same = id;
        const { index: at } = entry;
        return <b key={`${same}@${at}`}>{id}</b>;
      })}
      {entries().map((entry) => {
        if (entry.index < 0) return <s key={entry.key}>hidden</s>;
        return <u key={entry.key}>{entry.index}</u>;
      })}
    </div>
  );
}
