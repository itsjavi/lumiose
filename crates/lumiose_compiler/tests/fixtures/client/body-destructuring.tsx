// Destructuring the props object in a component body is rewritten like a destructured parameter
// (TASK-348): bindings read `props.<key>` where they are used, so `children` is created where it
// is inserted and a hydrating island claims it in order; `...rest` becomes `restProps`.
// Reassigned bindings, nested or computed reads, and destructuring in nested functions are left
// alone.
export function Trigger(props: { children?: JSX.Element; [key: string]: unknown }) {
  const { children, ...rest } = props;
  return (
    <button type="button" {...rest}>
      {children}
    </button>
  );
}

export const Label = (props: { text: string; count?: number; class?: string }) => {
  const { text, count = 1 } = props,
    plain = "x";
  const { class: cls } = props;
  return (
    <label class={cls} data-plain={plain}>
      {text} {count}
    </label>
  );
};

export function Kept(props: { user: { name: string }; value: string }) {
  let { value } = props;
  value = value.trim();
  const { name } = props.user;
  const read = () => {
    const { value: inner } = props;
    return inner;
  };
  return (
    <p title={name} data-read={read()}>
      {value}
    </p>
  );
}
