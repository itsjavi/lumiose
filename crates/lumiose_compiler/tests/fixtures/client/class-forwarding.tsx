// Class forwarding (TASK-92): a component that passes its own `class` prop on to a child forwards
// its caller's scope with it. `$$scope` is the component's own tokens plus `props.$$scope`, or
// only `props.$$scope` when the component has no styles.
type Props = { class?: string; label: string };

function Inner(props: Props) {
  return <span class={props.class}>{props.label}</span>;
}

// Styled: its own tokens plus the caller's.
export function Middle(props: Props) {
  return (
    <div>
      <Inner class={["middle", props.class]} label={props.label} />
      <style>.middle { color: teal; }</style>
    </div>
  );
}

// Unstyled and destructured: only the caller's.
export function Plain({ class: cls, label }: Props) {
  return <Inner class={cls} label={label} />;
}

// A class that is not the component's own carries only the own tokens.
export function Own(props: Props) {
  return (
    <section>
      <Inner class="own" label={props.label} />
      <style>.own { margin: 0; }</style>
    </section>
  );
}

export function Outer() {
  return (
    <main>
      <Middle class="cta" label="a" />
      <Plain class="cta" label="b" />
      <style>.cta { font-weight: bold; }</style>
    </main>
  );
}
