// An element without content of its own renders the `children` of its spreads and `children`
// attribute, as in React and Solid (TASK-347): the last source that has `children` wins, written
// content wins over all of them. Spreads alone insert `children` only when their props object has
// the key, so content that scripts or the browser own stays when they have none. Void, raw-text
// and form-value elements never render them.
export function Button(props: { children?: JSX.Element; [key: string]: unknown }) {
  return <button {...props} />;
}

export function Empty(props: { children?: JSX.Element; [key: string]: unknown }) {
  return (
    <div {...props}>
      {/* only a comment */}
    </div>
  );
}

export function Rest({ title, ...rest }: { title: string; [key: string]: unknown }) {
  return <span title={title} {...rest} />;
}

export function Merged(props: { a: object; b: object; label: string }) {
  return (
    <section>
      <p {...props.a} {...props.b} />
      <p {...props.a} children={props.label} />
      <p children={props.label} {...props.b} />
      <p children="text" />
    </section>
  );
}

export function Written(props: { children?: JSX.Element; [key: string]: unknown }) {
  return (
    <div>
      <p {...props}>own</p>
      <p children="ignored">own</p>
      <input {...props} />
      <textarea {...props} />
    </div>
  );
}
