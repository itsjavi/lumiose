// Class passthrough (TASK-75): an element whose class value may carry `props.class` gets the
// parent's scope (`applyScope(el, props.$$scope)` / the scope attributes on the server), also when
// the class is built by a helper or a local binding. Elements that cannot carry it do not.
type Props = { variant?: "primary" | "ghost"; class?: string; label: string };

function variantClass(props: Props) {
  return ["btn", { primary: props.variant === "primary" }, props.class];
}

// `props` passed whole to a helper.
export function Helper(props: Props) {
  return <button class={variantClass(props)}>{props.label}</button>;
}

// A local closure and an alias read `props.class`.
export function Closure(props: Props) {
  const classes = () => ["btn", props.class];
  const extra = props.class;
  function wrap() {
    return ["wrap", extra];
  }
  return (
    <div class={wrap()}>
      <button class={classes()}>{props.label}</button>
      <span class={props.variant}>{props.label}</span>
    </div>
  );
}

// Destructured: the `class` prop, and the rest of the props.
export function Destructured({ class: cls, label }: Props) {
  const list = () => ["card", cls];
  return <article class={list().join(" ")}>{label}</article>;
}

export function Rest({ label, ...rest }: Props) {
  return <p class={["note", rest.class]}>{label}</p>;
}

// A computed key on props may read `class`.
export function Computed(props: Props & { key: "class" | "label" }) {
  return <em class={props[props.key]}>{props.label}</em>;
}

// No flow: only other props reach the class.
export function Other(props: Props) {
  const tone = () => props.variant ?? "ghost";
  return <i class={`tone-${tone()}`}>{props.label}</i>;
}
