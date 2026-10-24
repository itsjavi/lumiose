// Keyed rows (TASK-554, decision-83): the client's row callback gets the row, whose `v` reads its
// current item, so reads of the item (`item.v`) and of a destructured item's bindings
// (`_item.v.name`) are live, like props. Data-slot handlers get the row; a component prop becomes
// a getter. Setup reads that the JSX uses are LUM2001, an early return on the item is LUM2003 (a
// warning), and copies of the key itself are neither. A pattern with a rest element is read once
// (LUM2001). A render that reads no item takes no parameter. Unkeyed lists are unchanged.
import { signal } from "lumiose";
import { Card } from "./Card.tsx";

type Item = { id: number; name: string; done: boolean; tags: string[]; label: () => string };
const format = (s: string) => s.toUpperCase();
const selected = signal(0);
const select = (id: number) => selected.set(id);

export function KeyedRows() {
  const items = signal<Item[]>([]);
  return (
    <div>
      <ul>
        {items().map((item) => (
          <li
            key={item.id}
            class={{ on: selected() === item.id, done: item.done }}
            onClick={() => select(item.id)}
          >
            {item.name}
            {item.label()}
            <Card item={item} />
            {item.tags.map((tag) => (
              <b key={tag}>{tag}</b>
            ))}
          </li>
        ))}
      </ul>
      <ol>
        {items().map(({ id, name, tags: [first = "none"] }, i) => (
          <li key={id}>
            {name}
            {first}
            {i}
          </li>
        ))}
      </ol>
      <p>
        {items().map((item) => {
          const id = item.id;
          const name = item.name;
          const upper = format(item.name);
          const local = signal(item.done);
          if (item.done) return <s key={item.id}>{id}</s>;
          return (
            <i key={item.id}>
              {id}
              {name}
              {upper}
              {local()}
            </i>
          );
        })}
      </p>
      <section>
        {items().map(({ id, ...rest }) => (
          <Card key={id} {...rest} />
        ))}
      </section>
      <nav>
        {items().map((item) => (
          <a key={item.id}>static</a>
        ))}
      </nav>
      <aside>
        {items().map((item) => (
          <a>{item.name}</a>
        ))}
      </aside>
    </div>
  );
}
