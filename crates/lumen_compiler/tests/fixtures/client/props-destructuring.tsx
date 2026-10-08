// Reactive props destructuring: reads become props.x (defaults with undefined semantics),
// rest becomes restProps, shorthand properties expand.
export function Props({ title, count = 1, class: cls, user: { name = "anon" } = {}, ...rest }: {
  title: string;
  count?: number;
  class?: string;
  user?: { name?: string };
  [key: string]: unknown;
}) {
  const payload = () => ({ title, count });
  return (
    <section class={cls} data-name={name} {...rest}>
      <h1>{title}</h1>
      <p>{count * 2}</p>
      <button onClick={() => console.log(payload(), title)}>log</button>
    </section>
  );
}

export const Arrow = ({ label }: { label: string }) => <span>{label}</span>;

export function Conflict({ value }: { value: string }) {
  const props = { value: 1 };
  return <p title={value}>{props.value}</p>;
}

export function Reassigned({ value }: { value: string }) {
  value = value.trim();
  return <p>{value}</p>;
}

export function Plain(attrs: { value: string }) {
  return <p>{attrs.value}</p>;
}
