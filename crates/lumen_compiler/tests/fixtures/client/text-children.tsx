// Text children (TASK-65): a provably text value (literals, arithmetic, templates, `String()`,
// number/string methods, or a const initialised with one) that stands alone between nodes is a
// text node of the template: bound with setText when reactive, written once otherwise; the server
// emits a `text()` hole there. Next to JSX text or another dynamic child, or when the value may
// be a node, it stays an insert.
import { signal } from "lumen";

const count = signal(0);
const items = signal([{ id: 1, price: 2.5 }]);

export function Isolated(props: { name: string }) {
  const total = count() * 2;
  const label = String(props.name);
  return (
    <div>
      <h2>Total</h2>
      {count() * 2}
      <b>static</b>
      {total}
      <i />
      {label}
      <hr />
      {`#${count()}`}
    </div>
  );
}

export function Rows() {
  return (
    <ul>
      {items().map((item) => {
        const price = item.price.toFixed(2);
        return (
          <li>
            <span>{item.id}</span>
            {price}
            <em>€</em>
          </li>
        );
      })}
    </ul>
  );
}

export function Inserts(props: { icon: unknown }) {
  return (
    <p>
      Clicked {count()} times
      <br />
      {props.icon}
      <br />
      {count()}{count() + 1}
    </p>
  );
}
