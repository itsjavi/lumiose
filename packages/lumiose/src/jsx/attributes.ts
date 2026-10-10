// HTML, SVG and MathML attribute catalogs for `lumiose/jsx-runtime` (owner: Beacon). Spec §4.5, §4.7.
// Type-only. Names are HTML attribute names (`tabindex`, `for`, `http-equiv`), not DOM property names:
// Lumiose writes attributes like the HTML it renders. Lumiose props (class, style, events, ref, bind:*, …)
// live in jsx-runtime.ts; this file only lists standard attributes.

/** Enumerated attributes whose value is the string "true"/"false" (`draggable`, `spellcheck`). */
export type Booleanish = boolean | "true" | "false";
type Numeric = number | string;
type CrossOrigin = boolean | "" | "anonymous" | "use-credentials";
type ReferrerPolicy =
  | ""
  | "no-referrer"
  | "no-referrer-when-downgrade"
  | "origin"
  | "origin-when-cross-origin"
  | "same-origin"
  | "strict-origin"
  | "strict-origin-when-cross-origin"
  | "unsafe-url";
type Target = "_self" | "_blank" | "_parent" | "_top" | (string & {});
type FetchPriority = "high" | "low" | "auto";
type Loading = "eager" | "lazy";
type FormMethod = "get" | "post" | "dialog";
type FormEnctype = "application/x-www-form-urlencoded" | "multipart/form-data" | "text/plain";
type PopoverTargetAction = "toggle" | "show" | "hide";
type InputType =
  | "button"
  | "checkbox"
  | "color"
  | "date"
  | "datetime-local"
  | "email"
  | "file"
  | "hidden"
  | "image"
  | "month"
  | "number"
  | "password"
  | "radio"
  | "range"
  | "reset"
  | "search"
  | "submit"
  | "tel"
  | "text"
  | "time"
  | "url"
  | "week";

/** Global HTML attributes (valid on every HTML element), plus `aria-*` and `data-*`. */
export interface GlobalHTMLAttributes {
  accesskey?: string;
  autocapitalize?: "off" | "none" | "on" | "sentences" | "words" | "characters";
  autocorrect?: "on" | "off";
  autofocus?: boolean;
  contenteditable?: Booleanish | "plaintext-only" | "inherit";
  dir?: "ltr" | "rtl" | "auto";
  draggable?: Booleanish;
  enterkeyhint?: "enter" | "done" | "go" | "next" | "previous" | "search" | "send";
  exportparts?: string;
  hidden?: boolean | "hidden" | "until-found";
  id?: string;
  inert?: boolean;
  inputmode?: "none" | "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
  is?: string;
  itemid?: string;
  itemprop?: string;
  itemref?: string;
  itemscope?: boolean;
  itemtype?: string;
  lang?: string;
  nonce?: string;
  part?: string;
  popover?: boolean | "" | "auto" | "manual" | "hint";
  role?: string;
  slot?: string;
  spellcheck?: Booleanish;
  tabindex?: Numeric;
  title?: string;
  translate?: "yes" | "no";
  writingsuggestions?: Booleanish;
  [aria: `aria-${string}`]: string | number | boolean | undefined;
  [data: `data-${string}`]: string | number | boolean | undefined;
}

interface AnchorAttributes {
  download?: boolean | string;
  href?: string;
  hreflang?: string;
  ping?: string;
  referrerpolicy?: ReferrerPolicy;
  rel?: string;
  target?: Target;
  type?: string;
}

interface AreaAttributes extends AnchorAttributes {
  alt?: string;
  coords?: string;
  shape?: "rect" | "circle" | "poly" | "default";
}

interface MediaAttributes {
  autoplay?: boolean;
  controls?: boolean;
  controlslist?: string;
  crossorigin?: CrossOrigin;
  disableremoteplayback?: boolean;
  loop?: boolean;
  muted?: boolean;
  preload?: "" | "none" | "metadata" | "auto";
  src?: string;
}

interface VideoAttributes extends MediaAttributes {
  disablepictureinpicture?: boolean;
  height?: Numeric;
  playsinline?: boolean;
  poster?: string;
  width?: Numeric;
}

interface BaseAttributes {
  href?: string;
  target?: Target;
}

interface CiteAttributes {
  cite?: string;
}

interface EditAttributes extends CiteAttributes {
  datetime?: string;
}

interface FormControlAttributes {
  disabled?: boolean;
  form?: string;
  name?: string;
}

interface FormSubmitterAttributes {
  formaction?: string;
  formenctype?: FormEnctype;
  formmethod?: FormMethod;
  formnovalidate?: boolean;
  formtarget?: Target;
  popovertarget?: string;
  popovertargetaction?: PopoverTargetAction;
}

interface ButtonAttributes extends FormControlAttributes, FormSubmitterAttributes {
  command?: string;
  commandfor?: string;
  type?: "submit" | "reset" | "button";
  value?: Numeric;
}

interface SizeAttributes {
  height?: Numeric;
  width?: Numeric;
}

interface ColAttributes {
  span?: Numeric;
}

interface DataAttributes {
  value?: Numeric;
}

interface DetailsAttributes {
  name?: string;
  open?: boolean;
}

interface DialogAttributes {
  closedby?: "any" | "closerequest" | "none";
  open?: boolean;
}

interface EmbedAttributes extends SizeAttributes {
  src?: string;
  type?: string;
}

interface FormAttributes {
  "accept-charset"?: string;
  action?: string;
  autocomplete?: "on" | "off";
  enctype?: FormEnctype;
  method?: FormMethod;
  name?: string;
  novalidate?: boolean;
  rel?: string;
  target?: Target;
}

interface IframeAttributes extends SizeAttributes {
  allow?: string;
  allowfullscreen?: boolean;
  loading?: Loading;
  name?: string;
  referrerpolicy?: ReferrerPolicy;
  sandbox?: string;
  src?: string;
  srcdoc?: string;
}

interface ImgAttributes extends SizeAttributes {
  alt?: string;
  crossorigin?: CrossOrigin;
  decoding?: "sync" | "async" | "auto";
  fetchpriority?: FetchPriority;
  ismap?: boolean;
  loading?: Loading;
  referrerpolicy?: ReferrerPolicy;
  sizes?: string;
  src?: string;
  srcset?: string;
  usemap?: string;
}

interface InputAttributes extends FormControlAttributes, FormSubmitterAttributes, SizeAttributes {
  accept?: string;
  alt?: string;
  autocomplete?: string;
  capture?: boolean | "user" | "environment";
  checked?: boolean;
  dirname?: string;
  list?: string;
  max?: Numeric;
  maxlength?: Numeric;
  min?: Numeric;
  minlength?: Numeric;
  multiple?: boolean;
  pattern?: string;
  placeholder?: string;
  readonly?: boolean;
  required?: boolean;
  size?: Numeric;
  src?: string;
  step?: Numeric;
  type?: InputType;
  value?: Numeric;
}

interface LabelAttributes {
  for?: string;
}

interface LiAttributes {
  value?: Numeric;
}

interface LinkAttributes {
  as?:
    | "audio"
    | "document"
    | "embed"
    | "fetch"
    | "font"
    | "image"
    | "object"
    | "script"
    | "style"
    | "track"
    | "video"
    | "worker";
  blocking?: string;
  crossorigin?: CrossOrigin;
  disabled?: boolean;
  fetchpriority?: FetchPriority;
  href?: string;
  hreflang?: string;
  imagesizes?: string;
  imagesrcset?: string;
  integrity?: string;
  media?: string;
  referrerpolicy?: ReferrerPolicy;
  rel?: string;
  sizes?: string;
  type?: string;
}

interface MapAttributes {
  name?: string;
}

interface MetaAttributes {
  charset?: string;
  content?: string;
  "http-equiv"?: string;
  media?: string;
  name?: string;
}

interface MeterAttributes {
  high?: Numeric;
  low?: Numeric;
  max?: Numeric;
  min?: Numeric;
  optimum?: Numeric;
  value?: Numeric;
}

interface ObjectAttributes extends SizeAttributes {
  data?: string;
  form?: string;
  name?: string;
  type?: string;
}

interface OlAttributes {
  reversed?: boolean;
  start?: Numeric;
  type?: "1" | "a" | "A" | "i" | "I";
}

interface OptgroupAttributes {
  disabled?: boolean;
  label?: string;
}

interface OptionAttributes {
  disabled?: boolean;
  label?: string;
  selected?: boolean;
  value?: Numeric;
}

interface OutputAttributes {
  for?: string;
  form?: string;
  name?: string;
}

interface ProgressAttributes {
  max?: Numeric;
  value?: Numeric;
}

interface ScriptAttributes {
  async?: boolean;
  blocking?: string;
  crossorigin?: CrossOrigin;
  defer?: boolean;
  fetchpriority?: FetchPriority;
  integrity?: string;
  nomodule?: boolean;
  referrerpolicy?: ReferrerPolicy;
  src?: string;
  type?: string;
}

interface SelectAttributes extends FormControlAttributes {
  autocomplete?: string;
  multiple?: boolean;
  required?: boolean;
  size?: Numeric;
  value?: Numeric;
}

interface SlotAttributes {
  name?: string;
}

interface SourceAttributes extends SizeAttributes {
  media?: string;
  sizes?: string;
  src?: string;
  srcset?: string;
  type?: string;
}

interface TableCellAttributes {
  colspan?: Numeric;
  headers?: string;
  rowspan?: Numeric;
}

interface ThAttributes extends TableCellAttributes {
  abbr?: string;
  scope?: "row" | "col" | "rowgroup" | "colgroup";
}

interface TemplateAttributes {
  shadowrootclonable?: boolean;
  shadowrootdelegatesfocus?: boolean;
  shadowrootmode?: "open" | "closed";
  shadowrootserializable?: boolean;
}

interface TextareaAttributes extends FormControlAttributes {
  autocomplete?: string;
  cols?: Numeric;
  dirname?: string;
  maxlength?: Numeric;
  minlength?: Numeric;
  placeholder?: string;
  readonly?: boolean;
  required?: boolean;
  rows?: Numeric;
  value?: Numeric;
  wrap?: "hard" | "soft" | "off";
}

interface TimeAttributes {
  datetime?: string;
}

interface TrackAttributes {
  default?: boolean;
  kind?: "subtitles" | "captions" | "descriptions" | "chapters" | "metadata";
  label?: string;
  src?: string;
  srclang?: string;
}

/**
 * Element-specific HTML attributes by tag. Tags not listed here only take the global attributes.
 * Keys must be tags of `HTMLElementTagNameMap`.
 */
export interface HTMLAttributeMap {
  a: AnchorAttributes;
  area: AreaAttributes;
  audio: MediaAttributes;
  base: BaseAttributes;
  blockquote: CiteAttributes;
  button: ButtonAttributes;
  canvas: SizeAttributes;
  col: ColAttributes;
  colgroup: ColAttributes;
  data: DataAttributes;
  del: EditAttributes;
  details: DetailsAttributes;
  dialog: DialogAttributes;
  embed: EmbedAttributes;
  fieldset: FormControlAttributes;
  form: FormAttributes;
  iframe: IframeAttributes;
  img: ImgAttributes;
  input: InputAttributes;
  ins: EditAttributes;
  label: LabelAttributes;
  li: LiAttributes;
  link: LinkAttributes;
  map: MapAttributes;
  meta: MetaAttributes;
  meter: MeterAttributes;
  object: ObjectAttributes;
  ol: OlAttributes;
  optgroup: OptgroupAttributes;
  option: OptionAttributes;
  output: OutputAttributes;
  progress: ProgressAttributes;
  q: CiteAttributes;
  script: ScriptAttributes;
  select: SelectAttributes;
  slot: SlotAttributes;
  source: SourceAttributes;
  td: TableCellAttributes;
  template: TemplateAttributes;
  textarea: TextareaAttributes;
  th: ThAttributes;
  time: TimeAttributes;
  track: TrackAttributes;
  video: VideoAttributes;
}

/**
 * SVG attributes, shared by every SVG element: core, presentation (kebab-case, as in SVG markup),
 * geometry, linking, gradients/patterns, markers, filters and animation. Names are case-sensitive.
 */
export interface SVGAttributes {
  // Core
  id?: string;
  lang?: string;
  tabindex?: Numeric;
  xmlns?: string;
  "xmlns:xlink"?: string;
  "xml:lang"?: string;
  "xml:space"?: "default" | "preserve";
  role?: string;
  [aria: `aria-${string}`]: string | number | boolean | undefined;
  [data: `data-${string}`]: string | number | boolean | undefined;
  // Presentation
  "alignment-baseline"?: string;
  "baseline-shift"?: Numeric;
  "clip-path"?: string;
  "clip-rule"?: "nonzero" | "evenodd" | "inherit";
  color?: string;
  "color-interpolation"?: string;
  "color-interpolation-filters"?: "auto" | "sRGB" | "linearRGB" | "inherit";
  cursor?: string;
  direction?: "ltr" | "rtl";
  display?: string;
  "dominant-baseline"?: string;
  fill?: string;
  "fill-opacity"?: Numeric;
  "fill-rule"?: "nonzero" | "evenodd" | "inherit";
  filter?: string;
  "flood-color"?: string;
  "flood-opacity"?: Numeric;
  "font-family"?: string;
  "font-size"?: Numeric;
  "font-size-adjust"?: Numeric;
  "font-stretch"?: string;
  "font-style"?: string;
  "font-variant"?: string;
  "font-weight"?: Numeric;
  "image-rendering"?: string;
  "letter-spacing"?: Numeric;
  "lighting-color"?: string;
  "marker-end"?: string;
  "marker-mid"?: string;
  "marker-start"?: string;
  mask?: string;
  opacity?: Numeric;
  overflow?: string;
  "paint-order"?: string;
  "pointer-events"?: string;
  "shape-rendering"?: string;
  "stop-color"?: string;
  "stop-opacity"?: Numeric;
  stroke?: string;
  "stroke-dasharray"?: Numeric;
  "stroke-dashoffset"?: Numeric;
  "stroke-linecap"?: "butt" | "round" | "square" | "inherit";
  "stroke-linejoin"?: "arcs" | "bevel" | "miter" | "miter-clip" | "round" | "inherit";
  "stroke-miterlimit"?: Numeric;
  "stroke-opacity"?: Numeric;
  "stroke-width"?: Numeric;
  "text-anchor"?: "start" | "middle" | "end" | "inherit";
  "text-decoration"?: string;
  "text-rendering"?: string;
  transform?: string;
  "transform-origin"?: string;
  "unicode-bidi"?: string;
  "vector-effect"?: string;
  visibility?: string;
  "word-spacing"?: Numeric;
  "writing-mode"?: string;
  // Geometry and layout
  cx?: Numeric;
  cy?: Numeric;
  d?: string;
  dx?: Numeric;
  dy?: Numeric;
  fr?: Numeric;
  fx?: Numeric;
  fy?: Numeric;
  height?: Numeric;
  pathLength?: Numeric;
  points?: string;
  preserveAspectRatio?: string;
  r?: Numeric;
  rx?: Numeric;
  ry?: Numeric;
  viewBox?: string;
  width?: Numeric;
  x?: Numeric;
  x1?: Numeric;
  x2?: Numeric;
  y?: Numeric;
  y1?: Numeric;
  y2?: Numeric;
  // Linking and conditional processing
  href?: string;
  "xlink:href"?: string;
  target?: Target;
  requiredExtensions?: string;
  systemLanguage?: string;
  // Text
  lengthAdjust?: "spacing" | "spacingAndGlyphs";
  method?: "align" | "stretch";
  rotate?: Numeric;
  side?: "left" | "right";
  spacing?: "auto" | "exact";
  startOffset?: Numeric;
  textLength?: Numeric;
  // Gradients, patterns, clipping, masking, markers
  clipPathUnits?: "userSpaceOnUse" | "objectBoundingBox";
  gradientTransform?: string;
  gradientUnits?: "userSpaceOnUse" | "objectBoundingBox";
  markerHeight?: Numeric;
  markerUnits?: "strokeWidth" | "userSpaceOnUse";
  markerWidth?: Numeric;
  maskContentUnits?: "userSpaceOnUse" | "objectBoundingBox";
  maskUnits?: "userSpaceOnUse" | "objectBoundingBox";
  offset?: Numeric;
  orient?: Numeric;
  patternContentUnits?: "userSpaceOnUse" | "objectBoundingBox";
  patternTransform?: string;
  patternUnits?: "userSpaceOnUse" | "objectBoundingBox";
  refX?: Numeric;
  refY?: Numeric;
  spreadMethod?: "pad" | "reflect" | "repeat";
  // Filters
  amplitude?: Numeric;
  azimuth?: Numeric;
  baseFrequency?: Numeric;
  bias?: Numeric;
  diffuseConstant?: Numeric;
  divisor?: Numeric;
  edgeMode?: "duplicate" | "wrap" | "none";
  elevation?: Numeric;
  exponent?: Numeric;
  filterUnits?: "userSpaceOnUse" | "objectBoundingBox";
  in?: string;
  in2?: string;
  intercept?: Numeric;
  k1?: Numeric;
  k2?: Numeric;
  k3?: Numeric;
  k4?: Numeric;
  kernelMatrix?: string;
  kernelUnitLength?: Numeric;
  limitingConeAngle?: Numeric;
  mode?: string;
  numOctaves?: Numeric;
  operator?: string;
  order?: Numeric;
  pointsAtX?: Numeric;
  pointsAtY?: Numeric;
  pointsAtZ?: Numeric;
  preserveAlpha?: Booleanish;
  primitiveUnits?: "userSpaceOnUse" | "objectBoundingBox";
  radius?: Numeric;
  result?: string;
  scale?: Numeric;
  seed?: Numeric;
  slope?: Numeric;
  specularConstant?: Numeric;
  specularExponent?: Numeric;
  stdDeviation?: Numeric;
  stitchTiles?: "stitch" | "noStitch";
  surfaceScale?: Numeric;
  tableValues?: string;
  targetX?: Numeric;
  targetY?: Numeric;
  type?: string;
  values?: string;
  xChannelSelector?: "R" | "G" | "B" | "A";
  yChannelSelector?: "R" | "G" | "B" | "A";
  z?: Numeric;
  // Animation
  accumulate?: "none" | "sum";
  additive?: "replace" | "sum";
  attributeName?: string;
  begin?: string;
  by?: Numeric;
  calcMode?: "discrete" | "linear" | "paced" | "spline";
  dur?: string;
  end?: string;
  from?: Numeric;
  keyPoints?: string;
  keySplines?: string;
  keyTimes?: string;
  max?: string;
  min?: string;
  path?: string;
  repeatCount?: Numeric;
  repeatDur?: string;
  restart?: "always" | "whenNotActive" | "never";
  to?: Numeric;
}

/** MathML Core attributes, shared by every MathML element. */
export interface MathMLAttributes {
  autofocus?: boolean;
  dir?: "ltr" | "rtl";
  displaystyle?: Booleanish;
  id?: string;
  mathbackground?: string;
  mathcolor?: string;
  mathsize?: string;
  nonce?: string;
  scriptlevel?: Numeric;
  tabindex?: Numeric;
  [aria: `aria-${string}`]: string | number | boolean | undefined;
  [data: `data-${string}`]: string | number | boolean | undefined;
  // Element-specific (math, mfrac, mo, mover/munder, mpadded/mspace, mtd, mi, annotation)
  accent?: Booleanish;
  accentunder?: Booleanish;
  columnspan?: Numeric;
  depth?: string;
  display?: "block" | "inline";
  encoding?: string;
  fence?: Booleanish;
  form?: "prefix" | "infix" | "postfix";
  height?: string;
  largeop?: Booleanish;
  linethickness?: string;
  lspace?: string;
  mathvariant?: string;
  maxsize?: string;
  minsize?: string;
  movablelimits?: Booleanish;
  rowspan?: Numeric;
  rspace?: string;
  separator?: Booleanish;
  stretchy?: Booleanish;
  symmetric?: Booleanish;
  voffset?: string;
  width?: string;
}
