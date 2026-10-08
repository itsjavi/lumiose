//! Passes over Lightning CSS stylesheets: scoped `@keyframes` names, `animation` references
//! and the custom properties read through `var()`.

use std::collections::{BTreeSet, HashMap};
use std::convert::Infallible;

use lightningcss::properties::Property;
use lightningcss::properties::animation::AnimationName;
use lightningcss::properties::custom::Variable;
use lightningcss::rules::CssRule;
use lightningcss::rules::keyframes::KeyframesName;
use lightningcss::stylesheet::StyleSheet;
use lightningcss::values::ident::CustomIdent;
use lightningcss::values::string::CSSString;
use lightningcss::visit_types;
use lightningcss::visitor::{Visit, VisitTypes, Visitor};

/// The names of the `@keyframes` rules in a stylesheet, at any depth.
pub(crate) fn keyframes_names(sheet: &mut StyleSheet) -> Vec<String> {
    struct Collector(Vec<String>);
    impl<'i> Visitor<'i> for Collector {
        type Error = Infallible;

        fn visit_types(&self) -> VisitTypes {
            visit_types!(RULES)
        }

        fn visit_rule(&mut self, rule: &mut CssRule<'i>) -> Result<(), Infallible> {
            if let CssRule::Keyframes(keyframes) = rule {
                self.0.push(keyframes_name(&keyframes.name).to_owned());
            }
            rule.visit_children(self)
        }
    }
    let mut collector = Collector(Vec::new());
    let Ok(()) = sheet.visit(&mut collector);
    collector.0
}

/// Keyframes renames for one block: `name → name-<token>`.
pub(crate) struct Renames<'a> {
    /// `@keyframes` rules of this block to rename.
    pub definitions: &'a HashMap<String, String>,
    /// `animation`/`animation-name` references visible from this block.
    pub references: &'a HashMap<String, String>,
}

/// Applies `renames` (scoped blocks) and records the custom properties read via `var()`.
pub(crate) fn rewrite(
    sheet: &mut StyleSheet,
    renames: Option<Renames>,
    reads: &mut BTreeSet<String>,
) {
    let mut pass = Rewriter { renames, reads };
    let Ok(()) = sheet.visit(&mut pass);
}

struct Rewriter<'a> {
    renames: Option<Renames<'a>>,
    reads: &'a mut BTreeSet<String>,
}

impl<'i> Visitor<'i> for Rewriter<'_> {
    type Error = Infallible;

    fn visit_types(&self) -> VisitTypes {
        visit_types!(RULES | PROPERTIES | VARIABLES)
    }

    fn visit_rule(&mut self, rule: &mut CssRule<'i>) -> Result<(), Infallible> {
        if let (Some(renames), CssRule::Keyframes(keyframes)) = (&self.renames, &mut *rule)
            && let Some(renamed) = renames.definitions.get(keyframes_name(&keyframes.name))
        {
            keyframes.name = match keyframes.name {
                KeyframesName::Ident(_) => {
                    KeyframesName::Ident(CustomIdent(renamed.clone().into()))
                }
                KeyframesName::Custom(_) => KeyframesName::Custom(renamed.clone().into()),
            };
        }
        rule.visit_children(self)
    }

    fn visit_property(&mut self, property: &mut Property<'i>) -> Result<(), Infallible> {
        if let Some(renames) = &self.renames {
            match property {
                Property::Animation(animations, _) => {
                    for animation in animations.iter_mut() {
                        rename_animation(&mut animation.name, renames.references);
                    }
                }
                Property::AnimationName(names, _) => {
                    for name in names.iter_mut() {
                        rename_animation(name, renames.references);
                    }
                }
                _ => {}
            }
        }
        property.visit_children(self)
    }

    fn visit_variable(&mut self, variable: &mut Variable<'i>) -> Result<(), Infallible> {
        self.reads.insert(variable.name.ident.0.to_string());
        variable.visit_children(self)
    }
}

fn keyframes_name<'a>(name: &'a KeyframesName) -> &'a str {
    match name {
        KeyframesName::Ident(ident) => &ident.0,
        KeyframesName::Custom(string) => string,
    }
}

fn rename_animation(name: &mut AnimationName, references: &HashMap<String, String>) {
    match name {
        AnimationName::Ident(ident) => {
            if let Some(renamed) = references.get(ident.0.as_ref()) {
                *ident = CustomIdent(renamed.clone().into());
            }
        }
        AnimationName::String(string) => {
            if let Some(renamed) = references.get(string.0.as_ref()) {
                *string = CSSString(renamed.clone().into());
            }
        }
        AnimationName::None => {}
    }
}
