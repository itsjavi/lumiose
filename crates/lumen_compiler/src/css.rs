//! The compiler side of the CSS pipeline (spec §4.6, decisions 12 and 14): scope tokens per
//! placement, element inventories for the unused-selector check, and the `lumen_css` call.
//!
//! - **Tokens.** A top-level block gives the file the token `scope_token(path)`; a block in a
//!   component's JSX gives that component `scope_token(path, name)`. `path` is the module id
//!   relative to the project root, so tokens are stable across machines. The codegen stamps
//!   `data-l-<token>` on every element of the scope's templates.
//! - **Inventories.** Per token, the tags, static classes and ids of the scope's intrinsic
//!   elements, plus the classes passed to components (class passthrough). Anything computed at
//!   runtime (dynamic `class`/`id`, spreads, refs and attachments that may edit classes) marks
//!   the kind dynamic, which turns `LUM3005` off for it.

use std::collections::{BTreeMap, HashMap, HashSet};

use lumen_css::{
    CssBlock, CssDiagnostic, CssInput, CssOutput, ElementInventory, RefValue, ResolvedRef, Scope,
    Targets, scope_attribute, scope_token,
};
use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_syntax::scope::ScopeFlags;

use crate::analyze::{Analysis, property_key_name};
use crate::codegen::client::ScopeTokens;
use crate::diagnostics::{Code, Diagnostic, Fix, Label, Severity, TextEdit};
use crate::prepare::{ConstValue, ResolvedStyleRef};
use crate::scanner::{Placement, StyleBlock};
use crate::span::Span;

/// CSS output options.
#[derive(Debug, Clone, Copy, Default)]
pub struct CssOptions {
    /// Browser targets for nesting lowering and prefixing; the default keeps modern syntax.
    pub targets: Targets,
    pub minify: bool,
}

/// The scopes of a file's blocks and the tokens the codegen stamps.
#[derive(Debug, Default)]
pub struct ScopePlan {
    pub tokens: ScopeTokens,
    /// One entry per extractable block (not SVG, not in an expression position, not outside
    /// every component).
    blocks: Vec<CssBlock>,
    /// Bare tokens (without `data-l-`) by attribute name, for the inventories.
    bare: HashMap<String, String>,
}

impl ScopePlan {
    pub fn new(blocks: &[StyleBlock], analysis: &Analysis, path: &str) -> Self {
        let mut plan = Self::default();
        for block in blocks {
            if block.svg {
                continue;
            }
            let scope = match &block.placement {
                Placement::Expression => continue,
                Placement::TopLevel if block.global => Scope::Global { component: None },
                Placement::TopLevel => {
                    let token = scope_token(path, None);
                    plan.tokens.file = Some(plan.register(&token));
                    Scope::File { token }
                }
                Placement::InJsx { .. } => {
                    // The innermost component around the block; a block outside every component
                    // is misplaced (`LUM3010`) and produces no CSS.
                    let Some(component) = analysis
                        .components
                        .iter()
                        .filter(|c| {
                            c.span.start <= block.span.start && block.span.end <= c.span.end
                        })
                        .min_by_key(|c| c.span.end - c.span.start)
                    else {
                        continue;
                    };
                    let name = component.name.clone();
                    if block.global {
                        Scope::Global {
                            component: Some(name),
                        }
                    } else {
                        let token = scope_token(path, Some(&name));
                        let attribute = plan.register(&token);
                        plan.tokens.components.insert(name.clone(), attribute);
                        Scope::Component { name, token }
                    }
                }
            };
            plan.blocks.push(CssBlock {
                content: lumen_css::Span::new(block.content.start, block.content.end),
                scope,
                svg: false,
            });
        }
        plan
    }

    fn register(&mut self, token: &str) -> String {
        let attribute = scope_attribute(token);
        self.bare.insert(attribute.clone(), token.to_owned());
        attribute
    }

    /// True when the file has CSS to process.
    pub fn has_css(&self) -> bool {
        !self.blocks.is_empty()
    }
}

/// Collects the element inventories of every scope token from the (type-stripped) program.
pub fn inventories(
    program: &Program<'_>,
    analysis: &Analysis,
    plan: &ScopePlan,
) -> Vec<ElementInventory> {
    if plan.bare.is_empty() {
        return Vec::new();
    }
    let mut collector = InventoryCollector {
        analysis,
        tokens: &plan.tokens,
        components: Vec::new(),
        inventories: BTreeMap::new(),
    };
    collector.visit_program(program);
    collector
        .inventories
        .into_iter()
        .filter_map(|(attribute, mut inventory)| {
            inventory.token = plan.bare.get(&attribute)?.clone();
            Some(inventory)
        })
        .collect()
}

/// Runs `lumen_css` over the file's blocks.
pub fn process(
    source: &str,
    filename: &str,
    plan: &ScopePlan,
    refs: &[ResolvedStyleRef],
    inventories: &[ElementInventory],
    options: &CssOptions,
    source_map: bool,
) -> (CssOutput, Vec<Diagnostic>) {
    let refs: Vec<ResolvedRef> = refs
        .iter()
        .filter_map(|reference| {
            let value = match reference.value.as_ref()? {
                ConstValue::String(value) => RefValue::String(value.clone()),
                ConstValue::Number(value) => RefValue::Number(*value),
            };
            Some(ResolvedRef {
                span: lumen_css::Span::new(reference.span.start, reference.span.end),
                value,
            })
        })
        .collect();
    let input = CssInput {
        filename,
        source,
        blocks: &plan.blocks,
        refs: &refs,
        inventories,
        // `LUM3012` needs every stylesheet of the app (a property set here is often read by
        // another file's CSS), so it is left to a project-wide check.
        custom_properties_set: &[],
    };
    let output = lumen_css::process(
        &input,
        &lumen_css::CssOptions {
            targets: options.targets,
            minify: options.minify,
            source_map,
        },
    );
    let diagnostics = output.diagnostics.iter().filter_map(convert).collect();
    (output, diagnostics)
}

/// Start offsets of hyphenated references (`$brand-primary`): `lumen_css` reports them
/// (`LUM3009`), so they are neither folded nor reported as non-constant.
pub fn hyphenated_refs(source: &str, blocks: &[StyleBlock]) -> HashSet<u32> {
    let mut starts = HashSet::new();
    for block in blocks {
        if block.svg || block.refs.is_empty() {
            continue;
        }
        let Some(css) = source.get(block.content.start as usize..block.content.end as usize) else {
            continue;
        };
        for site in lumen_css::find_refs(css) {
            if site.hyphenated.is_some() {
                starts.insert(block.content.start + site.range.start as u32);
            }
        }
    }
    starts
}

fn convert(diagnostic: &CssDiagnostic) -> Option<Diagnostic> {
    let code = Code::from_id(diagnostic.code.id())?;
    let span = |span: lumen_css::Span| Span::new(span.start, span.end);
    Some(Diagnostic {
        code,
        severity: match diagnostic.severity {
            lumen_css::Severity::Error => Severity::Error,
            lumen_css::Severity::Warning => Severity::Warning,
            lumen_css::Severity::Hint => Severity::Hint,
        },
        message: diagnostic.message.clone(),
        span: span(diagnostic.span),
        labels: diagnostic
            .labels
            .iter()
            .map(|label| Label {
                span: span(label.span),
                message: label.message.clone(),
            })
            .collect(),
        help: diagnostic.help.clone(),
        fix: diagnostic.fix.as_ref().map(|fix| Fix {
            message: fix.message.clone(),
            edits: fix
                .edits
                .iter()
                .map(|edit| TextEdit {
                    span: span(edit.span),
                    text: edit.text.clone(),
                })
                .collect(),
        }),
    })
}

struct InventoryCollector<'o> {
    analysis: &'o Analysis,
    tokens: &'o ScopeTokens,
    /// Names of the components being visited (innermost last).
    components: Vec<String>,
    /// By attribute name (`data-l-…`).
    inventories: BTreeMap<String, ElementInventory>,
}

/// What a JSX element contributes to the inventories of its scope.
#[derive(Default)]
struct Contribution {
    tag: Option<String>,
    classes: Vec<String>,
    component_classes: Vec<String>,
    ids: Vec<String>,
    dynamic_classes: bool,
    dynamic_ids: bool,
}

impl InventoryCollector<'_> {
    fn scope_attributes(&self) -> Vec<&String> {
        let mut attributes: Vec<&String> = self.tokens.file.iter().collect();
        if let Some(name) = self.components.last()
            && let Some(attribute) = self.tokens.components.get(name)
        {
            attributes.push(attribute);
        }
        attributes
    }

    fn record(&mut self, contribution: &Contribution) {
        let attributes: Vec<String> = self.scope_attributes().into_iter().cloned().collect();
        for attribute in attributes {
            let inventory = self.inventories.entry(attribute).or_default();
            if let Some(tag) = &contribution.tag {
                inventory.tags.insert(tag.to_ascii_lowercase());
            }
            inventory
                .classes
                .extend(contribution.classes.iter().cloned());
            inventory
                .component_classes
                .extend(contribution.component_classes.iter().cloned());
            inventory.ids.extend(contribution.ids.iter().cloned());
            inventory.dynamic_classes |= contribution.dynamic_classes;
            inventory.dynamic_ids |= contribution.dynamic_ids;
        }
    }

    fn enter(&mut self, span_start: u32) -> bool {
        match self.analysis.component_at(span_start) {
            Some(component) => {
                self.components.push(component.name.clone());
                true
            }
            None => false,
        }
    }
}

impl<'a> Visit<'a> for InventoryCollector<'_> {
    fn visit_function(&mut self, it: &Function<'a>, flags: ScopeFlags) {
        let entered = self.enter(it.span.start);
        walk::walk_function(self, it, flags);
        if entered {
            self.components.pop();
        }
    }

    fn visit_arrow_function_expression(&mut self, it: &ArrowFunctionExpression<'a>) {
        let entered = self.enter(it.span.start);
        walk::walk_arrow_function_expression(self, it);
        if entered {
            self.components.pop();
        }
    }

    fn visit_jsx_opening_element(&mut self, it: &JSXOpeningElement<'a>) {
        let intrinsic = crate::codegen::client::is_intrinsic(&it.name);
        let mut contribution = Contribution {
            tag: intrinsic.then(|| crate::codegen::client::tag_name(&it.name)),
            ..Contribution::default()
        };
        for attribute in &it.attributes {
            match attribute {
                JSXAttributeItem::SpreadAttribute(_) => {
                    contribution.dynamic_classes = true;
                    contribution.dynamic_ids = true;
                }
                JSXAttributeItem::Attribute(attribute) => {
                    let JSXAttributeName::Identifier(name) = &attribute.name else {
                        continue;
                    };
                    match name.name.as_str() {
                        "class" => {
                            let mut classes = Vec::new();
                            let dynamic = !static_classes(attribute.value.as_ref(), &mut classes);
                            contribution.dynamic_classes |= dynamic;
                            if intrinsic {
                                contribution.classes.extend(classes);
                            } else {
                                contribution.component_classes.extend(classes);
                            }
                        }
                        "id" if intrinsic => {
                            let mut ids = Vec::new();
                            contribution.dynamic_ids |=
                                !static_strings(attribute.value.as_ref(), &mut ids);
                            contribution.ids.extend(ids);
                        }
                        // Code that receives the element may change its classes.
                        "ref" | "attach" if intrinsic => contribution.dynamic_classes = true,
                        _ => {}
                    }
                }
            }
        }
        self.record(&contribution);
        walk::walk_jsx_opening_element(self, it);
    }
}

/// Adds the class names of a `class` value to `out`; false when part of it is computed at
/// runtime.
fn static_classes(value: Option<&JSXAttributeValue<'_>>, out: &mut Vec<String>) -> bool {
    match value {
        None => true,
        Some(JSXAttributeValue::StringLiteral(literal)) => {
            out.extend(literal.value.split_whitespace().map(str::to_owned));
            true
        }
        Some(JSXAttributeValue::ExpressionContainer(container)) => {
            match container.expression.as_expression() {
                Some(expression) => class_expression(expression, out),
                None => true,
            }
        }
        Some(_) => false,
    }
}

fn class_expression(expression: &Expression<'_>, out: &mut Vec<String>) -> bool {
    match expression.get_inner_expression() {
        Expression::ObjectExpression(object) => {
            object.properties.iter().all(|property| match property {
                ObjectPropertyKind::ObjectProperty(property) if !property.computed => {
                    match property_key_name(&property.key) {
                        Some(key) => {
                            out.extend(key.split_whitespace().map(str::to_owned));
                            true
                        }
                        None => false,
                    }
                }
                _ => false,
            })
        }
        Expression::ArrayExpression(array) => array.elements.iter().all(|element| {
            element
                .as_expression()
                .is_some_and(|expression| class_expression(expression, out))
        }),
        expression => string_leaves(expression, &mut |text| {
            out.extend(text.split_whitespace().map(str::to_owned));
        }),
    }
}

fn static_strings(value: Option<&JSXAttributeValue<'_>>, out: &mut Vec<String>) -> bool {
    match value {
        None => true,
        Some(JSXAttributeValue::StringLiteral(literal)) => {
            out.push(literal.value.to_string());
            true
        }
        Some(JSXAttributeValue::ExpressionContainer(container)) => {
            match container.expression.as_expression() {
                Some(expression) => {
                    string_leaves(expression, &mut |text| out.push(text.to_owned()))
                }
                None => true,
            }
        }
        Some(_) => false,
    }
}

/// Calls `f` with every string a conditional/logical expression of literals can produce; false
/// when a leaf is computed at runtime. `false`, `null` and `undefined` leaves add nothing.
fn string_leaves(expression: &Expression<'_>, f: &mut impl FnMut(&str)) -> bool {
    match expression.get_inner_expression() {
        Expression::StringLiteral(literal) => {
            f(&literal.value);
            true
        }
        Expression::TemplateLiteral(template) if template.expressions.is_empty() => {
            template
                .quasis
                .iter()
                .filter_map(|quasi| quasi.value.cooked.as_ref())
                .for_each(|text| f(text));
            true
        }
        Expression::ConditionalExpression(conditional) => {
            string_leaves(&conditional.consequent, f) && string_leaves(&conditional.alternate, f)
        }
        // `cond && "a"`: the condition is not a class; `a || "b"` / `a ?? "b"` may be `a`.
        Expression::LogicalExpression(logical) if logical.operator.is_and() => {
            string_leaves(&logical.right, f)
        }
        Expression::LogicalExpression(logical) => {
            string_leaves(&logical.left, f) && string_leaves(&logical.right, f)
        }
        Expression::BooleanLiteral(literal) => !literal.value,
        Expression::NullLiteral(_) => true,
        Expression::Identifier(identifier) => identifier.name == "undefined",
        _ => false,
    }
}
