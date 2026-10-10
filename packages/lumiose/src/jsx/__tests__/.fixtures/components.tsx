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

class Point {
  x = 0;
  y = 0;
  length() {
    return Math.hypot(this.x, this.y);
  }
}

interface Book {
  title: string;
  tags: readonly string[];
  published?: Date;
}

/** An island whose props mix data, slots and callbacks (TASK-119, LUM4002 at check time). */
function Widget(props: {
  book?: Book;
  books?: Book[];
  pair?: [string, number];
  url?: URL;
  big?: bigint;
  meta?: Map<string, Set<number>>;
  icon?: JSX.Element;
  children?: JSX.Element;
  anything?: unknown;
  onDone?: () => void;
  point?: Point;
  id?: symbol;
  later?: Promise<string>;
  nested?: { save: (text: string) => void };
}) {
  props.onDone?.();
  return <div>{props.icon}</div>;
}

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
  <Widget onDone={() => {}} point={new Point()} />,
  <Widget
    client:load
    book={{ title: "T", tags: ["a"], published: new Date() }}
    books={[]}
    pair={["a", 1]}
    url={new URL("https://example.com")}
    big={1n}
    meta={new Map([["a", new Set([1])]])}
    icon={<svg />}
    anything={{ a: 1 }}
  >
    <p>slot</p>
  </Widget>,
  <Widget client:idle onDone={undefined} />,
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
  // @ts-expect-error LUM4002: a function prop on an island.
  <Widget client:load onDone={() => {}} />,
  // @ts-expect-error LUM4002: under any directive.
  <Widget client:visible="200px" onDone={() => {}} />,
  // @ts-expect-error LUM4002: a class instance (it has methods).
  <Widget client:only point={new Point()} />,
  // @ts-expect-error LUM4002: a symbol.
  <Widget client:idle id={Symbol()} />,
  // @ts-expect-error LUM4002: a promise.
  <Widget client:load later={Promise.resolve("x")} />,
  // @ts-expect-error LUM4002: a nested function.
  <Widget client:load nested={{ save: () => {} }} />,
  // @ts-expect-error generic props are inferred and checked.
  <List items={[1, 2]} render={(n: string) => n} />,
];
