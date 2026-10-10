// Templates: static attributes and their quoting, entities, void elements, trailing closing tags,
// raw-text elements and JSX whitespace rules.
export function Static() {
  return (
    <div id="main" class="a b" data-x='say "hi"' title="&lt;tag&gt; &amp; co" hidden tabindex={0} draggable="true">
      <img src="/logo.png" alt="" />
      <br />
      <p>
        Multi-line
        text   with    spaces
      </p>
      <span>{"  literal  "}{42}{true}{null}{undefined}</span>
      a{" "}b{/* comment */}c
      <textarea>{"keep"}</textarea>
      <label for="x" aria-hidden={false} spellcheck={true}>Label</label>
      <em>Don't &copy; `tick` ${"{x}"} \back</em>
    </div>
  );
}

export const Empty = () => <div />;

export function Table(props: { cell: string }) {
  return (
    <table>
      <caption>Implicit tbody</caption>
      <tr><td>{props.cell}</td></tr>
      <tr><td>static</td></tr>
    </table>
  );
}

export const Pre = () => <pre>{"\nkeeps the leading newline"}</pre>;

export function Nested() {
  return (
    <ul>
      <li>
        <a href="/a">A</a>
      </li>
      <li>
        <a href="/b">B</a>
      </li>
    </ul>
  );
}
