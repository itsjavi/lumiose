//! Warnings for declaration values that browsers would ignore (`LUM3017`–`LUM3019`).
//!
//! Lightning CSS keeps the value of a known property that it cannot parse as raw tokens
//! (`Property::Unparsed`) and prints it unchanged, so a typo such as `color: notacolor` or
//! `width: 10 px` reaches the browser, which drops the declaration. These checks run on the
//! block text with the `$ref` substitutions applied, before Lightning CSS parses the block:
//!
//! - **`LUM3019`**: a numeric `$ref` followed by whitespace and a unit (`$gap px`), anywhere
//!   references are substituted. The fix is `calc($gap * 1px)`.
//! - **`LUM3018`**: a non-zero numeric `$ref` where the property needs a length, angle or
//!   time. A ref is reported when giving it a unit (`px`, `deg`, then `ms`) makes an invalid
//!   value valid, or does not change what Lightning CSS outputs (it reads unitless lengths as
//!   `px`: `gap: 8` is `gap: 8px`), or removes a number/dimension mix from a math function
//!   (`calc(8 + 1px)`, `min(100%, 600)`).
//! - **`LUM3017`**: any other value that does not parse, and grid track lists that combine
//!   `repeat(auto-fill | auto-fit, …)` with tracks that are not fixed-size, which Lightning
//!   CSS accepts but browsers reject.
//!
//! `LUM3017` is conservative: the pinned Lightning CSS also keeps some valid CSS as raw tokens
//! (newer keywords and functions, `var()`), so those values are never reported. Descriptors
//! of at-rules such as `@font-face`, custom properties, vendor-prefixed and unknown properties
//! are not checked, nor are values with an unresolved `$ref` (the compiler reports those).

use std::ops::Range;

use lightningcss::properties::custom::{Token, TokenList, TokenOrValue};
use lightningcss::properties::grid::{
    RepeatCount, TrackBreadth, TrackListItem, TrackSize, TrackSizing,
};
use lightningcss::properties::{Property, PropertyId};
use lightningcss::stylesheet::{ParserOptions, PrinterOptions};
use lightningcss::traits::{Parse, ToCss};
use lightningcss::values::angle::Angle;
use lightningcss::values::calc::{Calc, MathFunction};
use lightningcss::values::length::LengthPercentage;
use lightningcss::values::time::Time;

use crate::diagnostics::{CssCode, CssDiagnostic, Fix, TextEdit};
use crate::fold;
use crate::prepass::Declaration;
use crate::{RefValue, Span};

/// A `$ref` site of the block and its value; `None` when it is not substituted (unresolved
/// or hyphenated).
pub(crate) struct Substitution<'a> {
    pub range: Range<usize>,
    pub value: Option<&'a RefValue>,
}

/// The `LUM3017`–`LUM3019` warnings of one block, with block-relative spans.
pub(crate) fn check(
    content: &str,
    declarations: &[Declaration],
    refs: &[Substitution],
) -> Vec<CssDiagnostic> {
    let mut diagnostics = Vec::new();
    let mut detached = Vec::new();
    for site in refs {
        if let Some(diagnostic) = detached_unit(content, site) {
            detached.push(diagnostic.span);
            diagnostics.push(diagnostic);
        }
    }
    // Both lists are in source order: each declaration looks up its own with a binary search
    // (a file with many `$` references stays linear, TASK-169).
    for declaration in declarations {
        let value = &declaration.value;
        let first = detached.partition_point(|span: &Span| (span.start as usize) < value.start);
        let reported = detached[first..]
            .first()
            .is_some_and(|span| span.end as usize <= value.end);
        if !declaration.descriptor && !reported {
            check_declaration(content, declaration, refs, &mut diagnostics);
        }
    }
    diagnostics
}

/// Units that are never a keyword of their own after a number. `in` (a gradient's colour
/// space) and `x` (`rotate: x 45deg`) are left out.
const UNITS: &[&str] = &[
    "px", "em", "rem", "ex", "rex", "ch", "rch", "cap", "rcap", "ic", "ric", "lh", "rlh", "vw",
    "vh", "vi", "vb", "vmin", "vmax", "svw", "svh", "lvw", "lvh", "dvw", "dvh", "cqw", "cqh",
    "cqi", "cqb", "cqmin", "cqmax", "cm", "mm", "q", "pt", "pc", "deg", "rad", "grad", "turn", "s",
    "ms", "fr", "dpi", "dpcm", "dppx",
];

/// `LUM3019`: `$gap px`, a numeric ref followed by whitespace and a unit.
fn detached_unit(content: &str, site: &Substitution) -> Option<CssDiagnostic> {
    let number = site.value.and_then(numeric)?;
    let after = &content[site.range.end..];
    let gap = after.len() - after.trim_start().len();
    if gap == 0 {
        return None;
    }
    let rest = &after[gap..];
    let length = if rest.starts_with('%') {
        1
    } else {
        rest.find(|ch: char| !ch.is_ascii_alphabetic())
            .unwrap_or(rest.len())
    };
    let unit = &rest[..length];
    let is_unit = unit == "%" || UNITS.iter().any(|u| unit.eq_ignore_ascii_case(u));
    let ident_continues = rest[length..]
        .starts_with(|ch: char| ch == '-' || ch == '_' || ch.is_alphanumeric() || !ch.is_ascii());
    if !is_unit || ident_continues {
        return None;
    }
    let reference = &content[site.range.clone()];
    let end = site.range.end + gap + length;
    let span = Span::from_usize(site.range.start, end);
    let written = &content[site.range.start..end];
    let unit = unit.to_ascii_lowercase();
    let replacement = with_unit(content, site.range.start, reference, &unit);
    Some(
        CssDiagnostic::new(
            CssCode::DetachedUnit,
            span,
            format!(
                "`{written}` is `{} {unit}`: a unit must follow its number without whitespace",
                number_text(number)
            ),
        )
        .with_help(format!(
            "Multiply the constant by the unit, `{replacement}`, or give the constant a unit"
        ))
        .with_fix(Fix {
            message: format!("Replace with `{replacement}`"),
            edits: vec![TextEdit {
                span,
                text: replacement,
            }],
        }),
    )
}

fn check_declaration(
    content: &str,
    declaration: &Declaration,
    refs: &[Substitution],
    diagnostics: &mut Vec<CssDiagnostic>,
) {
    let name = content[declaration.name.clone()].to_ascii_lowercase();
    if name.starts_with('-') {
        // Custom properties and vendor-prefixed properties.
        return;
    }
    let id = PropertyId::from(name.as_str());
    if matches!(id, PropertyId::Custom(_) | PropertyId::All) {
        return;
    }
    let Some(range) = value_range(content, declaration.value.clone()) else {
        // An empty value (`color: ;`) is left to the CSS language service in editors.
        return;
    };
    let first = refs.partition_point(|site| site.range.start < range.start);
    let refs: Vec<&Substitution> = refs[first..]
        .iter()
        .take_while(|site| site.range.start < range.end)
        .filter(|site| site.range.end <= range.end)
        .collect();
    if refs.iter().any(|site| site.value.is_none()) {
        return;
    }
    let value = Value::new(content, range.clone(), &refs);
    let Ok(parsed) = Property::parse_string(id.clone(), &value.text, ParserOptions::default())
    else {
        // Lightning CSS drops the declaration and warns (`LUM3015`).
        return;
    };

    let mut flagged_math: Vec<Range<usize>> = Vec::new();
    let mut flagged = false;
    for (index, site) in refs.iter().enumerate() {
        let Some(unitless) = unitless(&name, &id, &parsed, &value, index) else {
            continue;
        };
        // One report per math function: `calc($a * $b)` needs one unit, not two.
        if let Some(math) = &unitless.math {
            if flagged_math.contains(math) {
                continue;
            }
            flagged_math.push(math.clone());
        }
        flagged = true;
        diagnostics.push(unitless_diagnostic(content, &name, site, &unitless));
    }
    if flagged {
        return;
    }

    let help = match &parsed {
        Property::Unparsed(unparsed) => {
            if !suspicious(&name, &unparsed.value) {
                return;
            }
            "Browsers ignore the declaration. Check the value against the property's syntax"
                .to_owned()
        }
        typed => match grid_error(typed) {
            Some(reason) => format!("Browsers ignore the declaration: {reason}"),
            None => return,
        },
    };
    let mut shown = value.text.trim().to_owned();
    if shown.chars().count() > 80 {
        shown = shown.chars().take(79).collect::<String>() + "…";
    }
    let substituted = if refs.is_empty() {
        String::new()
    } else {
        let names: Vec<String> = refs
            .iter()
            .map(|site| format!("`{}`", &content[site.range.clone()]))
            .collect();
        format!(" (with {})", names.join(", "))
    };
    diagnostics.push(
        CssDiagnostic::new(
            CssCode::InvalidCssValue,
            Span::from_usize(range.start, range.end),
            format!("`{shown}` is not a valid value for `{name}`{substituted}"),
        )
        .with_help(help),
    );
}

/// The value without surrounding whitespace and a trailing `!important`; `None` when it is
/// empty or has another `!` (Lightning CSS drops it with a warning).
fn value_range(content: &str, range: Range<usize>) -> Option<Range<usize>> {
    let text = &content[range.clone()];
    let trimmed = text.trim();
    if trimmed.is_empty() {
        // `color: ;`: Lightning CSS drops it with a warning.
        return None;
    }
    let start = range.start + (text.len() - text.trim_start().len());
    let mut end = start + trimmed.len();
    if let Some(bang) = trimmed.rfind('!') {
        let flag = trimmed[bang + 1..].trim_start();
        if !flag.eq_ignore_ascii_case("important") {
            return None;
        }
        end = start + trimmed[..bang].trim_end().len();
    }
    let value = &content[start..end];
    let stray_bang = value.contains('!') && strip_strings(value).contains('!');
    (start < end && !stray_bang).then_some(start..end)
}

/// `text` with the contents of its quoted strings removed.
fn strip_strings(text: &str) -> String {
    let mut out = String::new();
    let mut pos = 0;
    while pos < text.len() {
        let rest = &text[pos..];
        if rest.starts_with(['"', '\'']) {
            pos = crate::prepass::skip_string(text, pos);
            continue;
        }
        let ch = rest.chars().next().expect("not at the end");
        out.push(ch);
        pos += ch.len_utf8();
    }
    out
}

/// A declaration value with its `$ref`s substituted.
struct Value {
    text: String,
    /// Where each ref's number or text is in `text`, in ref order.
    refs: Vec<Range<usize>>,
    /// The numeric value of each ref, if it has one.
    numbers: Vec<Option<f64>>,
}

impl Value {
    fn new(content: &str, range: Range<usize>, refs: &[&Substitution]) -> Self {
        let mut text = String::new();
        let mut ranges = Vec::new();
        let mut numbers = Vec::new();
        let mut last = range.start;
        for site in refs {
            let value = site.value.expect("only resolved refs are substituted");
            text.push_str(&content[last..site.range.start]);
            let start = text.len();
            text.push_str(&crate::process::value_text(value));
            ranges.push(start..text.len());
            numbers.push(numeric(value));
            last = site.range.end;
        }
        text.push_str(&content[last..range.end]);
        Self {
            text,
            refs: ranges,
            numbers,
        }
    }

    /// The text with ref `index` followed by `unit`.
    fn with_unit(&self, index: usize, unit: &str) -> String {
        let end = self.refs[index].end;
        format!("{}{unit}{}", &self.text[..end], &self.text[end..])
    }

    /// The outermost math function around ref `index`, as a range of `text`.
    fn math_function(&self, index: usize) -> Option<Range<usize>> {
        let at = self.refs[index].start;
        let bytes = self.text.as_bytes();
        // The opening parenthesis of every function still open at `at`.
        let mut open: Vec<usize> = Vec::new();
        for (pos, &byte) in bytes[..at].iter().enumerate() {
            match byte {
                b'(' => open.push(pos),
                b')' => {
                    open.pop();
                }
                _ => {}
            }
        }
        let start = open.into_iter().find_map(|paren| {
            let start = name_start(bytes, paren);
            fold::is_math(&self.text[start..paren]).then_some(start)
        })?;
        let mut depth = 0usize;
        for (pos, &byte) in bytes.iter().enumerate().skip(start) {
            match byte {
                b'(' => depth += 1,
                b')' => {
                    depth -= 1;
                    if depth == 0 {
                        return Some(start..pos + 1);
                    }
                }
                _ => {}
            }
        }
        None
    }
}

/// The start of the function name that ends at `paren`.
fn name_start(bytes: &[u8], paren: usize) -> usize {
    let mut start = paren;
    while start > 0 {
        let byte = bytes[start - 1];
        if !(byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_') || !byte.is_ascii()) {
            break;
        }
        start -= 1;
    }
    start
}

/// The number a ref stands for: a number, or a string that is one (`"8"`).
fn numeric(value: &RefValue) -> Option<f64> {
    match value {
        RefValue::Number(number) => Some(*number),
        RefValue::String(text) => {
            let text = text.trim();
            let plain = text
                .chars()
                .all(|ch| ch.is_ascii_digit() || matches!(ch, '.' | '-' | '+'));
            if plain { text.parse().ok() } else { None }
        }
    }
}

fn number_text(number: f64) -> String {
    crate::process::value_text(&RefValue::Number(number))
}

/// SVG geometry properties accept plain numbers (user units).
const USER_UNITS: &[&str] = &[
    "stroke-width",
    "stroke-dashoffset",
    "stroke-dasharray",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "x",
    "y",
];

#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    Length,
    Angle,
    Time,
}

impl Kind {
    fn unit(self) -> &'static str {
        match self {
            Self::Length => "px",
            Self::Angle => "deg",
            Self::Time => "ms",
        }
    }
}

struct Unitless {
    kind: Kind,
    number: f64,
    /// Lightning CSS outputs the number as a `px` length (the value stays valid).
    converted: bool,
    /// The math function the ref is in, when that is where the unit is missing.
    math: Option<Range<usize>>,
}

/// `LUM3018`: whether ref `index` is a unitless number where the property needs a unit.
fn unitless(
    name: &str,
    id: &PropertyId,
    parsed: &Property,
    value: &Value,
    index: usize,
) -> Option<Unitless> {
    let number = value.numbers[index].filter(|n| *n != 0.0)?;
    if USER_UNITS.contains(&name) {
        return None;
    }
    let invalid = matches!(parsed, Property::Unparsed(_));
    let printed = || parsed.value_to_css_string(PrinterOptions::default()).ok();
    for kind in [Kind::Length, Kind::Angle, Kind::Time] {
        let text = value.with_unit(index, kind.unit());
        let Ok(with_unit) = Property::parse_string(id.clone(), &text, ParserOptions::default())
        else {
            continue;
        };
        if matches!(with_unit, Property::Unparsed(_)) {
            continue;
        }
        let math = value.math_function(index);
        let hit = |converted: bool, math: Option<Range<usize>>| {
            Some(Unitless {
                kind,
                number,
                converted,
                math,
            })
        };
        if invalid {
            return hit(false, math);
        }
        if printed()
            == with_unit
                .value_to_css_string(PrinterOptions::default())
                .ok()
        {
            return hit(kind == Kind::Length, math);
        }
        if let Some(range) = math {
            let original = &value.text[range.clone()];
            let shift = kind.unit().len();
            let fixed = &text[range.start..range.end + shift];
            if mixes_number(kind, original) && !mixes_number(kind, fixed) {
                return hit(false, Some(range));
            }
            // `width: calc(2 * 4)` reduces to a number, which Lightning CSS prints as `8`
            // (invalid) where a bare `8` would have become `8px`.
            let reduced = fold::evaluate(original).filter(fold::Folded::is_number);
            let with_unit = fold::evaluate(fixed).filter(|folded| !folded.is_number());
            if let (Some(reduced), Some(_)) = (reduced, with_unit) {
                let bare = number_text(f64::from(reduced.number()));
                let around = |inner: &str| {
                    let text = format!(
                        "{}{inner}{}",
                        &value.text[..range.start],
                        &value.text[range.end..]
                    );
                    Property::parse_string(id.clone(), &text, ParserOptions::default())
                        .ok()
                        .filter(|parsed| !matches!(parsed, Property::Unparsed(_)))
                        .and_then(|parsed| {
                            parsed.value_to_css_string(PrinterOptions::default()).ok()
                        })
                };
                let number = around(&bare);
                if number.is_some() && number == around(&format!("{bare}{}", kind.unit())) {
                    return hit(false, Some(range));
                }
            }
        }
        return None;
    }
    None
}

/// Whether the math function `text` adds or compares a plain number with a dimension, which
/// is invalid (`calc(8 + 1px)`).
fn mixes_number(kind: Kind, text: &str) -> bool {
    fn parse<V>(text: &str) -> Option<Calc<V>>
    where
        for<'i> Calc<V>: Parse<'i>,
    {
        Calc::<V>::parse_string(text).ok()
    }
    match kind {
        Kind::Length => parse::<LengthPercentage>(text).is_some_and(|calc| mixed(&calc)),
        Kind::Angle => parse::<Angle>(text).is_some_and(|calc| mixed(&calc)),
        Kind::Time => parse::<Time>(text).is_some_and(|calc| mixed(&calc)),
    }
}

fn mixed<V>(calc: &Calc<V>) -> bool {
    match calc {
        Calc::Value(_) | Calc::Number(_) => false,
        Calc::Sum(a, b) => siblings(&[a.as_ref(), b.as_ref()]),
        Calc::Product(_, calc) => mixed(calc),
        Calc::Function(function) => match function.as_ref() {
            MathFunction::Calc(calc) | MathFunction::Abs(calc) | MathFunction::Sign(calc) => {
                mixed(calc)
            }
            MathFunction::Min(list) | MathFunction::Max(list) | MathFunction::Hypot(list) => {
                siblings(&list.iter().collect::<Vec<_>>())
            }
            MathFunction::Clamp(a, b, c) => siblings(&[a, b, c]),
            MathFunction::Round(_, a, b) | MathFunction::Rem(a, b) | MathFunction::Mod(a, b) => {
                siblings(&[a, b])
            }
        },
    }
}

/// Operands of one sum or comparison: numbers next to dimensions, or a mix deeper down.
fn siblings<V>(list: &[&Calc<V>]) -> bool {
    let numbers = list
        .iter()
        .filter(|calc| matches!(calc, Calc::Number(_)))
        .count();
    (numbers > 0 && numbers < list.len()) || list.iter().any(|calc| mixed(calc))
}

fn unitless_diagnostic(
    content: &str,
    property: &str,
    site: &Substitution,
    unitless: &Unitless,
) -> CssDiagnostic {
    let reference = &content[site.range.clone()];
    let number = number_text(unitless.number);
    let needs = match unitless.kind {
        Kind::Length => "a length",
        Kind::Angle => "an angle",
        Kind::Time => "a time",
    };
    let diagnostic = CssDiagnostic::new(
        CssCode::UnitlessStyleRef,
        Span::from_usize(site.range.start, site.range.end),
        format!("`{reference}` is a unitless number (`{number}`) where `{property}` needs {needs}"),
    );
    let consequence = if unitless.converted {
        format!("Lightning CSS outputs it as `{number}px`, but CSS itself rejects unitless lengths")
    } else {
        "Browsers ignore the declaration".to_owned()
    };
    if unitless.kind == Kind::Time {
        let ms = with_unit(content, site.range.start, reference, "ms");
        let s = with_unit(content, site.range.start, reference, "s");
        return diagnostic.with_help(format!(
            "{consequence}. Multiply the constant by a time unit, `{ms}` or `{s}`, or give the constant a unit"
        ));
    }
    let replacement = with_unit(content, site.range.start, reference, unitless.kind.unit());
    diagnostic
        .with_help(format!(
            "{consequence}. Multiply the constant by the unit, `{replacement}`, or give the constant a unit"
        ))
        .with_fix(Fix {
            message: format!("Replace with `{replacement}`"),
            edits: vec![TextEdit {
                span: Span::from_usize(site.range.start, site.range.end),
                text: replacement,
            }],
        })
}

/// `$x` times one `unit`: `$x * 1px` directly inside a math function, else
/// `calc($x * 1px)`.
fn with_unit(content: &str, at: usize, reference: &str, unit: &str) -> String {
    let product = format!("{reference} * 1{unit}");
    if innermost_function(content, at).is_some_and(fold::is_math) {
        product
    } else {
        format!("calc({product})")
    }
}

/// The name of the innermost function open at `at`, looking back to the start of the
/// statement.
fn innermost_function(content: &str, at: usize) -> Option<&str> {
    let bytes = content.as_bytes();
    let mut depth = 0usize;
    for pos in (0..at).rev() {
        match bytes[pos] {
            b')' => depth += 1,
            b'(' if depth == 0 => return Some(&content[name_start(bytes, pos)..pos]),
            b'(' => depth -= 1,
            b';' | b'{' | b'}' => return None,
            _ => {}
        }
    }
    None
}

/// Functions whose arguments the pinned Lightning CSS parses. A raw value using any other
/// function may be valid CSS it does not know yet (`anchor()`, `if()`, `image-set()`).
const KNOWN_FUNCTIONS: &[&str] = &[
    // Colors (relative colors and `color-mix()` are not checked).
    "rgb",
    "rgba",
    "hsl",
    "hsla",
    "hwb",
    "lab",
    "lch",
    "oklab",
    "oklch",
    "color",
    "light-dark",
    "url",
    // Grid.
    "repeat",
    "minmax",
    "fit-content",
    // Transforms.
    "translate",
    "translatex",
    "translatey",
    "translatez",
    "translate3d",
    "scale",
    "scalex",
    "scaley",
    "scalez",
    "scale3d",
    "rotate",
    "rotatex",
    "rotatey",
    "rotatez",
    "rotate3d",
    "skew",
    "skewx",
    "skewy",
    "matrix",
    "matrix3d",
    "perspective",
    // Easing.
    "cubic-bezier",
    "steps",
    // Filters.
    "blur",
    "brightness",
    "contrast",
    "drop-shadow",
    "grayscale",
    "hue-rotate",
    "invert",
    "opacity",
    "saturate",
    "sepia",
    // Basic shapes.
    "inset",
    "circle",
    "ellipse",
    "polygon",
    // Generated content.
    "counter",
    "counters",
    // Gradients (unless they name a colour space: `linear-gradient(in oklch, …)`).
    "linear-gradient",
    "radial-gradient",
    "conic-gradient",
    "repeating-linear-gradient",
    "repeating-radial-gradient",
    "repeating-conic-gradient",
];

/// Valid keywords the pinned Lightning CSS keeps as raw tokens wherever they appear.
const NEWER_KEYWORDS: &[&str] = &[
    "allow-discrete",
    "grid-lanes",
    "subgrid",
    "masonry",
    "anchor-center",
    "math",
    "math-auto",
    "auto-phrase",
    "legacy",
    "overlay",
    "dense",
    "preserve-3d",
    "border-area",
    "content",
    "fit-content",
    "max-content",
    "min-content",
    // System fonts (`font: caption`).
    "caption",
    "icon",
    "menu",
    "message-box",
    "small-caption",
    "status-bar",
];

/// Valid `(property, keyword)` pairs the pinned Lightning CSS keeps as raw tokens.
const KEYWORD_GAPS: &[(&str, &str)] = &[
    ("box-shadow", "none"),
    ("text-shadow", "none"),
    ("animation", "auto"),
    ("animation-duration", "auto"),
    ("outline", "invert"),
    ("outline-color", "invert"),
];

/// Properties whose valid values the pinned Lightning CSS often keeps as raw tokens.
const UNCHECKED_PROPERTIES: &[&str] = &["text-overflow", "transform-origin", "image-rendering"];

const CSS_WIDE_KEYWORDS: &[&str] = &["inherit", "initial", "unset", "revert", "revert-layer"];

/// Whether a raw value is invalid rather than valid CSS the pinned Lightning CSS does not
/// parse yet.
fn suspicious(property: &str, value: &TokenList) -> bool {
    if UNCHECKED_PROPERTIES.contains(&property) {
        return false;
    }
    let significant: Vec<&TokenOrValue> = value
        .0
        .iter()
        .filter(|token| !matches!(token, TokenOrValue::Token(Token::WhiteSpace(_))))
        .collect();
    match significant.as_slice() {
        [] => false,
        [TokenOrValue::Token(Token::Ident(ident))]
            if CSS_WIDE_KEYWORDS
                .iter()
                .any(|keyword| ident.eq_ignore_ascii_case(keyword)) =>
        {
            false
        }
        _ => all_known(property, value),
    }
}

fn all_known(property: &str, list: &TokenList) -> bool {
    list.0.iter().all(|token| match token {
        TokenOrValue::Var(_)
        | TokenOrValue::Env(_)
        | TokenOrValue::UnresolvedColor(_)
        | TokenOrValue::DashedIdent(_) => false,
        TokenOrValue::Function(function) => {
            let name = function.name.0.to_ascii_lowercase();
            // Math functions are not trusted either: the pinned Lightning CSS keeps valid
            // math in some properties as raw tokens (`z-index: calc(3 * 2)`).
            let known = KNOWN_FUNCTIONS.contains(&name.as_str());
            let color_space = name.ends_with("-gradient")
                && function.arguments.0.iter().any(
                    |token| matches!(token, TokenOrValue::Token(Token::Ident(i)) if i.eq_ignore_ascii_case("in")),
                );
            known && !color_space && all_known(property, &function.arguments)
        }
        TokenOrValue::Token(Token::Ident(ident)) => {
            let ident = ident.to_ascii_lowercase();
            !ident.starts_with('-')
                && !NEWER_KEYWORDS.contains(&ident.as_str())
                && !KEYWORD_GAPS.contains(&(property, ident.as_str()))
        }
        TokenOrValue::Token(Token::BadUrl(_) | Token::BadString(_)) => false,
        _ => true,
    })
}

/// Why a grid track list that Lightning CSS accepts is invalid: an auto-repeat
/// (`repeat(auto-fill | auto-fit, …)`) is allowed only once and only with fixed-size tracks.
fn grid_error(property: &Property) -> Option<String> {
    let lists: Vec<&TrackSizing> = match property {
        Property::GridTemplateColumns(sizing) | Property::GridTemplateRows(sizing) => {
            vec![sizing]
        }
        Property::GridTemplate(template) => vec![&template.rows, &template.columns],
        Property::Grid(grid) => vec![&grid.rows, &grid.columns],
        _ => return None,
    };
    lists.into_iter().find_map(track_list_error)
}

fn track_list_error(sizing: &TrackSizing) -> Option<String> {
    let TrackSizing::TrackList(list) = sizing else {
        return None;
    };
    let auto_repeats = list
        .items
        .iter()
        .filter(|item| {
            matches!(item, TrackListItem::TrackRepeat(repeat)
                if !matches!(repeat.count, RepeatCount::Number(_)))
        })
        .count();
    if auto_repeats == 0 {
        return None;
    }
    if auto_repeats > 1 {
        return Some(
            "a track list can have only one `repeat(auto-fill, …)` or `repeat(auto-fit, …)`"
                .to_owned(),
        );
    }
    let flexible = list
        .items
        .iter()
        .flat_map(|item| match item {
            TrackListItem::TrackSize(size) => std::slice::from_ref(size),
            TrackListItem::TrackRepeat(repeat) => &repeat.track_sizes[..],
        })
        .find(|size| !fixed_size(size))?;
    let track = flexible
        .to_css_string(PrinterOptions::default())
        .unwrap_or_default();
    Some(format!(
        "with `repeat(auto-fill, …)` or `repeat(auto-fit, …)`, every track needs a fixed size \
         (a length or percentage, or a `minmax()` with one), and `{track}` is not fixed"
    ))
}

/// `<fixed-size>`: a length-percentage, or a `minmax()` with a length-percentage minimum, or
/// with a length-percentage maximum and an inflexible minimum.
fn fixed_size(size: &TrackSize) -> bool {
    let fixed = |breadth: &TrackBreadth| matches!(breadth, TrackBreadth::Length(_));
    match size {
        TrackSize::TrackBreadth(breadth) => fixed(breadth),
        TrackSize::MinMax { min, max } => {
            fixed(min) || (fixed(max) && !matches!(min, TrackBreadth::Flex(_)))
        }
        TrackSize::FitContent(_) => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The warnings for `css` (one block) as `code `snippet``, with `refs` substituted by name.
    fn warnings(css: &str, refs: &[(&str, RefValue)]) -> Vec<String> {
        let scan = crate::prepass::scan(css);
        let sites: Vec<Substitution> = scan
            .refs
            .iter()
            .map(|site| Substitution {
                range: site.range.clone(),
                value: refs
                    .iter()
                    .find(|(name, _)| *name == site.path.join("."))
                    .map(|(_, value)| value)
                    .filter(|_| site.hyphenated.is_none()),
            })
            .collect();
        let mut diagnostics = check(css, &scan.declarations, &sites);
        diagnostics.sort_by_key(|d| d.span.start);
        diagnostics
            .iter()
            .map(|d| format!("{} `{}`", d.code, &css[d.span.range()]))
            .collect()
    }

    fn invalid(declaration: &str) -> Vec<String> {
        warnings(&format!(".a {{ {declaration} }}"), &[])
    }

    #[test]
    fn reports_values_that_do_not_parse() {
        assert_eq!(invalid("color: notacolor"), ["LUM3017 `notacolor`"]);
        assert_eq!(invalid("width: 10 px;"), ["LUM3017 `10 px`"]);
        assert_eq!(
            invalid("display: flexbox !important"),
            ["LUM3017 `flexbox`"]
        );
        assert_eq!(invalid("padding: none"), ["LUM3017 `none`"]);
        assert_eq!(invalid("rotate: 45"), ["LUM3017 `45`"]);
        assert_eq!(
            invalid("transition: opacity 200"),
            ["LUM3017 `opacity 200`"]
        );
        assert_eq!(invalid("COLOR: rgb(1 2)"), ["LUM3017 `rgb(1 2)`"]);
        assert_eq!(
            invalid("grid-template-columns: minmax(1fr, 2fr)"),
            ["LUM3017 `minmax(1fr, 2fr)`"]
        );
    }

    #[test]
    fn reports_auto_repeat_with_flexible_tracks() {
        let report = |value: &str| invalid(&format!("grid-template-columns: {value}"));
        assert_eq!(
            report("2fr repeat(auto-fit, minmax(9rem, 1fr))"),
            ["LUM3017 `2fr repeat(auto-fit, minmax(9rem, 1fr))`"]
        );
        assert_eq!(report("repeat(auto-fill, 1fr)").len(), 1);
        assert_eq!(
            report("repeat(auto-fill, 10px) repeat(auto-fit, 10px)").len(),
            1
        );
        assert_eq!(report("repeat(auto-fill, 10px) repeat(2, auto)").len(), 1);
        assert_eq!(invalid("grid: auto / 1fr repeat(auto-fit, 10px)").len(), 1);
        assert_eq!(
            invalid("grid-template: 1fr / auto repeat(auto-fill, 10px)").len(),
            1
        );
        for valid in [
            "repeat(auto-fill, minmax(min(100%, 12rem), 1fr))",
            "10rem repeat(auto-fit, minmax(9rem, 1fr)) 20%",
            "[a] repeat(auto-fill, [b] 10px minmax(auto, 20px)) [c] repeat(2, 1px)",
            "2fr repeat(3, minmax(9rem, 1fr))",
        ] {
            assert!(report(valid).is_empty(), "{valid}");
        }
    }

    #[test]
    fn skips_what_lightning_css_does_not_know_yet() {
        for valid in [
            "width: inherit",
            "width: 10px ! important",
            "box-shadow: none",
            "animation-duration: auto",
            "outline-color: invert",
            "display: grid-lanes",
            "font: caption",
            "transition: opacity 0.2s allow-discrete",
            "color: color-mix(red, blue)",
            "background-image: linear-gradient(in oklch, red, blue)",
            "width: calc(1px + sibling-index() * 1px)",
            "top: anchor(--a bottom, 0px)",
            "outline: 2px solid -webkit-focus-ring-color",
            "transform-origin: 50% 50% 0",
            "color: var(--c)",
            "--x: notacolor",
            "-webkit-foo: bar",
            "unknown-property: 10 px",
            "color: red !importnt",
        ] {
            assert!(invalid(valid).is_empty(), "{valid}");
        }
    }

    #[test]
    fn skips_at_rule_descriptors() {
        assert!(
            warnings(
                "@font-face { font-weight: 100 900; font-display: nope }",
                &[]
            )
            .is_empty()
        );
        assert_eq!(
            warnings("@keyframes k { to { color: nope } }", &[]),
            ["LUM3017 `nope`"]
        );
        assert_eq!(
            warnings(".a { @media print { color: nope } }", &[]),
            ["LUM3017 `nope`"]
        );
    }

    #[test]
    fn reports_detached_units() {
        let gap = [("gap", RefValue::Number(8.0))];
        assert_eq!(
            warnings(".a { margin: $gap px }", &gap),
            ["LUM3019 `$gap px`"]
        );
        assert_eq!(
            warnings(".a { width: calc($gap   % + 1px) }", &gap),
            ["LUM3019 `$gap   %`"]
        );
        assert_eq!(
            warnings("@media (width > $gap em) {}", &gap),
            ["LUM3019 `$gap em`"]
        );
        let string = [("gap", RefValue::String("8".into()))];
        assert_eq!(warnings(".a { margin: $gap px }", &string).len(), 1);
        for fine in [
            ".a { margin: $gap pxx }",
            ".a { margin: $gap solid }",
            ".a { background: linear-gradient($gap in oklch, red, blue) }",
            ".a { margin: $gap $gap }",
            ".a { --x: $gap }",
        ] {
            let detached = warnings(fine, &gap)
                .into_iter()
                .any(|warning| warning.starts_with("LUM3019"));
            assert!(!detached, "{fine}");
        }
        let unit = [("gap", RefValue::String("8px".into()))];
        assert_eq!(
            warnings(".a { margin: $gap px }", &unit),
            ["LUM3017 `$gap px`"]
        );
    }

    #[test]
    fn reports_unitless_numbers() {
        let n = |value: f64| RefValue::Number(value);
        let report = |css: &str, value: f64| warnings(css, &[("x", n(value))]);
        assert_eq!(report(".a { gap: $x }", 8.0), ["LUM3018 `$x`"]);
        assert_eq!(report(".a { margin: 0 $x }", 8.0), ["LUM3018 `$x`"]);
        assert_eq!(report(".a { rotate: $x }", 45.0), ["LUM3018 `$x`"]);
        assert_eq!(
            report(".a { transition: opacity $x }", 200.0),
            ["LUM3018 `$x`"]
        );
        assert_eq!(
            report(".a { transform: translateX($x) }", 8.0),
            ["LUM3018 `$x`"]
        );
        assert_eq!(
            report(".a { width: calc($x + 1px) }", 8.0),
            ["LUM3018 `$x`"]
        );
        assert_eq!(
            report(".a { width: min(100%, $x) }", 600.0),
            ["LUM3018 `$x`"]
        );
        assert_eq!(report(".a { font: $x/1.5 serif }", 16.0), ["LUM3018 `$x`"]);
        assert_eq!(
            warnings(
                ".a { width: calc($x * $y) }",
                &[("x", n(2.0)), ("y", n(4.0))]
            ),
            ["LUM3018 `$x`"]
        );
        for fine in [
            ".a { line-height: $x }",
            ".a { opacity: $x }",
            ".a { z-index: $x }",
            ".a { flex: $x }",
            ".a { columns: $x }",
            ".a { animation: spin $x linear }",
            ".a { width: calc($x * 1px) }",
            ".a { grid-template-columns: repeat($x, 1fr) }",
            ".a { stroke-width: $x }",
            ".a { --gap: $x }",
            ".a { aspect-ratio: $x }",
        ] {
            assert!(report(fine, 2.0).is_empty(), "{fine}");
        }
        assert!(report(".a { gap: $x }", 0.0).is_empty());
    }

    #[test]
    fn skips_empty_values() {
        // Regression: a whitespace-only value used to slice `start..end` with start > end,
        // which aborted the language server.
        for css in [
            ".a { color: ; }",
            ".a { color:; }",
            ".a { color:   ",
            ".a { color: !important }",
            ".a { color: ! }",
        ] {
            assert!(warnings(css, &[]).is_empty(), "{css}");
        }
    }

    #[test]
    fn skips_unresolved_refs() {
        assert!(warnings(".a { color: $missing }", &[]).is_empty());
        assert!(warnings(".a { color: $brand-primary }", &[]).is_empty());
    }

    #[test]
    fn suggests_units_in_math_without_calc() {
        let css = ".a { width: calc($x + 1px); gap: $x; margin: $x px }";
        let scan = crate::prepass::scan(css);
        let x = RefValue::Number(8.0);
        let sites: Vec<Substitution> = scan
            .refs
            .iter()
            .map(|site| Substitution {
                range: site.range.clone(),
                value: Some(&x),
            })
            .collect();
        let mut diagnostics = check(css, &scan.declarations, &sites);
        diagnostics.sort_by_key(|d| d.span.start);
        let fixes: Vec<String> = diagnostics
            .iter()
            .map(|d| d.fix.as_ref().expect("a fix").edits[0].text.clone())
            .collect();
        assert_eq!(fixes, ["$x * 1px", "calc($x * 1px)", "calc($x * 1px)"]);
    }
}
