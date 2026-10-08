// Constant attributes before a spread of the props object or its `...rest` stay in the template
// (TASK-97): those keys are fixed, so the spread only sets what the caller passed. `class`,
// `style`, properties, events and attributes after the spread keep going through the spread, and
// so does everything when a spread may change its keys (any other object).
export function Icon({ title, ...rest }: { title?: string; [key: string]: unknown }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" focusable aria-label={title} {...rest}>
      <path d="M1 1h22" />
    </svg>
  );
}

export function Field(props: { [key: string]: unknown }) {
  return <input type="text" class="field" style="margin: 0" value="x" {...props} data-after="1" />;
}

export function Dynamic(props: { attrs: () => Record<string, string> }) {
  const attrs = props.attrs;
  return <div role="note" {...attrs()} />;
}
