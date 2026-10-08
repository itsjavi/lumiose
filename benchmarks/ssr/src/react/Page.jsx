import { formatPrice } from "../data.ts";

function Badge(props) {
  return <span className={`badge ${props.kind}`}>{props.children}</span>;
}

function Tags(props) {
  return (
    <ul className="tags">
      {props.tags.map((tag, index) => (
        <li key={index} className="tag">
          {tag}
        </li>
      ))}
    </ul>
  );
}

function Row(props) {
  const item = props.item;
  return (
    <tr className={item.active ? "row active" : "row"} data-id={item.id}>
      <td className="id">{item.id}</td>
      <td className="label">
        <a href={item.url} title={item.label}>
          {item.label}
        </a>
        <p>{item.description}</p>
      </td>
      <td className="price">{formatPrice(item.price)}</td>
      <td className="tags">
        <Tags tags={item.tags} />
      </td>
      <td className="status">
        {item.active ? <Badge kind="ok">active</Badge> : <Badge kind="off">inactive</Badge>}
      </td>
    </tr>
  );
}

function Summary(props) {
  let active = 0;
  let total = 0;
  for (const item of props.items) {
    if (item.active) active++;
    total += item.price;
  }
  return (
    <p>
      {props.items.length} items, {active} active, total {formatPrice(total)}
    </p>
  );
}

export function Page(props) {
  const data = props.data;
  return (
    <div className="page">
      <header className="header">
        <h1>{data.title}</h1>
        <nav>
          {data.links.map((link) => (
            <a key={link.href} href={link.href}>
              {link.text}
            </a>
          ))}
        </nav>
      </header>
      <main>
        <table className="table">
          <thead>
            <tr>
              <th>#</th>
              <th>Label</th>
              <th>Price</th>
              <th>Tags</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <Row key={item.id} item={item} />
            ))}
          </tbody>
        </table>
      </main>
      <footer className="footer">
        <Summary items={data.items} />
      </footer>
    </div>
  );
}
