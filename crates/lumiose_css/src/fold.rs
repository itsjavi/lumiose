//! Constant folding of math functions in custom property values.
//!
//! Lightning CSS reduces `calc()`, `min()`, `clamp()` and the other math functions of typed
//! properties, but keeps a custom property's value as raw tokens, so `--x: calc($gap * 2px)`
//! would reach the browser as `calc(8 * 2px)`. This pass gives each math function in a custom
//! property value to Lightning CSS's own math parser and replaces it when it reduces to a
//! single finite number, percentage, length, angle or time. Anything else is left untouched:
//! `var()`, `env()`, unknown idents, and units that cannot be combined at build time
//! (`calc(100% - 16px)`, `calc(1em + 2px)`). A function that only partly reduces is kept
//! whole. Math nested in other functions (`rotate(calc(45deg * 2))`) and in `var()`
//! fallbacks is folded too.
//!
//! The use site of a custom property is unknown, so the result stays wrapped in `calc()`
//! whenever the bare value could mean something else there: when it is negative (a property
//! that rejects negative values clamps a `calc()` to zero but drops a negative literal), when
//! it is a fractional number (integer properties round a `calc()` but reject a fractional
//! literal), and when a neighbouring token is not whitespace or a comma (a bare `16px` next to
//! another token could merge with it when the value is re-tokenized).

use lightningcss::properties::Property;
use lightningcss::properties::custom::{
    CustomProperty, CustomPropertyName, Function, Token, TokenList, TokenOrValue,
};
use lightningcss::stylesheet::PrinterOptions;
use lightningcss::traits::Parse;
use lightningcss::values::angle::Angle;
use lightningcss::values::calc::Calc;
use lightningcss::values::ident::{DashedIdent, Ident};
use lightningcss::values::length::{Length, LengthValue};
use lightningcss::values::percentage::Percentage;
use lightningcss::values::time::Time;

/// The math functions Lightning CSS evaluates.
const MATH_FUNCTIONS: [&str; 21] = [
    "calc", "min", "max", "clamp", "round", "mod", "rem", "abs", "sign", "sin", "cos", "tan",
    "asin", "acos", "atan", "atan2", "pow", "sqrt", "hypot", "log", "exp",
];

/// Folds the math functions of an author-defined custom property (`--name`). Unknown
/// properties, which Lightning CSS stores the same way, are left alone.
pub(crate) fn custom_property(property: &mut CustomProperty) {
    if matches!(property.name, CustomPropertyName::Custom(_)) {
        fold_list(&mut property.value);
    }
}

fn fold_list(list: &mut TokenList) {
    for index in 0..list.0.len() {
        let folded = match &mut list.0[index] {
            TokenOrValue::Function(function) if is_math(&function.name.0) => fold(function),
            TokenOrValue::Function(function) => {
                fold_list(&mut function.arguments);
                None
            }
            TokenOrValue::Var(variable) => {
                if let Some(fallback) = &mut variable.fallback {
                    fold_list(fallback);
                }
                None
            }
            _ => None,
        };
        let Some(value) = folded else {
            continue;
        };
        let separated = |token: Option<&TokenOrValue>| {
            matches!(
                token,
                None | Some(TokenOrValue::Token(Token::WhiteSpace(_) | Token::Comma))
            )
        };
        let isolated = separated(index.checked_sub(1).and_then(|i| list.0.get(i)))
            && separated(list.0.get(index + 1));
        let token = value.token();
        list.0[index] = if isolated && value.is_safe_bare() {
            token
        } else {
            TokenOrValue::Function(Function {
                name: Ident("calc".into()),
                arguments: TokenList(vec![token]),
            })
        };
    }
}

/// Whether `name` is a math function Lightning CSS evaluates (ASCII case-insensitive).
pub(crate) fn is_math(name: &str) -> bool {
    MATH_FUNCTIONS
        .iter()
        .any(|math| name.eq_ignore_ascii_case(math))
}

/// The value a math function reduces to, if it reduces to a single finite one.
fn fold(function: &Function) -> Option<Folded> {
    // Lightning CSS parses math only from text, so print the function back first.
    let text = Property::Custom(CustomProperty {
        name: CustomPropertyName::Custom(DashedIdent("--fold".into())),
        value: TokenList(vec![TokenOrValue::Function(function.clone())]),
    })
    .value_to_css_string(PrinterOptions::default())
    .ok()?;
    evaluate(&text)
}

/// The value the math function `text` (`calc(8 * 2px)`) reduces to, if it reduces to a single
/// finite number, percentage, length, angle or time.
pub(crate) fn evaluate(text: &str) -> Option<Folded> {
    // Each attempt fails unless every operand has that type (plain numbers aside), so the
    // first that parses decides: a reduced value, or an expression that does not reduce.
    let folded = if let Some(calc) = reduce::<f32>(text) {
        value(calc, |number| Some(Folded::Number(number)))
    } else if let Some(calc) = reduce::<Length>(text) {
        value(calc, |length| match length {
            Length::Value(length) => Some(Folded::Length(length)),
            Length::Calc(_) => None,
        })
    } else if let Some(calc) = reduce::<Percentage>(text) {
        value(calc, |percentage| Some(Folded::Percentage(percentage.0)))
    } else if let Some(calc) = reduce::<Angle>(text) {
        value(calc, |angle| Some(Folded::Angle(angle)))
    } else {
        reduce::<Time>(text).and_then(|calc| value(calc, |time| Some(Folded::Time(time))))
    }?;
    let number = folded.number();
    if !number.is_finite() {
        return None;
    }
    // `calc(0px * -1)` reduces to `-0px`.
    Some(if number == 0.0 && number.is_sign_negative() {
        folded.negated()
    } else {
        folded
    })
}

/// `text` parsed as a math expression over `V`, or `None` when it is not one.
fn reduce<V>(text: &str) -> Option<Calc<V>>
where
    for<'i> Calc<V>: Parse<'i>,
{
    // Parsing `Calc` rather than `V` itself: `Percentage::parse` panics on a `calc()` that
    // does not reduce to a percentage.
    Calc::<V>::parse_string(text).ok()
}

/// The single value `calc` reduced to: a `V`, or a number (`sign(-2px)` is `-1`).
fn value<V>(calc: Calc<V>, typed: impl FnOnce(V) -> Option<Folded>) -> Option<Folded> {
    match calc {
        Calc::Value(value) => typed(*value),
        Calc::Number(number) => Some(Folded::Number(number)),
        _ => None,
    }
}

pub(crate) enum Folded {
    Number(f32),
    Percentage(f32),
    Length(LengthValue),
    Angle(Angle),
    Time(Time),
}

impl Folded {
    /// The numeric part, in the value's own unit (a fraction for percentages).
    pub fn number(&self) -> f32 {
        match self {
            Self::Number(number) | Self::Percentage(number) => *number,
            Self::Length(length) => length.to_unit_value().0,
            Self::Angle(Angle::Deg(n) | Angle::Rad(n) | Angle::Grad(n) | Angle::Turn(n))
            | Self::Time(Time::Seconds(n) | Time::Milliseconds(n)) => *n,
        }
    }

    pub fn is_number(&self) -> bool {
        matches!(self, Self::Number(_))
    }

    /// Zero in the same unit (`0rem`, `0%`, `0`), so that it compares with the value.
    pub fn zero(&self) -> String {
        let unit = match self {
            Self::Number(_) => "",
            Self::Percentage(_) => "%",
            Self::Length(length) => length.to_unit_value().1,
            Self::Angle(angle) => match angle {
                Angle::Deg(_) => "deg",
                Angle::Rad(_) => "rad",
                Angle::Grad(_) => "grad",
                Angle::Turn(_) => "turn",
            },
            Self::Time(time) => match time {
                Time::Seconds(_) => "s",
                Time::Milliseconds(_) => "ms",
            },
        };
        format!("0{unit}")
    }

    fn negated(self) -> Self {
        match self {
            Self::Number(number) => Self::Number(-number),
            Self::Percentage(fraction) => Self::Percentage(-fraction),
            Self::Length(length) => Self::Length(length * -1.0),
            Self::Angle(angle) => Self::Angle(angle * -1.0),
            Self::Time(time) => Self::Time(time * -1.0),
        }
    }

    /// Whether the bare value means the same as `calc(value)` wherever its type is accepted.
    fn is_safe_bare(&self) -> bool {
        let number = self.number();
        number >= 0.0 && !(self.is_number() && number.fract() != 0.0)
    }

    fn token(&self) -> TokenOrValue<'static> {
        let int_value = |number: f32| (number.fract() == 0.0).then_some(number as i32);
        match self {
            Self::Number(number) => TokenOrValue::Token(Token::Number {
                has_sign: *number < 0.0,
                value: *number,
                int_value: int_value(*number),
            }),
            Self::Percentage(fraction) => TokenOrValue::Token(Token::Percentage {
                has_sign: *fraction < 0.0,
                unit_value: *fraction,
                int_value: int_value(fraction * 100.0),
            }),
            Self::Length(length) => TokenOrValue::Length(length.clone()),
            Self::Angle(angle) => TokenOrValue::Angle(angle.clone()),
            Self::Time(time) => TokenOrValue::Time(time.clone()),
        }
    }
}
