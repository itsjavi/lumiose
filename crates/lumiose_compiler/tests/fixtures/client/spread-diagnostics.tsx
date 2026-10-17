// The reactivity diagnostics see spreads (TASK-466): a stale derived value that reaches JSX only
// through a spread reports LUM2001, on elements and components, and the `children` an element's
// props spread inserts (TASK-347) counts for LUM2005. A rest without `children`, written content
// and a later `children` attribute insert none.
function Card(props: { title?: string }) {
  return <h2>{props.title}</h2>;
}

export function Stale(props: { color: string; label: string }) {
  const attrs = { title: props.label, style: `color: ${props.color}` };
  const extra = { title: props.label };
  return (
    <div {...attrs}>
      <Card {...extra} />
    </div>
  );
}

export function Live(props: { label: string }) {
  const attrs = () => ({ title: props.label });
  return <div {...attrs()} />;
}

export function Twice(props: { children?: JSX.Element; [key: string]: unknown }) {
  return (
    <section>
      <div {...props} />
      {props.children}
    </section>
  );
}

export function Once({ children, ...rest }: { children?: JSX.Element; [key: string]: unknown }) {
  return (
    <section>
      <div {...rest} />
      {children}
    </section>
  );
}

export function Kept(props: { children?: JSX.Element; [key: string]: unknown }) {
  return (
    <section>
      <div {...props}>own</div>
      <p {...props} children="text" />
      <input {...props} />
      {props.children}
    </section>
  );
}
