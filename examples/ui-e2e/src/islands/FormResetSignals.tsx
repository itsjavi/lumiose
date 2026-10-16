import {
  Autocomplete,
  Checkbox,
  CheckboxGroup,
  Combobox,
  Field,
  Fieldset,
  NumberField,
  OTPField,
  Radio,
  RadioGroup,
  Select,
  Slider,
  Switch,
} from "@lumiose/ui";
import { signal } from "lumiose";

/**
 * Every form control of @lumiose/ui bound to a signal in one form with a Reset button: a native
 * reset puts the controls back to their defaults, and the signals follow (TASK-435).
 */
export function FormResetSignals() {
  const name = signal("ada");
  const agree = signal(false);
  const dark = signal(true);
  const colours = signal<string[]>(["red"]);
  const size = signal("m");
  const plan = signal("free");
  const seats = signal<number | null>(2);
  const volume = signal(40);
  const fruit = signal("apple");
  const topic = signal("signals");
  const code = signal("");
  return (
    <form class="lu-fieldset" data-testid="reset-form" onSubmit={(event) => event.preventDefault()}>
      <Field.Root name="name" class="lu-field">
        <Field.Label>Name</Field.Label>
        <Field.Control class="lu-input" bind:value={name} />
      </Field.Root>
      <label>
        <Checkbox.Root name="agree" class="lu-checkbox" bind:checked={agree} /> I agree
      </label>
      <label>
        <Switch.Root name="dark" class="lu-switch" bind:checked={dark} /> Dark mode
      </label>
      <CheckboxGroup name="colours" bind:value={colours} class="lu-fieldset">
        <Fieldset.Legend>Colours</Fieldset.Legend>
        {["red", "green", "blue"].map((colour) => (
          <label>
            <Checkbox.Root value={colour} class="lu-checkbox" /> {colour}
          </label>
        ))}
      </CheckboxGroup>
      <RadioGroup name="size" bind:value={size} class="lu-fieldset">
        <Fieldset.Legend>Size</Fieldset.Legend>
        <label>
          <Radio.Root value="s" class="lu-radio" /> Small
        </label>
        <label>
          <Radio.Root value="m" class="lu-radio" /> Medium
        </label>
      </RadioGroup>
      <Field.Root name="plan" class="lu-field">
        <Field.Label>Plan</Field.Label>
        <Select.Root bind:value={plan} class="lu-select">
          <Select.Item value="free">Free</Select.Item>
          <Select.Item value="pro">Pro</Select.Item>
        </Select.Root>
      </Field.Root>
      <Field.Root name="seats" class="lu-field">
        <Field.Label>Seats</Field.Label>
        <NumberField.Root bind:value={seats} class="lu-number-field">
          <NumberField.Input />
        </NumberField.Root>
      </Field.Root>
      <Slider.Root name="volume" bind:value={volume} class="lu-slider">
        <Slider.Label>Volume</Slider.Label>
        <Slider.Control>
          <Slider.Track>
            <Slider.Indicator />
          </Slider.Track>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
      <Combobox.Root name="fruit" bind:value={fruit} class="lu-combobox">
        <Combobox.Label>Fruit</Combobox.Label>
        <Combobox.Input />
        <Combobox.List>
          <Combobox.Item value="apple">Apple</Combobox.Item>
          <Combobox.Item value="pear">Pear</Combobox.Item>
        </Combobox.List>
      </Combobox.Root>
      <Autocomplete.Root name="topic" bind:value={topic} class="lu-combobox">
        <Autocomplete.Label>Topic</Autocomplete.Label>
        <Autocomplete.Input />
      </Autocomplete.Root>
      <OTPField.Root name="code" length={4} bind:value={code} class="lu-otp-field">
        <OTPField.Input aria-label="Code" />
        <OTPField.Slot />
        <OTPField.Slot />
        <OTPField.Slot />
        <OTPField.Slot />
      </OTPField.Root>
      <button
        type="button"
        class="lu-button"
        data-testid="change-signals"
        onClick={() => {
          name.set("grace");
          agree.set(true);
          dark.set(false);
          colours.set(["green", "blue"]);
          size.set("s");
          plan.set("pro");
          seats.set(5);
          volume.set(80);
          fruit.set("pear");
          topic.set("routing");
          code.set("1234");
        }}
      >
        Change every control
      </button>
      <button type="reset" class="lu-button">
        Reset
      </button>
      <output data-testid="reset-state">
        name: {name()}, agree: {String(agree())}, dark: {String(dark())}, colours:{" "}
        {colours().join(" ") || "none"}, size: {size()}, plan: {plan()}, seats: {String(seats())},
        volume: {String(volume())}, fruit: {fruit()}, topic: {topic()}, code: {code() || "none"}
      </output>
    </form>
  );
}
