// Events: delegated camelCase `onX` and native `on:x` with typed `currentTarget` (decision-17 and its
// amendment), and the `delegatedEvents` table that both the types and the compiler use.
import type { DelegatedEventTable, DelegatedEventType } from "../../events.ts";
import type { Assert, Equal } from "./helpers.ts";

// ---- the table ----------------------------------------------------------------------------------

/** Every value is its key lowercased: `KeyDown` → `keydown`. */
export type ValuesAreLowercasedKeys = Assert<
  Equal<DelegatedEventTable, { readonly [K in keyof DelegatedEventTable]: Lowercase<K> }>
>;

/** The three lib.dom element event maps have the same events. */
export type SameEventMaps = Assert<
  Equal<keyof HTMLElementEventMap, keyof SVGElementEventMap> &
    Equal<keyof HTMLElementEventMap, keyof MathMLElementEventMap>
>;

/**
 * The table covers every element event except the deprecated `webkit*` aliases. When lib.dom adds
 * an event, this fails until it is added to `delegatedEvents` (and mirrored by the compiler).
 */
export type CoversTheEventMaps = Assert<
  Equal<
    Exclude<keyof HTMLElementEventMap, DelegatedEventType>,
    Extract<keyof HTMLElementEventMap, `webkit${string}`>
  >
>;

// ---- props --------------------------------------------------------------------------------------

const onAnyEvent = (event: Event) => event.type;

export const accepted = [
  <button
    onClick={(e) => {
      const button: HTMLButtonElement = e.currentTarget;
      const event: PointerEvent = e;
      return [button, event];
    }}
  />,
  <input
    onInput={(e) => e.currentTarget.value}
    onKeyDown={(e) => {
      const event: KeyboardEvent = e;
      const input: HTMLInputElement = e.currentTarget;
      return [event.key, input.value];
    }}
    onKeyUp={(e) => e.code}
    onBeforeInput={(e) => e.inputType}
    onFocusIn={(e) => e.relatedTarget}
    onFocusOut={(e: FocusEvent) => e.relatedTarget}
  />,
  <div
    onDblClick={(e) => e.detail}
    onContextMenu={(e) => e.pointerType}
    onMouseEnter={(e) => e.clientX}
    onMouseLeave={(e) => e.currentTarget.tagName}
    onPointerDown={(e) => {
      const event: PointerEvent = e;
      const div: HTMLDivElement = e.currentTarget;
      return [event.pointerId, div.tagName];
    }}
    onPointerMove={(e) => e.pressure}
    onAnimationEnd={(e) => e.animationName}
    onTransitionEnd={(e) => e.propertyName}
    onWheel={(e) => e.deltaY}
    onDragStart={(e) => e.dataTransfer}
    onTouchStart={(e) => e.touches.length}
    onCopy={(e) => e.clipboardData}
    onScroll={(e) => e.currentTarget.scrollTop}
  />,
  <form onSubmit={(e) => e.submitter} onFormData={(e) => e.formData} onReset={onAnyEvent} />,
  <dialog onClose={(e) => e.currentTarget.returnValue} onCancel={(e) => e.preventDefault()} />,
  <details onToggle={(e) => e.newState} onBeforeToggle={(e) => e.oldState} />,
  <video onTimeUpdate={(e) => e.currentTarget.currentTime} onLoadedMetadata={onAnyEvent} />,
  <div on:scroll={(e) => e.currentTarget.scrollTop} on:mouseenter={(e) => e.clientX} />,
  <div on:keydown={(e) => e.key} on:pointerdown={(e) => e.pointerId} />,
  <div on:my-event={(e) => e.type} />,
  <div on:my-event={(e: CustomEvent<{ id: number }>) => e.detail.id} />,
  <div on:myEvent={(e: CustomEvent<string>) => e.detail} />,
  <svg onPointerDown={(e) => e.currentTarget.viewBox}>
    <circle onClick={(e) => e.currentTarget.r} onMouseEnter={(e) => e.clientY} />
  </svg>,
  <math>
    <mi onClick={(e) => e.currentTarget.tagName} />
  </math>,
  <button onClick={onAnyEvent} on:click={onAnyEvent} />,
  <button onClick={undefined} onKeyDown={undefined} />,
];

export const rejected = [
  // @ts-expect-error wrong event type for `onClick`.
  <button onClick={(e: KeyboardEvent) => e.key} />,
  // @ts-expect-error wrong event type for `onKeyDown`.
  <input onKeyDown={(e: MouseEvent) => e.clientX} />,
  // @ts-expect-error wrong event type for `on:keydown`.
  <div on:keydown={(e: MouseEvent) => e.clientX} />,
  // @ts-expect-error `currentTarget` is the element: a div has no `value`.
  <div onInput={(e) => e.currentTarget.value} />,
  // @ts-expect-error a handler typed for another element does not fit.
  <div onClick={(e: MouseEvent & { currentTarget: HTMLInputElement }) => e.currentTarget.value} />,
  // @ts-expect-error lowercase DOM handler properties are not props.
  <button onclick={() => {}} />,
  // @ts-expect-error exact-case event names are rejected: use `onKeyDown`.
  <input onKeydown={() => {}} />,
  // @ts-expect-error exact-case event names are rejected: use `onMouseEnter`.
  <div onMouseenter={() => {}} />,
  // @ts-expect-error exact-case event names are rejected: use `onDblClick`.
  <div onDblclick={() => {}} />,
  // @ts-expect-error exact-case event names are rejected: use `onPointerDown`.
  <div onPointerdown={() => {}} />,
  // @ts-expect-error React's `onDoubleClick` does not lowercase to a DOM event: use `onDblClick`.
  <div onDoubleClick={() => {}} />,
  // @ts-expect-error React's `onChangeCapture`-style suffixes do not exist.
  <input onChangeCapture={() => {}} />,
  // @ts-expect-error deprecated `webkit*` aliases are not `onX` props: use `on:webkitanimationend`.
  <div onWebkitAnimationEnd={() => {}} />,
  // @ts-expect-error unknown delegated event.
  <div onFoo={() => {}} />,
  // @ts-expect-error SVG elements reject exact-case names too.
  <circle onKeydown={() => {}} />,
  // @ts-expect-error handlers are functions.
  <button onClick="alert(1)" />,
];
