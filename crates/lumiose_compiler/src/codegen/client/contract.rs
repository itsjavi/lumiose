//! The execution contract of each JSX expression (spec §5.1, TASK-63): whether the client code
//! re-runs it when what it reads changes (tracked), runs it once at creation (once, or untracked
//! when it opts out with `untrack`), or hands it to the runtime to call later (deferred: event
//! handlers, refs). The language server shows it in hovers (`CompileOptions::contract`).
//!
//! The classification mirrors client codegen: an expression is tracked when codegen's
//! `is_dynamic` holds once destructured props are rewritten to `props.x` reads.

use std::collections::HashSet;

use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_semantic::Scoping;
use oxc_span::GetSpan;
use oxc_syntax::scope::ScopeFlags;
use oxc_syntax::symbol::SymbolId;

use super::element::{attribute_name, is_custom_element, is_intrinsic, is_property, tag_name};
use super::events::{event_name, is_delegated};
use crate::analyze::reactivity::{PropsSymbols, reactive_reads};
use crate::analyze::{Analysis, is_jsx_like};
use crate::span::Span;

/// How the client runs an expression.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "lowercase")
)]
pub enum ContractKind {
    /// Re-run when a signal it reads changes.
    Tracked,
    /// Run once; `untrack(…)` opts it out of tracking.
    Untracked,
    /// Run once, at creation (it reads nothing reactive).
    Once,
    /// Called later by the runtime (an event handler, a ref).
    Deferred,
}

/// Where an expression sits.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "lowercase")
)]
pub enum ContractSite {
    Child,
    Attribute,
    Property,
    Class,
    Style,
    Prop,
    Event,
    Ref,
    Spread,
    Await,
}

/// One expression's contract.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct ContractEntry {
    /// The expression.
    pub span: Span,
    pub kind: ContractKind,
    pub site: ContractSite,
    /// The component it belongs to.
    pub component: Option<String>,
    /// The runtime helper or mechanism that runs it (`insert`, `setAttr`, `getter`, …).
    pub via: Option<String>,
    /// The reactive reads that make it tracked.
    pub reads: Vec<Span>,
}

/// The contract of every expression in the module's JSX (and each `await` of an async
/// component), by start offset. Entries nest: a hover takes the innermost one.
pub fn execution_contract(
    program: &Program<'_>,
    scoping: &Scoping,
    analysis: &Analysis,
    server_only: &HashSet<SymbolId>,
) -> Vec<ContractEntry> {
    let mut collector = Collector {
        scoping,
        analysis,
        server_only,
        no_props: PropsSymbols::default(),
        components: Vec::new(),
        entries: Vec::new(),
    };
    collector.visit_program(program);
    for component in &analysis.components {
        for site in &component.await_sites {
            collector.entries.push(ContractEntry {
                span: *site,
                kind: ContractKind::Once,
                site: ContractSite::Await,
                component: Some(component.name.clone()),
                via: Some("$await".to_owned()),
                reads: Vec::new(),
            });
        }
    }
    collector
        .entries
        .sort_by_key(|entry| (entry.span.start, std::cmp::Reverse(entry.span.end)));
    collector.entries
}

struct Collector<'s> {
    scoping: &'s Scoping,
    analysis: &'s Analysis,
    server_only: &'s HashSet<SymbolId>,
    no_props: PropsSymbols,
    /// Indices of the components being visited (innermost last).
    components: Vec<usize>,
    entries: Vec<ContractEntry>,
}

impl Collector<'_> {
    fn enter(&mut self, span_start: u32) -> bool {
        let index = self
            .analysis
            .components
            .iter()
            .position(|component| component.span.start == span_start);
        if let Some(index) = index {
            self.components.push(index);
        }
        index.is_some()
    }

    fn component(&self) -> Option<&crate::analyze::Component> {
        self.components
            .last()
            .map(|&index| &self.analysis.components[index])
    }

    /// Records a value expression: tracked when it reads reactive state, else once (untracked
    /// when it calls `untrack`).
    fn value(
        &mut self,
        expr: &Expression<'_>,
        site: ContractSite,
        tracked_via: &str,
        once_via: &str,
    ) {
        let props = self
            .component()
            .and_then(|component| component.props.as_ref())
            .unwrap_or(&self.no_props);
        let reads = reactive_reads(self.scoping, props, self.server_only, expr);
        let (dynamic, suspends) = super::dynamic_and_suspends(expr);
        let kind = if !suspends && (dynamic || !reads.is_empty()) {
            ContractKind::Tracked
        } else if calls_untrack(expr) {
            ContractKind::Untracked
        } else {
            ContractKind::Once
        };
        let via = if kind == ContractKind::Tracked {
            tracked_via
        } else {
            once_via
        };
        self.push(expr.span(), kind, site, via, reads);
    }

    fn push(
        &mut self,
        span: oxc_span::Span,
        kind: ContractKind,
        site: ContractSite,
        via: &str,
        reads: Vec<Span>,
    ) {
        let component = self.component().map(|component| component.name.clone());
        self.entries.push(ContractEntry {
            span: span.into(),
            kind,
            site,
            component,
            via: (!via.is_empty()).then(|| via.to_owned()),
            reads: if kind == ContractKind::Tracked {
                reads
            } else {
                Vec::new()
            },
        });
    }

    fn host_attribute(&mut self, name: &str, expr: &Expression<'_>, custom: bool) {
        match name {
            "key" => {}
            _ if name.starts_with("client:") => {}
            _ if custom && name.starts_with("bind:") => self.push(
                expr.span(),
                ContractKind::Tracked,
                ContractSite::Property,
                "bindProperty",
                Vec::new(),
            ),
            "class" => self.value(expr, ContractSite::Class, "setClass", "setClass"),
            "style" => self.value(expr, ContractSite::Style, "setStyle", "setStyle"),
            "ref" => self.push(
                expr.span(),
                ContractKind::Deferred,
                ContractSite::Ref,
                "useRef",
                Vec::new(),
            ),
            "attach" => self.push(
                expr.span(),
                ContractKind::Deferred,
                ContractSite::Ref,
                "attach",
                Vec::new(),
            ),
            "bind:value" | "bind:checked" => {
                let via = if name == "bind:value" {
                    "bindValue"
                } else {
                    "bindChecked"
                };
                self.push(
                    expr.span(),
                    ContractKind::Tracked,
                    ContractSite::Property,
                    via,
                    Vec::new(),
                );
            }
            _ if name.starts_with("on:") => {
                self.push(
                    expr.span(),
                    ContractKind::Deferred,
                    ContractSite::Event,
                    "listen",
                    Vec::new(),
                );
            }
            _ => match event_name(name) {
                Some(event) => {
                    let via = if is_delegated(&event) {
                        "delegateEvents"
                    } else {
                        "listen"
                    };
                    self.push(
                        expr.span(),
                        ContractKind::Deferred,
                        ContractSite::Event,
                        via,
                        Vec::new(),
                    );
                }
                None if is_property(name) => {
                    self.value(expr, ContractSite::Property, "setProp", "setProp");
                }
                None => self.value(expr, ContractSite::Attribute, "setAttr", "setAttr"),
            },
        }
    }

    fn children(&mut self, children: &[JSXChild<'_>], component_children: bool) {
        for child in children {
            let JSXChild::ExpressionContainer(container) = child else {
                continue;
            };
            let Some(expr) = container.expression.as_expression() else {
                continue;
            };
            if component_children {
                self.value(expr, ContractSite::Child, "getter", "");
            } else {
                self.value(expr, ContractSite::Child, child_helper(expr), "insert");
            }
        }
    }
}

impl<'a> Visit<'a> for Collector<'_> {
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

    fn visit_jsx_element(&mut self, it: &JSXElement<'a>) {
        let opening = &it.opening_element;
        let host = is_intrinsic(&opening.name);
        let custom = host && is_custom_element(&tag_name(&opening.name));
        for item in &opening.attributes {
            match item {
                JSXAttributeItem::SpreadAttribute(spread) => {
                    let via = if host { "spread" } else { "mergeProps" };
                    self.value(&spread.argument, ContractSite::Spread, via, via);
                }
                JSXAttributeItem::Attribute(attribute) => {
                    let Some(JSXAttributeValue::ExpressionContainer(container)) = &attribute.value
                    else {
                        continue;
                    };
                    let Some(expr) = container.expression.as_expression() else {
                        continue;
                    };
                    let name = attribute_name(&attribute.name);
                    if host {
                        self.host_attribute(&name, expr, custom);
                    } else if name.starts_with("bind:") {
                        // `x` reads the signal in a getter; `onXChange` writes it (decision-62).
                        self.push(
                            expr.span(),
                            ContractKind::Tracked,
                            ContractSite::Prop,
                            "getter",
                            Vec::new(),
                        );
                    } else if !name.starts_with("client:") && name != "key" {
                        self.value(expr, ContractSite::Prop, "getter", "");
                    }
                }
            }
        }
        self.children(&it.children, !host);
        walk::walk_jsx_element(self, it);
    }

    fn visit_jsx_fragment(&mut self, it: &JSXFragment<'a>) {
        self.children(&it.children, false);
        walk::walk_jsx_fragment(self, it);
    }
}

/// The runtime helper that inserts a tracked child.
fn child_helper(expr: &Expression<'_>) -> &'static str {
    match expr.without_parentheses() {
        Expression::ConditionalExpression(cond)
            if is_jsx_like(&cond.consequent) || is_jsx_like(&cond.alternate) =>
        {
            "branch"
        }
        Expression::LogicalExpression(logical) if is_jsx_like(&logical.right) => "branch",
        Expression::CallExpression(call) if matches!(&call.callee, Expression::StaticMemberExpression(member) if member.property.name == "map") => {
            "list"
        }
        _ => "insert",
    }
}

/// Whether `expr` calls `untrack` outside nested functions.
fn calls_untrack(expr: &Expression<'_>) -> bool {
    struct Finder(bool);
    impl<'a> Visit<'a> for Finder {
        fn visit_function(&mut self, _: &Function<'a>, _: ScopeFlags) {}
        fn visit_arrow_function_expression(&mut self, _: &ArrowFunctionExpression<'a>) {}
        fn visit_call_expression(&mut self, it: &CallExpression<'a>) {
            if matches!(&it.callee, Expression::Identifier(ident) if ident.name == "untrack") {
                self.0 = true;
            }
            walk::walk_call_expression(self, it);
        }
    }
    let mut finder = Finder(false);
    finder.visit_expression(expr);
    finder.0
}
