// Parentless branch and list values (TASK-50): reactive conditionals and .map() in component
// children, fragments, branch arms and returned rows compile to branchValue/listValue (the server's
// branch/list); other props and plain functions keep their values.
import { signal } from "lumen";
import { Card } from "./Card.stsx";

export function Values(props: { items: { id: number; name: string }[]; mode: string }) {
  const open = signal(false);
  const items = signal<{ id: number; name: string }[]>([]);
  return (
    <div>
      <Card>{open() ? <p>Open</p> : <p>Closed</p>}</Card>
      <Card>{open() && <span>Visible</span>}</Card>
      <Card>{items().map((item) => <li>{item.name}</li>)}</Card>
      <Card>
        <h2>Title</h2>
        {items().map((item, i) => <li key={item.id}>{i}: {item.name}</li>)}
      </Card>
      <Card title={open() ? <b>T</b> : null} />
      {open() ? items().map((item) => <i>{item.name}</i>) : <p>None</p>}
    </div>
  );
}

export function Frag() {
  const open = signal(false);
  const items = signal<string[]>([]);
  return (
    <>
      {open() ? <p>Open</p> : <p>Closed</p>}
      {items().map((name) => <li>{name}</li>)}
      <span>end</span>
    </>
  );
}

export function Rows() {
  const items = signal<string[]>([]);
  return <ul>{items().map((name) => (name.length > 3 ? <b>{name}</b> : <i>{name}</i>))}</ul>;
}

export function Plain(props: { list: string[] }) {
  return props.list.map((name) => <li>{name}</li>);
}
