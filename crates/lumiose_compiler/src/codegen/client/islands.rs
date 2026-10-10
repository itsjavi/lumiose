//! Island call sites (decision-9, spec §7.2, contract doc-2 §5.5).
//!
//! `<X client:visible ids={ids}>{children}</X>` compiles on the server to
//! `island(ref, X, props, "visible", value?, slots?)`, where `ref` is `<module>#<export>` naming
//! the module that defines `X` by a machine-independent id (root-relative when the project root
//! is known, package-relative in a listed package; crate::module_id), `props` is the
//! data-only props object and JSX-valued props plus `children` are lazy `slots`. On the client,
//! `client:*` is type-only: the element compiles like any component call (an island renders
//! nested islands inline) and the island is reached through the island manifest. Both targets
//! report the call site in `CompileMeta.islands`, and `LUM4001` when `X` is not a module export.

use std::collections::HashMap;

use oxc_allocator::ArenaVec;
use oxc_ast::ast::*;
use oxc_semantic::Scoping;
use oxc_span::{GetSpan, Span};
use oxc_syntax::symbol::SymbolId;

use super::element::{AttrValue, attr_value, attribute_name};
use super::{Codegen, Compiled};
use crate::IslandMeta;
use crate::analyze::is_jsx_like;
use crate::analyze::reactivity::symbol_of;
use crate::diagnostics::{Code, Diagnostic};
use crate::module_id;

/// Hydration strategies (`client:<strategy>`).
const STRATEGIES: &[&str] = &["load", "idle", "visible", "media", "only"];

/// The module's imports and local exports, by binding.
#[derive(Default)]
pub struct ModuleBindings {
    /// Local binding → (module specifier, imported name; `"default"`, `"*"` for namespaces).
    imports: HashMap<SymbolId, (String, String)>,
    /// Local binding → its first exported name.
    exports: HashMap<SymbolId, String>,
}

impl ModuleBindings {
    pub fn collect(program: &Program<'_>, scoping: &Scoping) -> Self {
        let mut bindings = Self::default();
        let mut export = |symbol: Option<SymbolId>, name: &str| {
            if let Some(symbol) = symbol {
                bindings
                    .exports
                    .entry(symbol)
                    .or_insert_with(|| name.to_owned());
            }
        };
        let mut imports = HashMap::new();
        for statement in &program.body {
            match statement {
                Statement::ImportDeclaration(import) => {
                    let source = import.source.value.to_string();
                    for specifier in import.specifiers.iter().flatten() {
                        let (local, imported) = match specifier {
                            ImportDeclarationSpecifier::ImportSpecifier(s) => {
                                (&s.local, s.imported.name().to_string())
                            }
                            ImportDeclarationSpecifier::ImportDefaultSpecifier(s) => {
                                (&s.local, "default".to_owned())
                            }
                            ImportDeclarationSpecifier::ImportNamespaceSpecifier(s) => {
                                (&s.local, "*".to_owned())
                            }
                        };
                        if let Some(symbol) = local.symbol_id.get() {
                            imports.insert(symbol, (source.clone(), imported));
                        }
                    }
                }
                Statement::ExportDeclaration(declaration) => match &declaration.declaration {
                    Declaration::FunctionDeclaration(function) => {
                        if let Some(id) = &function.id {
                            export(id.symbol_id.get(), &id.name);
                        }
                    }
                    Declaration::ClassDeclaration(class) => {
                        if let Some(id) = &class.id {
                            export(id.symbol_id.get(), &id.name);
                        }
                    }
                    Declaration::VariableDeclaration(variables) => {
                        for declarator in &variables.declarations {
                            for id in declarator.id.get_binding_identifiers() {
                                export(id.symbol_id.get(), &id.name);
                            }
                        }
                    }
                    _ => {}
                },
                Statement::ExportNamedDeclaration(named) => {
                    for specifier in &named.specifiers {
                        if let ModuleExportName::IdentifierReference(local) = &specifier.local {
                            export(symbol_of(scoping, local), &specifier.exported.name());
                        }
                    }
                }
                Statement::ExportDefaultDeclaration(default) => match &default.declaration {
                    ExportDefaultDeclarationKind::FunctionDeclaration(function) => {
                        export(
                            function.id.as_ref().and_then(|id| id.symbol_id.get()),
                            "default",
                        );
                    }
                    ExportDefaultDeclarationKind::ClassDeclaration(class) => {
                        export(
                            class.id.as_ref().and_then(|id| id.symbol_id.get()),
                            "default",
                        );
                    }
                    ExportDefaultDeclarationKind::Identifier(ident) => {
                        export(symbol_of(scoping, ident), "default");
                    }
                    _ => {}
                },
                _ => {}
            }
        }
        bindings.imports = imports;
        bindings
    }
}

/// A `client:*` directive.
pub struct Directive<'a> {
    strategy: String,
    value: AttrValue<'a>,
}

impl<'a> Codegen<'a, '_> {
    /// Removes the `client:*` directive of a component element. Unknown or repeated directives
    /// are reported (LUM1002) and ignored.
    pub(super) fn take_island_directive(
        &mut self,
        attributes: &mut ArenaVec<'a, JSXAttributeItem<'a>>,
    ) -> Option<Directive<'a>> {
        let mut directive = None;
        let mut index = 0;
        while index < attributes.len() {
            let JSXAttributeItem::Attribute(attribute) = &attributes[index] else {
                index += 1;
                continue;
            };
            let name = attribute_name(&attribute.name);
            let Some(strategy) = name.strip_prefix("client:") else {
                index += 1;
                continue;
            };
            let span = attribute.span;
            let strategy = strategy.to_owned();
            let JSXAttributeItem::Attribute(attribute) = attributes.remove(index) else {
                unreachable!("an attribute")
            };
            if !STRATEGIES.contains(&strategy.as_str()) {
                self.diagnostics.push(
                    Diagnostic::new(
                        Code::Unsupported,
                        span.into(),
                        format!("unknown island directive `client:{strategy}`"),
                    )
                    .with_help("Use client:load, client:idle, client:visible, client:media or client:only."),
                );
            } else if directive.is_some() {
                self.diagnostics.push(Diagnostic::new(
                    Code::Unsupported,
                    span.into(),
                    "an island takes one `client:*` directive",
                ));
            } else {
                directive = Some(Directive {
                    strategy,
                    value: attr_value(attribute.unbox().value),
                });
            }
        }
        directive
    }

    /// A component element with a `client:*` directive.
    pub(super) fn compile_island(
        &mut self,
        opening: JSXOpeningElement<'a>,
        children: ArenaVec<'a, JSXChild<'a>>,
        directive: Directive<'a>,
        span: Span,
    ) -> Compiled<'a> {
        let name_span = opening.name.span();
        let reference = self.island_reference(&opening.name);
        let resolved = match reference {
            Ok((module, export)) => {
                let reference = format!("{}#{export}", module.reference);
                self.islands.push(IslandMeta {
                    reference: reference.clone(),
                    module: module.import,
                    export,
                    strategy: directive.strategy.clone(),
                    span: name_span.into(),
                });
                Some(reference)
            }
            Err(message) => {
                self.diagnostics.push(
                    Diagnostic::new(Code::NonExportedIsland, name_span.into(), message)
                        .with_help("Islands are imported by the browser: export the component from its module (or import it from the module that exports it)."),
                );
                None
            }
        };
        let component = self.component_reference(opening.name, span);
        let (Some(reference), true) = (resolved, self.server()) else {
            // Client (`client:*` is type-only) or an unresolvable island: a component call.
            let props = self.props_expression(opening.attributes, Some(children), span);
            let callee = self.runtime("createComponent", span);
            return Compiled::value(self.ast.call(span, callee, [component, props]));
        };

        // Server: JSX-valued props and children are slots; the rest is serialized data.
        let mut attributes = opening.attributes;
        let mut slots = Vec::new();
        let mut index = 0;
        while index < attributes.len() {
            let is_slot = matches!(&attributes[index], JSXAttributeItem::Attribute(a) if is_jsx_valued(&a.value));
            if !is_slot {
                index += 1;
                continue;
            }
            let JSXAttributeItem::Attribute(attribute) = attributes.remove(index) else {
                unreachable!("an attribute")
            };
            let attribute = attribute.unbox();
            let name = attribute_name(&attribute.name);
            if let AttrValue::Expr(expr) = attr_value(attribute.value) {
                let compiled = self.compile_value(expr);
                let slot =
                    self.ast
                        .arrow_returning(attribute.span, &[], compiled.setup, compiled.value);
                slots.push(self.ast.property(attribute.span, &name, slot));
            }
        }
        let items = self.child_items(children);
        if let Some(compiled) = self.compile_fragment_items(items, span, true) {
            let slot = self
                .ast
                .arrow_returning(span, &[], compiled.setup, compiled.value);
            slots.push(self.ast.property(span, "children", slot));
        }
        let props = self.props_expression(attributes, Some(self.ast.vec()), span);
        let mut args = vec![
            self.ast.string(span, &reference),
            component,
            props,
            self.ast.string(span, &directive.strategy),
        ];
        let value = match directive.value {
            AttrValue::Str(value) => Some(self.ast.string(span, &value)),
            AttrValue::Expr(expr) => Some(self.visited(expr)),
            AttrValue::True | AttrValue::Empty => None,
        };
        if value.is_some() || !slots.is_empty() {
            args.push(value.unwrap_or_else(|| self.ast.undefined(span)));
        }
        if !slots.is_empty() {
            args.push(self.ast.object(span, slots));
        }
        let callee = self.runtime("island", span);
        Compiled::value(self.ast.call(span, callee, args))
    }

    /// `(module, export)` of an island component, or why it has none.
    fn island_reference(
        &self,
        name: &JSXElementName<'a>,
    ) -> Result<(IslandModule, String), String> {
        let not_exported = |name: &str| {
            format!(
                "the island component `{name}` is not exported, so the browser cannot import it"
            )
        };
        match name {
            JSXElementName::IdentifierReference(ident) => {
                let symbol = self
                    .symbol_of(ident)
                    .ok_or_else(|| not_exported(&ident.name))?;
                if let Some((source, imported)) = self.bindings.imports.get(&symbol) {
                    if imported == "*" {
                        return Err(format!("`{}` is a namespace, not a component", ident.name));
                    }
                    return Ok((self.island_module(Some(source)), imported.clone()));
                }
                match self.bindings.exports.get(&symbol) {
                    Some(export) => Ok((self.island_module(None), export.clone())),
                    None => Err(not_exported(&ident.name)),
                }
            }
            JSXElementName::MemberExpression(member) => {
                if let JSXMemberExpressionObject::IdentifierReference(object) = &member.object
                    && let Some(symbol) = self.symbol_of(object)
                    && let Some((source, imported)) = self.bindings.imports.get(&symbol)
                    && imported == "*"
                {
                    return Ok((
                        self.island_module(Some(source)),
                        member.property.name.to_string(),
                    ));
                }
                Err(format!(
                    "the island component `{}` is not an import or an export of this module",
                    super::element::tag_name(name)
                ))
            }
            other => Err(not_exported(&super::element::tag_name(other))),
        }
    }

    /// The module an island component comes from: this module (`None`) or an import specifier.
    /// Relative specifiers resolve against this module's id.
    fn island_module(&self, specifier: Option<&str>) -> IslandModule {
        let file = module_id::clean_id(self.options.filename);
        let id = match specifier {
            None => file,
            Some(specifier) if specifier.starts_with("./") || specifier.starts_with("../") => {
                resolve_relative(&file, specifier)
            }
            Some(bare) => {
                return IslandModule {
                    import: bare.to_owned(),
                    reference: bare.to_owned(),
                };
            }
        };
        let (root, packages) = (self.options.root, self.options.packages);
        IslandModule {
            // Bundling replaces an absolute id with a chunk, so it never reaches the HTML.
            import: match root.and_then(|root| module_id::within(&id, root)) {
                Some(rest) => rest.to_owned(),
                None => id.clone(),
            },
            reference: module_id::stable_id(&id, root, packages),
        }
    }
}

/// How the browser imports an island's module, and how its ref names it.
struct IslandModule {
    /// Root-relative (`/src/x.stsx`), the absolute id, or a bare specifier.
    import: String,
    /// Root-relative, package-relative (`@acme/ui/src/Nav.stsx`), or as `import`.
    reference: String,
}

/// `specifier` (`./x`, `../x`) resolved against the module id `base`.
fn resolve_relative(base: &str, specifier: &str) -> String {
    let mut segments: Vec<&str> = base.split('/').collect();
    segments.pop();
    for segment in specifier.split('/') {
        match segment {
            "." => {}
            ".." => {
                if segments.len() > 1 {
                    segments.pop();
                }
            }
            segment => segments.push(segment),
        }
    }
    segments.join("/")
}

/// A prop rendered on the server as a slot: a JSX element or fragment, or a conditional of JSX.
fn is_jsx_valued(value: &Option<JSXAttributeValue<'_>>) -> bool {
    match value {
        Some(JSXAttributeValue::Element(_) | JSXAttributeValue::Fragment(_)) => true,
        Some(JSXAttributeValue::ExpressionContainer(container)) => container
            .expression
            .as_expression()
            .is_some_and(is_jsx_like),
        _ => false,
    }
}
