// Components: sync and async, children, key, `client:*` directives (decisions 9, 13).
function Card(props: { title: string; children?: JSX.Element }) {
  return (
    <section>
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}

async function Profile(props: { id: string }) {
  const user = await Promise.resolve({ name: props.id });
  return <p>{user.name}</p>;
}

function Counter(props: { initial?: number }) {
  return <button>{props.initial}</button>;
}

const Empty = () => null;

function List<T>(props: { items: readonly T[]; render: (item: T) => JSX.Element }) {
  return <ul>{props.items.map(props.render)}</ul>;
}

function NotRenderable() {
  return { a: 1 };
}

async function AsyncNotRenderable() {
  return new Map();
}

export const accepted = [
  <Card title="Hi">body</Card>,
  <Card title="Hi" key="k">
    <p>a</p>
    <p>b</p>
  </Card>,
  <Profile id="1" />,
  <Counter client:load />,
  <Counter client:idle />,
  <Counter client:visible />,
  <Counter client:visible="200px" />,
  <Counter client:media="(max-width: 600px)" />,
  <Counter client:only initial={1} />,
  <Profile id="1" client:load />,
  <Empty />,
  <List items={[1, 2]} render={(n) => <li>{n.toFixed()}</li>} />,
];

export const rejected = [
  // @ts-expect-error client:media needs a media query string.
  <Counter client:media />,
  // @ts-expect-error client:visible takes a root margin string, not a number.
  <Counter client:visible={200} />,
  // @ts-expect-error unknown client directive.
  <Counter client:never />,
  // @ts-expect-error missing required prop.
  <Profile />,
  // @ts-expect-error components must return renderable output.
  <NotRenderable />,
  // @ts-expect-error async components must resolve to renderable output.
  <AsyncNotRenderable />,
  // @ts-expect-error children must be renderable.
  <Card title="x">{{ a: 1 }}</Card>,
  // @ts-expect-error generic props are inferred and checked.
  <List items={[1, 2]} render={(n: string) => n} />,
];
