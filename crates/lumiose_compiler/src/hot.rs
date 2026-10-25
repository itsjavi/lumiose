//! Component-level hot updates in dev (TASK-146, `CompileOptions::hot`). Each component of a
//! client module is registered with `$hot(import.meta.hot, name, component, version)` from
//! `lumiose/dom`, which returns a stable wrapper: its instances re-render in place when a later
//! version of the module registers a different `version` of the component, so the rest of the
//! page keeps its state. The module accepts its own updates through `$hotAccept`, which falls back
//! to Vite's propagation (today's re-mount or reload) when the module's exports change shape or
//! are not all components.
//!
//! - `function Name` components are re-bound (`Name = $hot(…)`): function bindings are mutable,
//!   and exports follow them.
//! - `const Name = () => …` components become `let`, then re-bound the same way.
//! - Anonymous default exports and async components (whose `$async` mark `createComponent` reads)
//!   are not registered, so a module exporting one falls back.
//!
//! A component's version hashes its own source text and the module's code outside every
//! component (constants and helpers it may read), so an edit re-creates the instances of the
//! components it changed and of every component when shared code changed.

use std::collections::BTreeSet;
use std::hash::{DefaultHasher, Hash, Hasher};

use oxc_ast::ast::*;
use oxc_ast_visit::{VisitMut, walk_mut};

use crate::analyze::Analysis;
use crate::dev_source::DevSource;
use crate::scanner::StyleBlock;

/// What the footer needs, collected before codegen rewrites the program.
pub struct HotPlan {
    /// Registered components: (name, version, start offset).
    components: Vec<(String, String, u32)>,
    /// The module's export names, or `None` when they cannot be listed (`export *`).
    exports: Option<Vec<String>>,
    /// Starts of the `const` declarations to turn into `let`.
    lets: BTreeSet<u32>,
}

impl HotPlan {
    /// Plans the registration of `analysis`'s named components; `None` without components.
    /// `blocks` (the style blocks) are left out of the versions: a style-only edit stays CSS-only.
    pub fn new(
        program: &Program<'_>,
        analysis: &Analysis,
        source: &str,
        blocks: &[StyleBlock],
    ) -> Option<Self> {
        let text = |start: usize, end: usize| without_blocks(source, start, end, blocks);
        let mut named: Vec<(String, u32, u32)> = Vec::new();
        let mut lets = BTreeSet::new();
        for statement in &program.body {
            collect(statement, analysis, &mut named, &mut lets);
        }
        if named.is_empty() {
            return None;
        }
        // The module outside its components: a change there may affect any of them.
        let mut shared = String::with_capacity(source.len());
        let mut spans: Vec<(u32, u32)> = analysis
            .components
            .iter()
            .map(|c| (c.span.start, c.span.end))
            .collect();
        spans.sort_unstable();
        let mut cursor = 0usize;
        for (start, end) in spans {
            let start = (start as usize).max(cursor);
            shared.push_str(&text(cursor, start));
            cursor = (end as usize).max(cursor);
        }
        shared.push_str(&text(cursor, source.len()));
        let components = named
            .into_iter()
            .map(|(name, start, end)| {
                let mut hasher = DefaultHasher::new();
                shared.hash(&mut hasher);
                text(start as usize, end as usize).hash(&mut hasher);
                (name, format!("{:x}", hasher.finish()), start)
            })
            .collect();
        Some(Self {
            components,
            exports: export_names(program),
            lets,
        })
    }

    /// Turns the planned `const` component declarations into `let`, so they can be re-bound.
    pub fn apply(&self, program: &mut Program<'_>) {
        let mut lets = Lets(&self.lets);
        lets.visit_program(program);
    }

    /// The code appended to the module: the registrations and the accept handler. With `dev`
    /// (the inspector, `dev_source.rs`), each registration passes the component's location.
    pub fn footer(&self, dev: Option<(&DevSource, &str)>) -> String {
        let mut out = String::from(
            "\nimport { $hot as $$lumioseHot, $hotAccept as $$lumioseHotAccept } from \"lumiose/dom/hot\";\n",
        );
        for (name, version, start) in &self.components {
            let source = dev
                .map(|(dev, source)| format!(", {:?}", dev.at(source, *start)))
                .unwrap_or_default();
            out.push_str(&format!(
                "{name} = $$lumioseHot(import.meta.hot, {name:?}, {name}, {version:?}{source});\n"
            ));
        }
        let exports = match &self.exports {
            Some(names) => format!(
                "[{}]",
                names
                    .iter()
                    .map(|n| format!("{n:?}"))
                    .collect::<Vec<_>>()
                    .join(", ")
            ),
            None => "null".to_owned(),
        };
        out.push_str(&format!(
            "if (import.meta.hot) {{\n\t$$lumioseHotAccept(import.meta.hot, {exports});\n\timport.meta.hot.accept((next) => $$lumioseHotAccept(import.meta.hot, {exports}, next));\n}}\n"
        ));
        out
    }
}

/// `source[start..end]` without the style blocks in it.
fn without_blocks(source: &str, start: usize, end: usize, blocks: &[StyleBlock]) -> String {
    let mut out = String::new();
    let mut cursor = start;
    for block in blocks {
        let (block_start, block_end) = (block.span.start as usize, block.span.end as usize);
        if block_end <= cursor || block_start >= end {
            continue;
        }
        out.push_str(
            source
                .get(cursor..block_start.max(cursor))
                .unwrap_or_default(),
        );
        cursor = block_end.min(end);
    }
    out.push_str(source.get(cursor..end).unwrap_or_default());
    out
}

/// Collects the named components a top-level statement declares.
fn collect(
    statement: &Statement<'_>,
    analysis: &Analysis,
    named: &mut Vec<(String, u32, u32)>,
    lets: &mut BTreeSet<u32>,
) {
    let declaration = match statement {
        Statement::FunctionDeclaration(function) => {
            function_component(function, analysis, named);
            return;
        }
        Statement::VariableDeclaration(declaration) => declaration,
        Statement::ExportNamedDeclaration(_) => return,
        Statement::ExportDeclaration(export) => match &export.declaration {
            Declaration::FunctionDeclaration(function) => {
                function_component(function, analysis, named);
                return;
            }
            Declaration::VariableDeclaration(declaration) => declaration,
            _ => return,
        },
        Statement::ExportDefaultDeclaration(export) => {
            if let ExportDefaultDeclarationKind::FunctionDeclaration(function) = &export.declaration
            {
                function_component(function, analysis, named);
            }
            return;
        }
        _ => return,
    };
    if declaration.kind != VariableDeclarationKind::Const {
        return;
    }
    let mut any = false;
    for declarator in &declaration.declarations {
        let (BindingPattern::BindingIdentifier(id), Some(init)) =
            (&declarator.id, &declarator.init)
        else {
            continue;
        };
        let span = match init.without_parentheses() {
            Expression::ArrowFunctionExpression(arrow) => arrow.span,
            Expression::FunctionExpression(function) => function.span,
            _ => continue,
        };
        if analysis
            .component_at(span.start)
            .is_some_and(|c| !c.is_async)
        {
            named.push((id.name.to_string(), span.start, span.end));
            any = true;
        }
    }
    if any {
        lets.insert(declaration.span.start);
    }
}

fn function_component(
    function: &Function<'_>,
    analysis: &Analysis,
    named: &mut Vec<(String, u32, u32)>,
) {
    if let Some(id) = &function.id
        && analysis
            .component_at(function.span.start)
            .is_some_and(|c| !c.is_async)
    {
        named.push((id.name.to_string(), function.span.start, function.span.end));
    }
}

/// The module's export names; `None` with `export * from`.
pub(crate) fn export_names(program: &Program<'_>) -> Option<Vec<String>> {
    let mut names = Vec::new();
    for statement in &program.body {
        match statement {
            Statement::ExportAllDeclaration(_) => return None,
            Statement::ExportDefaultDeclaration(_) => names.push("default".to_owned()),
            Statement::ExportDeclaration(export) => match &export.declaration {
                Declaration::FunctionDeclaration(f) => {
                    names.extend(f.id.as_ref().map(|id| id.name.to_string()));
                }
                Declaration::ClassDeclaration(c) => {
                    names.extend(c.id.as_ref().map(|id| id.name.to_string()));
                }
                Declaration::VariableDeclaration(declaration) => {
                    for declarator in &declaration.declarations {
                        names.extend(
                            declarator
                                .id
                                .get_binding_identifiers()
                                .iter()
                                .map(|id| id.name.to_string()),
                        );
                    }
                }
                _ => {}
            },
            Statement::ExportNamedDeclaration(export) => {
                names.extend(
                    export
                        .specifiers
                        .iter()
                        .map(|s| s.exported.name().to_string()),
                );
            }
            Statement::ExportFromDeclaration(export) => {
                names.extend(
                    export
                        .specifiers
                        .iter()
                        .map(|s| s.exported.name().to_string()),
                );
            }
            _ => {}
        }
    }
    names.sort();
    names.dedup();
    Some(names)
}

struct Lets<'p>(&'p BTreeSet<u32>);

impl<'a> VisitMut<'a> for Lets<'_> {
    fn visit_variable_declaration(&mut self, it: &mut VariableDeclaration<'a>) {
        if self.0.contains(&it.span.start) {
            it.kind = VariableDeclarationKind::Let;
        }
        walk_mut::walk_variable_declaration(self, it);
    }
}
