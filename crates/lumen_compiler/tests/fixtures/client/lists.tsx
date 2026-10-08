// .map() → keyed list: key from the root's key prop, index accessor only when used, selector
// hoisting for both operand orders and !==, block-bodied callbacks, nested lists.
import { signal } from "lumen";
import { Row } from "./Row.stsx";

type Item = { id: number; name: string; tags: string[] };

export function Lists(props: { items: Item[]; selectedId: number }) {
  const items = signal<Item[]>([]);
  const active = signal(0);
  return (
    <div>
      <ul>
        {items().map((item, i) => (
          <li key={item.id} class={{ active: active() === item.id, first: i === 0 }}>
            {i + 1}. {item.name}
          </li>
        ))}
      </ul>
      <ol>
        {items().map((item, unused) => (
          <li class={item.id !== active() ? "off" : "on"}>{item.name}</li>
        ))}
      </ol>
      <ol>
        {props.items.map(function (item) {
          const label = item.name.toUpperCase();
          return <li key={item.id} data-selected={props.selectedId === item.id}>{label}</li>;
        })}
      </ol>
      <table>
        {items()?.map((row) => (
          <tr>
            {row.tags.map((tag) => <td>{tag}</td>)}
          </tr>
        ))}
      </table>
      <p>{items().map((item) => item.name).join(", ")}</p>
      {items().map((item) => <Row key={item.id} item={item} />)}
      {items().map((item) => (active() > 0 ? <b>{item.name}</b> : <i>-</i>))}
      {items().map((item, i) => <><dt>{item.name}</dt><dd>{i}</dd></>)}
    </div>
  );
}
