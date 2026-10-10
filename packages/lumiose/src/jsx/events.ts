// Event handler names for `onX` props (owner: Beacon). Decision-17 and its 2026-10-08 amendment.
//
// `delegatedEvents` is the single list of `onX` handler props:
// - The key is the React-style camelCase part after `on` in the prop name: `onKeyDown` → `KeyDown`.
// - The value is the DOM event type. It is always the key lowercased (`KeyDown` → `keydown`).
//
// Only these props exist. Exact-case forms such as `onKeydown`, and lowercase DOM properties such
// as `onclick`, are rejected by the JSX types. Native listeners use the exact DOM name instead
// (`on:keydown`, `on:my-event`) and are not listed here.
//
// Consumers:
// - The JSX types (`jsx-runtime.ts`) derive the `onX` props from this object, with the event type
//   taken from the element's lib.dom event map.
// - The compiler (Photon) mirrors this list. It lowercases the part after `on` to get the event
//   name and decides delegation from it. Names missing here are not `onX` events.
// - The language server and lint rules can import it to complete and check handler names.
//
// The list covers every event of lib.dom's `HTMLElementEventMap`, `SVGElementEventMap` and
// `MathMLElementEventMap` (the three are identical), except the deprecated `webkit*` aliases of
// animation and transition events. The type tests fail when lib.dom adds an event that is missing
// here.
//
// Some of these events do not bubble: `focus`, `blur`, `mouseenter`, `mouseleave`, `pointerenter`,
// `pointerleave`, `scroll`, `load`, `error` and the media events. Decision-17 leaves their handling
// to the compiler and runtime.

/** `onX` suffix → DOM event type. Grouped by kind; the order has no meaning. */
export const delegatedEvents = {
  // Mouse
  Click: "click",
  DblClick: "dblclick",
  AuxClick: "auxclick",
  ContextMenu: "contextmenu",
  MouseDown: "mousedown",
  MouseUp: "mouseup",
  MouseMove: "mousemove",
  MouseOver: "mouseover",
  MouseOut: "mouseout",
  MouseEnter: "mouseenter",
  MouseLeave: "mouseleave",
  Wheel: "wheel",

  // Pointer
  PointerDown: "pointerdown",
  PointerUp: "pointerup",
  PointerMove: "pointermove",
  PointerRawUpdate: "pointerrawupdate",
  PointerOver: "pointerover",
  PointerOut: "pointerout",
  PointerEnter: "pointerenter",
  PointerLeave: "pointerleave",
  PointerCancel: "pointercancel",
  GotPointerCapture: "gotpointercapture",
  LostPointerCapture: "lostpointercapture",

  // Touch
  TouchStart: "touchstart",
  TouchMove: "touchmove",
  TouchEnd: "touchend",
  TouchCancel: "touchcancel",

  // Keyboard
  KeyDown: "keydown",
  KeyUp: "keyup",
  KeyPress: "keypress",

  // Focus
  Focus: "focus",
  Blur: "blur",
  FocusIn: "focusin",
  FocusOut: "focusout",

  // Input and forms
  BeforeInput: "beforeinput",
  Input: "input",
  Change: "change",
  Select: "select",
  SelectStart: "selectstart",
  SelectionChange: "selectionchange",
  Invalid: "invalid",
  Submit: "submit",
  Reset: "reset",
  FormData: "formdata",

  // Composition (IME)
  CompositionStart: "compositionstart",
  CompositionUpdate: "compositionupdate",
  CompositionEnd: "compositionend",

  // Clipboard
  Copy: "copy",
  Cut: "cut",
  Paste: "paste",

  // Drag and drop
  Drag: "drag",
  DragStart: "dragstart",
  DragEnd: "dragend",
  DragEnter: "dragenter",
  DragLeave: "dragleave",
  DragOver: "dragover",
  Drop: "drop",

  // Animations and transitions
  AnimationStart: "animationstart",
  AnimationIteration: "animationiteration",
  AnimationEnd: "animationend",
  AnimationCancel: "animationcancel",
  TransitionRun: "transitionrun",
  TransitionStart: "transitionstart",
  TransitionEnd: "transitionend",
  TransitionCancel: "transitioncancel",

  // Scroll and resize
  Scroll: "scroll",
  ScrollEnd: "scrollend",
  Resize: "resize",

  // Popovers, dialogs, details and invoker commands
  BeforeToggle: "beforetoggle",
  Toggle: "toggle",
  Cancel: "cancel",
  Close: "close",
  Command: "command",
  BeforeMatch: "beforematch",

  // Loading and errors
  Load: "load",
  Error: "error",
  Abort: "abort",
  Progress: "progress",
  SecurityPolicyViolation: "securitypolicyviolation",

  // Media
  LoadStart: "loadstart",
  LoadedMetadata: "loadedmetadata",
  LoadedData: "loadeddata",
  CanPlay: "canplay",
  CanPlayThrough: "canplaythrough",
  Play: "play",
  Playing: "playing",
  Pause: "pause",
  Waiting: "waiting",
  Seeking: "seeking",
  Seeked: "seeked",
  TimeUpdate: "timeupdate",
  DurationChange: "durationchange",
  RateChange: "ratechange",
  VolumeChange: "volumechange",
  Stalled: "stalled",
  Suspend: "suspend",
  Emptied: "emptied",
  Ended: "ended",
  CueChange: "cuechange",

  // Canvas
  ContextLost: "contextlost",
  ContextRestored: "contextrestored",

  // Fullscreen
  FullscreenChange: "fullscreenchange",
  FullscreenError: "fullscreenerror",

  // Shadow DOM
  SlotChange: "slotchange",
} as const satisfies Record<string, keyof HTMLElementEventMap>;

/** The `delegatedEvents` table as a type: `{ KeyDown: "keydown", … }`. */
export type DelegatedEventTable = typeof delegatedEvents;

/** `onX` suffixes: `"Click" | "KeyDown" | …`. */
export type DelegatedEventSuffix = keyof DelegatedEventTable;

/** DOM event types with an `onX` prop: `"click" | "keydown" | …`. */
export type DelegatedEventType = DelegatedEventTable[DelegatedEventSuffix];
