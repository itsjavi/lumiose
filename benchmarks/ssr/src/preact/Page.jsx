import { formatPrice } from "../data.ts";

function Badge(props) {
  return <span class={`badge ${props.kind}`}>{props.children}</span>;
}

function Tags(props) {
  return (
    <ul class="tags">
      {props.tags.map((tag, index) => (
        <li key={index} class="tag">
          {tag}
        </li>
      ))}
    </ul>
  );
}

function Row(props) {
  const item = props.item;
  return (
    <tr class={item.active ? "row active" : "row"} data-id={item.id}>
      <td class="id">{item.id}</td>
      <td class="label">
        <a href={item.url} title={item.label}>
          {item.label}
        </a>
        <p>{item.description}</p>
      </td>
      <td class="price">{formatPrice(item.price)}</td>
      <td class="tags">
        <Tags tags={item.tags} />
      </td>
      <td class="status">
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
    <div class="page">
      <header class="header">
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
        <table class="table">
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
      <footer class="footer">
        <Summary items={data.items} />
      </footer>
    </div>
  );
}
