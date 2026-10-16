// Slider (decision-62, TASK-372): one or more native `<input type="range">` thumbs over a shared
// track, after Base UI's Slider. The platform drags each thumb, moves it with the arrow keys,
// Home and End, follows the direction and submits it, in server HTML and without JavaScript.
// Root renders `<lu-slider>`, whose script (slider.script.ts) keeps two thumbs in order, moves the
// nearest thumb on a press on the track, adds Page Up and Page Down, and keeps `--lu-slider-start`,
// `--lu-slider-end` and the value text current. The `value` prop drives the thumbs when it changes;
// their `input` and `change` events report back through `onValueChange` and `onValueCommitted`.
import { createContext, effect, onCleanup, ref, signal, untrack, useContext, useId } from "lumiose";
import { controlId, describedBy, useField, useFormValues } from "../field/context.ts";
import { onFormReset } from "../form/reset.ts";
import { withStyle } from "../placement/placement.ts";
import { percent } from "../progress/value.ts";
import { formatValues } from "./format.ts";
import type { SliderElement } from "./slider.script.ts";
import sliderScript from "./slider.script.ts?client";

declare module "lumiose/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      /**
       * Slider's element. Attributes `large-step`, `min-steps-between-values`,
       * `thumb-collision-behavior` (`push`, `swap`, `none`), `format` (`Intl.NumberFormat` options
       * as JSON) and `locale`; property `value`.
       */
      "lu-slider": JSX.HTMLProps<SliderElement> & {
        "large-step"?: number;
        "min-steps-between-values"?: number;
        "thumb-collision-behavior"?: "push" | "swap" | "none";
        format?: string;
        locale?: string;
      };
    }
  }
}

/** A slider's value: a number, or one per thumb. */
export type SliderValue = number | number[];

/**
 * The element props Root passes to `<lu-slider>`, without the brand of intrinsic elements' props,
 * so that `bind:value` applies to Root.
 */
type ElementProps = {
  [
    K in keyof JSX.HTMLProps<SliderElement> as K extends string ? K : never
  ]: JSX.HTMLProps<SliderElement>[K];
};

/**
 * `Slider.Root` renders `<lu-slider>`, a block around the other parts. `bind:value={signal}`
 * stands in for `value` and `onValueChange`; an array (one value per thumb) makes a range slider.
 */
export interface SliderRootProps<V extends SliderValue = number> extends Omit<
  ElementProps,
  "children" | "onChange" | "onInput"
> {
  /** Moves the thumbs to this value (an array: one per thumb) when it changes. */
  value?: V;
  /** The value at first, when `value` is left out; a form reset goes back to it. Default `min`. */
  defaultValue?: V;
  /** Called with the new value as a thumb moves. */
  onValueChange?: (value: V) => void;
  /** Called with the value when a move ends: a release, a key press. */
  onValueCommitted?: (value: V) => void;
  /** The smallest value. Default `0`. */
  min?: number;
  /** The largest value. Default `100`. */
  max?: number;
  /** The step between values. Default `1`. */
  step?: number;
  /** The step of Page Up, Page Down and Shift with an arrow key. Default `10`. */
  largeStep?: number;
  /** With several thumbs: how many steps apart they stay. Default `0`. */
  minStepsBetweenValues?: number;
  /**
   * With several thumbs: a thumb moved into another pushes it along (`"push"`, default), stops at
   * it (`"none"`), or, dragged past it, swaps places with it (`"swap"`: the drag goes on with the
   * other thumb; the keys stop at it).
   */
  thumbCollisionBehavior?: "push" | "swap" | "none";
  /**
   * Where the thumbs stop at the ends: inside the control (`"edge"`, default, as native range
   * inputs do) or with their centre on its ends (`"center"`, overhanging it by half a thumb).
   * Both need `--lu-slider-thumb-size`, the thumbs' size, in your CSS (the default theme sets it).
   */
  thumbAlignment?: "edge" | "center";
  /** Left to right (and the other way right to left), or bottom to top. Default `"horizontal"`. */
  orientation?: "horizontal" | "vertical";
  /** Disables every thumb. */
  disabled?: boolean;
  /** The name the thumbs submit their values under (one entry per thumb). */
  name?: string;
  /** The id of a form the thumbs belong to, when they are outside it. */
  form?: string;
  /**
   * How the values are written: `Intl.NumberFormat` options. With it, each thumb's
   * `aria-valuetext` is its formatted value. Default: plain numbers.
   */
  format?: Intl.NumberFormatOptions;
  /** The locale of the formatted values. Default: the browser's (the server's in server HTML). */
  locale?: string;
  /** The other parts: `Label`, `Value` and the `Control` with the track and the thumbs. */
  children?: JSX.Element;
}

/** The `<label>` of the slider, for its first thumb. */
export type SliderLabelProps = JSX.IntrinsicElements["label"];

/** An `<output>` with the values as text. */
export type SliderValueProps = Omit<JSX.IntrinsicElements["output"], "children"> & {
  /** Renders the values your way, from the formatted values and the numbers. */
  children?: (formattedValues: string[], values: number[]) => JSX.Element;
};

/**
 * The `<div>` that holds the track and the thumbs, stacked; presses on it move a thumb. With two
 * thumbs or more it is a `role="group"` the Label names.
 */
export type SliderControlProps = JSX.IntrinsicElements["div"];

/** The `<div>` rail of the track. */
export type SliderTrackProps = JSX.IntrinsicElements["div"];

/** The `<div>` that fills the selected part of the track, from `--lu-slider-start` to `--lu-slider-end`. */
export type SliderIndicatorProps = JSX.IntrinsicElements["div"];

/** A thumb: a native `<input type="range">`, the next value of the slider in order. */
export type SliderThumbProps = Omit<
  JSX.IntrinsicElements["input"],
  symbol | "type" | "value" | "min" | "max" | "step" | "name" | "form"
>;

interface SliderContextValue {
  id: string;
  /** The Label's id: its own `id`, which the Control and thumbs after it point at (M39). */
  labelId: string;
  /** A thumb's id: in a Field the first one is the field's control (TASK-449 L22). */
  thumbId: (index: number) => string;
  values: () => number[];
  min: () => number;
  max: () => number;
  step: () => number;
  vertical: () => boolean;
  disabled: () => boolean;
  name: () => string | undefined;
  form: () => string | undefined;
  texts: () => string[];
  formatted: () => boolean;
  /** How many thumbs have rendered: the next thumb's index. */
  thumbs: { count: number };
  labels: { count: number };
}

const SliderContext = createContext<SliderContextValue>();

function useSlider(part: string): SliderContextValue {
  const context = useContext(SliderContext);
  if (!context) throw new Error(`Slider.${part} must be inside <Slider.Root>.`);
  return context;
}

const asList = (value: SliderValue | undefined, fallback: number): number[] =>
  value === undefined ? [fallback] : typeof value === "number" ? [value] : [...value];

function Root<V extends SliderValue = number>({
  value,
  defaultValue,
  onValueChange,
  onValueCommitted,
  min,
  max,
  step,
  largeStep,
  minStepsBetweenValues,
  thumbCollisionBehavior,
  thumbAlignment,
  orientation,
  disabled,
  name,
  form,
  format,
  locale,
  children,
  style,
  ...rest
}: SliderRootProps<V>) {
  // Thumb order, Page Up and Page Down, track presses and the value text (decision-63).
  sliderScript();
  const id = useId();
  const field = useField();
  const element = ref<SliderElement>();
  const low = () => min ?? 0;
  const high = () => max ?? 100;
  // A failed submission's values (a Form's `values`), one per thumb, replace the default (TASK-430).
  const sent = useFormValues(
    untrack(() => name ?? field?.name()),
    untrack(() => disabled),
  )
    ?.map(Number)
    .filter(Number.isFinite);
  const values = signal<number[]>(
    untrack(() => asList(value ?? (sent?.length ? sent : defaultValue), min ?? 0)),
  );
  // The `value` prop drives the thumbs when it changes.
  effect(() => {
    const next = value;
    if (next === undefined) return;
    values.set(asList(next, low()));
    const host = element();
    if (host?.isConnected) host.value = next;
  });
  const context: SliderContextValue = {
    id,
    labelId: `${id}-label`,
    thumbId: (index) => (index === 0 && field ? controlId(field) : `${id}-thumb-${index}`),
    values,
    min: low,
    max: high,
    step: () => step ?? 1,
    vertical: () => orientation === "vertical",
    disabled: () => disabled === true || field?.disabled() === true,
    name: () => name ?? field?.name(),
    form: () => form,
    texts: () => formatValues(values(), format ? JSON.stringify(format) : null, locale ?? null),
    formatted: () => format !== undefined,
    thumbs: { count: 0 },
    labels: { count: 0 },
  };
  const current = () => (element()?.value ?? values()) as V;
  // A form reset puts the thumbs back without an `input` event: it is reported (TASK-435).
  onFormReset(
    () => element()?.thumbs[0],
    current,
    (next) => {
      values.set(asList(next, low()));
      onValueChange?.(next);
    },
  );
  // The selected part of the track, in the server HTML too; the script keeps it from then on.
  const range = () => {
    const list = values();
    return {
      "--lu-slider-start": `${list.length > 1 ? percent(list[0]!, low(), high()) : 0}%`,
      "--lu-slider-end": `${percent(list.at(-1)!, low(), high())}%`,
    };
  };
  // Nothing points at the element: a caller's `id` names it (TASK-441 M39).
  return (
    <SliderContext value={context}>
      <lu-slider
        {...rest}
        ref={element}
        id={rest.id ?? id}
        data-orientation={orientation ?? "horizontal"}
        data-thumb-alignment={thumbAlignment}
        large-step={largeStep}
        min-steps-between-values={minStepsBetweenValues}
        thumb-collision-behavior={thumbCollisionBehavior}
        format={format ? JSON.stringify(format) : undefined}
        locale={locale}
        style={withStyle(style, untrack(range))}
        on:input={() => {
          const next = current();
          values.set(asList(next, low()));
          onValueChange?.(next);
        }}
        on:change={() => onValueCommitted?.(current())}
      >
        {children}
      </lu-slider>
    </SliderContext>
  );
}

function Label({ children, ...rest }: SliderLabelProps) {
  const slider = useSlider("Label");
  // A caller's `id` names it; the Control and the thumbs after it point at that (TASK-441 M39).
  if (rest.id) slider.labelId = rest.id;
  slider.labels.count++;
  return (
    <label {...rest} id={slider.labelId} for={slider.thumbId(0)}>
      {children}
    </label>
  );
}

function Value({ children, ...rest }: SliderValueProps) {
  const slider = useSlider("Value");
  // Showing the values, it is `for` the thumbs and the script keeps it current.
  const thumbs = () =>
    slider
      .values()
      .map((_, i) => slider.thumbId(i))
      .join(" ");
  return (
    // Not a live region: the thumbs announce their values (TASK-439, M31).
    <output aria-live="off" {...rest} for={children ? undefined : thumbs()}>
      {children ? children(slider.texts(), slider.values()) : slider.texts().join(" – ")}
    </output>
  );
}

function Control({ children, ...rest }: SliderControlProps) {
  const slider = useSlider("Control");
  // A range's thumbs, as one group the Label names; each thumb takes a name of its own.
  const range = untrack(() => slider.values().length > 1);
  const labelled = untrack(() => slider.labels.count > 0);
  return (
    <div
      role={range ? "group" : undefined}
      aria-labelledby={
        range && labelled && rest["aria-label"] === undefined ? slider.labelId : undefined
      }
      {...rest}
    >
      {children}
    </div>
  );
}

function Track({ children, ...rest }: SliderTrackProps) {
  useSlider("Track");
  return <div {...rest}>{children}</div>;
}

function Indicator(props: SliderIndicatorProps) {
  useSlider("Indicator");
  return <div {...props} />;
}

function Thumb(props: SliderThumbProps) {
  const slider = useSlider("Thumb");
  const field = useField();
  const index = slider.thumbs.count++;
  onCleanup(() => slider.thumbs.count--);
  const labelled = untrack(() => slider.labels.count > 0);
  return (
    <input
      aria-labelledby={labelled && props["aria-label"] === undefined ? slider.labelId : undefined}
      aria-describedby={field ? describedBy(field) : undefined}
      aria-invalid={field?.invalid() ? "true" : undefined}
      {...props}
      type="range"
      id={slider.thumbId(index)}
      min={slider.min()}
      max={slider.max()}
      step={slider.step()}
      value={slider.values()[index] ?? slider.min()}
      name={slider.name()}
      form={slider.form()}
      disabled={props.disabled || slider.disabled() || undefined}
      aria-orientation={slider.vertical() ? "vertical" : undefined}
      aria-valuetext={slider.formatted() ? slider.texts()[index] : props["aria-valuetext"]}
    />
  );
}

/**
 * A slider: one value (one thumb) or a range (two thumbs), picked by dragging or with the keys.
 * Native range inputs, so it works and submits without JavaScript. Unstyled: style the parts
 * through `class`, the thumbs' pseudo-elements, `--lu-slider-start` and `--lu-slider-end`.
 *
 * @example
 * <Slider.Root name="volume" defaultValue={40}>
 *   <Slider.Label>Volume</Slider.Label>
 *   <Slider.Control>
 *     <Slider.Track>
 *       <Slider.Indicator />
 *     </Slider.Track>
 *     <Slider.Thumb />
 *   </Slider.Control>
 * </Slider.Root>
 */
export const Slider = { Root, Label, Value, Control, Track, Indicator, Thumb };
