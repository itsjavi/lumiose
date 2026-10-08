// Events: delegated `onX` and native `on:x` with typed `currentTarget` (decision-17).
const onAnyEvent = (event: Event) => event.type;

export const accepted = [
  <button
    onClick={(e) => {
      const button: HTMLButtonElement = e.currentTarget;
      const event: MouseEvent = e;
      return [button, event];
    }}
  />,
  <input onInput={(e) => e.currentTarget.value} onKeydown={(e) => e.key} />,
  <div on:scroll={(e) => e.currentTarget.scrollTop} on:mouseenter={(e) => e.clientX} />,
  <div on:my-event={(e) => e.type} />,
  <div on:my-event={(e: CustomEvent<{ id: number }>) => e.detail.id} />,
  <svg>
    <circle onClick={(e) => e.currentTarget.r} />
  </svg>,
  <button onClick={onAnyEvent} on:click={onAnyEvent} />,
  <button onClick={undefined} />,
];

export const rejected = [
  // @ts-expect-error wrong event type for `onClick`.
  <button onClick={(e: KeyboardEvent) => e.key} />,
  // @ts-expect-error wrong event type for `on:keydown`.
  <div on:keydown={(e: MouseEvent) => e.clientX} />,
  // @ts-expect-error `currentTarget` is the element: a div has no `value`.
  <div onInput={(e) => e.currentTarget.value} />,
  // @ts-expect-error a handler typed for another element does not fit.
  <div onClick={(e: MouseEvent & { currentTarget: HTMLInputElement }) => e.currentTarget.value} />,
  // @ts-expect-error lowercase DOM handler properties are not props.
  <button onclick={() => {}} />,
  // @ts-expect-error event props are `on` + the capitalised DOM event type (`onKeydown`).
  <input onKeyDown={() => {}} />,
  // @ts-expect-error unknown delegated event.
  <div onFoo={() => {}} />,
  // @ts-expect-error handlers are functions.
  <button onClick="alert(1)" />,
];
