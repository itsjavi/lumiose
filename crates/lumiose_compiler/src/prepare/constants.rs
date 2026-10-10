//! `$name` constant folding (spec §4.6.4): evaluates the JS binding of each style reference to a
//! string or a number, on the masked AST and its `oxc_semantic` bindings.
//!
//! Statically evaluable means string/number literals, template literals of constants, `+ - * /
//! % **` and unary `-`/`+`, `as const` / `satisfies` / parentheses, object members (`$radius.lg`
//! through object literals, spreads and simple destructuring) and references to other constants,
//! including imported ones.
//!
//! **Imported constants come from the host** (the core crate does no I/O). An import is looked up
//! in [`CompileOptions::modules`](crate::CompileOptions) by `(importer, specifier)`; a module the
//! host has not supplied becomes a [`ModuleRequest`], and the host compiles again with it. Host
//! modules can import further modules the same way (`importer` is then the host module's id), so
//! re-exports and constants built from other modules' constants work transitively. Every host
//! module that was read is a CSS dependency (`cssDeps`).

use std::collections::{BTreeSet, HashMap};

use oxc_allocator::Allocator;
use oxc_ast::AstKind;
use oxc_ast::ast::*;
use oxc_parser::Parser;
use oxc_semantic::{Semantic, SemanticBuilder};
use oxc_span::SourceType;
use oxc_syntax::operator::{BinaryOperator, UnaryOperator};
use oxc_syntax::symbol::{SymbolFlags, SymbolId};

use crate::scanner::{self, FileKind};
use crate::span::Span;

/// A module the host loaded (or failed to load) for constant folding.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
#[cfg_attr(feature = "serde", serde(rename_all = "camelCase"))]
pub struct HostModule {
    /// The id of the importing module: the compiled file's id, or another host module's id.
    pub importer: String,
    /// The import specifier as written.
    pub specifier: String,
    /// `None` when the host cannot resolve or read the module.
    pub resolved: Option<ResolvedModule>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(feature = "serde", derive(serde::Serialize, serde::Deserialize))]
pub struct ResolvedModule {
    /// The resolved module id (a file path in Vite). Reported in `cssDeps`, and the importer of
    /// the module's own imports.
    pub id: String,
    pub source: String,
}

/// A module the compiler needs to fold an imported constant. The host resolves `specifier`
/// relative to `importer`, loads it and compiles again with it in `CompileOptions::modules`.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct ModuleRequest {
    pub importer: String,
    pub specifier: String,
}

/// A folded constant.
#[derive(Debug, Clone, PartialEq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(tag = "type", content = "value", rename_all = "camelCase")
)]
pub enum ConstValue {
    String(String),
    Number(f64),
}

/// Why a reference could not be folded.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum FoldError {
    /// A module is missing from the host modules (reported as a [`ModuleRequest`]).
    Pending,
    /// Not a constant (`LUM3008`). `declaration` points at the binding when it is in this file.
    NotConstant {
        reason: String,
        declaration: Option<Span>,
    },
    /// A member or export that does not exist; a spread or `export *` may still provide it.
    /// Reported like [`FoldError::NotConstant`].
    Missing(String),
}

impl FoldError {
    fn not_constant(reason: impl Into<String>) -> Self {
        Self::NotConstant {
            reason: reason.into(),
            declaration: None,
        }
    }
}

type Fold = Result<ConstValue, FoldError>;

/// The modules supplied by the host, keyed by `(importer, specifier)`.
pub struct HostModules<'h> {
    by_import: HashMap<(&'h str, &'h str), Option<&'h ResolvedModule>>,
}

impl<'h> HostModules<'h> {
    pub fn new(modules: &'h [HostModule]) -> Self {
        Self {
            by_import: modules
                .iter()
                .map(|m| {
                    (
                        (m.importer.as_str(), m.specifier.as_str()),
                        m.resolved.as_ref(),
                    )
                })
                .collect(),
        }
    }
}

enum Export<'p> {
    Local(SymbolId),
    Expression(&'p Expression<'p>),
    /// `export { a } from "./x"` (`imported` is `*` for `export * as a from`).
    From {
        specifier: String,
        imported: String,
    },
    NotConstant(&'static str),
}

struct Module<'s, 'p> {
    id: String,
    semantic: ModuleSemantic<'s, 'p>,
    /// Import binding → (specifier, imported name; `default`, `*` for namespaces).
    imports: HashMap<SymbolId, (String, String)>,
    exports: HashMap<String, Export<'p>>,
    /// `export * from` specifiers, in order.
    stars: Vec<String>,
    /// A JSON module: named exports are members of the default export.
    json: bool,
}

enum ModuleSemantic<'s, 'p> {
    Main(&'s Semantic<'p>),
    Host(Box<Semantic<'p>>),
}

impl<'p> ModuleSemantic<'_, 'p> {
    fn get(&self) -> &Semantic<'p> {
        match self {
            Self::Main(semantic) => semantic,
            Self::Host(semantic) => semantic,
        }
    }
}

/// Folds `$name` references of one compiled file.
pub struct Folder<'s, 'p, 'h> {
    allocator: &'p Allocator,
    hosts: &'s HostModules<'h>,
    modules: Vec<Module<'s, 'p>>,
    /// Host module id → index in `modules` (`None`: failed to parse).
    by_id: HashMap<String, Option<usize>>,
    stack: Vec<(usize, SymbolId)>,
    pub requests: BTreeSet<ModuleRequest>,
    /// Ids of the host modules read (CSS dependencies), in first-use order.
    pub deps: Vec<String>,
}

const MAX_DEPTH: usize = 64;
const SUPPORTED: &str = "only literals, template literals, arithmetic, `as const` objects and other constants can be inlined";

impl<'s, 'p, 'h> Folder<'s, 'p, 'h> {
    /// `main` must be built with nodes (`SemanticBuilder::with_build_nodes`) from `program`.
    pub fn new(
        allocator: &'p Allocator,
        program: &'p Program<'p>,
        main: &'s Semantic<'p>,
        filename: &str,
        hosts: &'s HostModules<'h>,
    ) -> Self {
        let module = index(filename, program, ModuleSemantic::Main(main), false);
        Self {
            allocator,
            hosts,
            modules: vec![module],
            by_id: HashMap::new(),
            stack: Vec::new(),
            requests: BTreeSet::new(),
            deps: Vec::new(),
        }
    }

    /// Folds the reference whose root resolves to `symbol` in the compiled file.
    pub fn fold(&mut self, symbol: SymbolId, path: &[String]) -> Fold {
        self.symbol(0, symbol, &path[1..])
            .map_err(|error| match error {
                FoldError::Missing(reason) => FoldError::NotConstant {
                    reason,
                    declaration: Some(self.semantic(0).scoping().symbol_span(symbol).into()),
                },
                error => error,
            })
    }

    fn semantic(&self, module: usize) -> &Semantic<'p> {
        self.modules[module].semantic.get()
    }

    fn symbol(&mut self, module: usize, symbol: SymbolId, path: &[String]) -> Fold {
        if self.stack.contains(&(module, symbol)) {
            return Err(FoldError::not_constant("its value refers to itself"));
        }
        if self.stack.len() > MAX_DEPTH {
            return Err(FoldError::not_constant(
                "its definition is nested too deeply",
            ));
        }
        self.stack.push((module, symbol));
        let result = self.symbol_inner(module, symbol, path);
        self.stack.pop();
        result.map_err(|error| match error {
            FoldError::NotConstant {
                reason,
                declaration: None,
            } if module == 0 => FoldError::NotConstant {
                reason,
                declaration: Some(self.semantic(0).scoping().symbol_span(symbol).into()),
            },
            error => error,
        })
    }

    fn symbol_inner(&mut self, module: usize, symbol: SymbolId, path: &[String]) -> Fold {
        if let Some((specifier, imported)) = self.modules[module].imports.get(&symbol).cloned() {
            let target = self.load(module, &specifier)?;
            return if imported == "*" {
                let Some((name, rest)) = path.split_first() else {
                    return Err(FoldError::not_constant(
                        "it is a namespace import; reference one of its exports",
                    ));
                };
                self.export(target, name, rest)
            } else {
                self.export(target, &imported, path)
            };
        }
        let semantic = self.semantic(module);
        let scoping = semantic.scoping();
        let flags = scoping.symbol_flags(symbol);
        let name = scoping.symbol_name(symbol).to_owned();
        if !flags.contains(SymbolFlags::ConstVariable) {
            let what = if flags.contains(SymbolFlags::FunctionScopedVariable) {
                "a `var` or a parameter"
            } else if flags.contains(SymbolFlags::BlockScopedVariable) {
                "a `let` binding"
            } else if flags.intersects(SymbolFlags::Function | SymbolFlags::Class) {
                "a function or a class"
            } else {
                "not a `const`"
            };
            return Err(FoldError::not_constant(format!("`{name}` is {what}")));
        }
        if scoping.symbol_is_mutated(symbol) {
            return Err(FoldError::not_constant(format!("`{name}` is reassigned")));
        }
        let node = scoping.symbol_declaration(symbol);
        let AstKind::VariableDeclarator(declarator) = semantic.nodes().kind(node) else {
            return Err(FoldError::not_constant(format!(
                "`{name}` is not a `const` declaration"
            )));
        };
        let Some(init) = &declarator.init else {
            return Err(FoldError::not_constant(format!(
                "`{name}` has no initializer"
            )));
        };
        let Some(mut prefix) = pattern_path(&declarator.id, symbol) else {
            return Err(FoldError::not_constant(format!(
                "`{name}` is destructured from an array or with a default value"
            )));
        };
        prefix.extend_from_slice(path);
        self.expression(module, init, &prefix)
    }

    fn export(&mut self, module: usize, name: &str, path: &[String]) -> Fold {
        let found = match self.modules[module].exports.get(name) {
            Some(Export::Local(symbol)) => Some(Ok(*symbol)),
            Some(Export::Expression(expression)) => {
                return self.expression(module, expression, path);
            }
            Some(Export::From {
                specifier,
                imported,
            }) => {
                let (specifier, imported) = (specifier.clone(), imported.clone());
                let target = self.load(module, &specifier)?;
                return if imported == "*" {
                    match path.split_first() {
                        Some((first, rest)) => self.export(target, first, rest),
                        None => Err(FoldError::not_constant(format!(
                            "`{name}` is a namespace; reference one of its exports"
                        ))),
                    }
                } else {
                    self.export(target, &imported, path)
                };
            }
            Some(Export::NotConstant(what)) => Some(Err(*what)),
            None => None,
        };
        match found {
            Some(Ok(symbol)) => self.symbol(module, symbol, path),
            Some(Err(what)) => Err(FoldError::not_constant(format!("`{name}` is {what}"))),
            None if self.modules[module].json && name != "default" => {
                let mut full = vec![name.to_owned()];
                full.extend_from_slice(path);
                self.export(module, "default", &full)
            }
            None => {
                for specifier in self.modules[module].stars.clone() {
                    let target = self.load(module, &specifier)?;
                    if self.modules[target].exports.contains_key(name)
                        || !self.modules[target].stars.is_empty()
                    {
                        match self.export(target, name, path) {
                            Err(FoldError::Missing(_)) => {}
                            result => return result,
                        }
                    }
                }
                Err(FoldError::Missing(format!(
                    "`{}` has no export `{name}`",
                    self.modules[module].id
                )))
            }
        }
    }

    fn expression(
        &mut self,
        module: usize,
        expression: &'p Expression<'p>,
        path: &[String],
    ) -> Fold {
        let expression = expression.get_inner_expression();
        match expression {
            Expression::ObjectExpression(object) => {
                let Some((name, rest)) = path.split_first() else {
                    return Err(FoldError::not_constant(
                        "it is an object; reference one of its members (`$name.member`)",
                    ));
                };
                self.member(module, object, name, rest)
            }
            Expression::Identifier(reference) => {
                let Some(symbol) = reference.reference_id.get().and_then(|id| {
                    self.semantic(module)
                        .scoping()
                        .get_reference(id)
                        .symbol_id()
                }) else {
                    return Err(FoldError::not_constant(format!(
                        "`{}` is not declared in this module",
                        reference.name
                    )));
                };
                self.symbol(module, symbol, path)
            }
            Expression::StaticMemberExpression(member) if !member.optional => {
                let mut full = vec![member.property.name.to_string()];
                full.extend_from_slice(path);
                self.expression(module, &member.object, &full)
            }
            Expression::ComputedMemberExpression(member) if !member.optional => {
                let key = match self.expression(module, &member.expression, &[])? {
                    ConstValue::String(key) => key,
                    ConstValue::Number(number) => js_number(number),
                };
                let mut full = vec![key];
                full.extend_from_slice(path);
                self.expression(module, &member.object, &full)
            }
            _ if !path.is_empty() => Err(FoldError::Missing(format!(
                "it has no member `{}`",
                path[0]
            ))),
            Expression::StringLiteral(literal) => Ok(ConstValue::String(literal.value.to_string())),
            Expression::NumericLiteral(literal) => Ok(ConstValue::Number(literal.value)),
            Expression::TemplateLiteral(template) => {
                let mut text = String::new();
                for (index, quasi) in template.quasis.iter().enumerate() {
                    let Some(cooked) = &quasi.value.cooked else {
                        return Err(FoldError::not_constant("a template has an invalid escape"));
                    };
                    text.push_str(cooked);
                    if let Some(expression) = template.expressions.get(index) {
                        match self.expression(module, expression, &[])? {
                            ConstValue::String(value) => text.push_str(&value),
                            ConstValue::Number(value) => text.push_str(&js_number(value)),
                        }
                    }
                }
                Ok(ConstValue::String(text))
            }
            Expression::UnaryExpression(unary) => {
                let value = self.number(module, &unary.argument)?;
                match unary.operator {
                    UnaryOperator::UnaryNegation => Ok(ConstValue::Number(-value)),
                    UnaryOperator::UnaryPlus => Ok(ConstValue::Number(value)),
                    _ => Err(FoldError::not_constant(SUPPORTED)),
                }
            }
            Expression::BinaryExpression(binary) => {
                let left = self.expression(module, &binary.left, &[])?;
                let right = self.expression(module, &binary.right, &[])?;
                binary_operation(binary.operator, left, right)
            }
            Expression::BooleanLiteral(_) => Err(FoldError::not_constant(
                "it is a boolean; CSS values are strings or numbers",
            )),
            Expression::NullLiteral(_) => Err(FoldError::not_constant("it is `null`")),
            Expression::ArrayExpression(_) => Err(FoldError::not_constant(
                "it is an array; array items cannot be referenced (`$arr.0` is not valid JS)",
            )),
            Expression::CallExpression(_) | Expression::NewExpression(_) => Err(
                FoldError::not_constant("it is computed by a call at runtime"),
            ),
            _ => Err(FoldError::not_constant(SUPPORTED)),
        }
    }

    fn number(&mut self, module: usize, expression: &'p Expression<'p>) -> Result<f64, FoldError> {
        match self.expression(module, expression, &[])? {
            ConstValue::Number(value) => Ok(value),
            ConstValue::String(_) => Err(FoldError::not_constant("a string is used in arithmetic")),
        }
    }

    fn member(
        &mut self,
        module: usize,
        object: &'p ObjectExpression<'p>,
        name: &str,
        rest: &[String],
    ) -> Fold {
        // Later properties win, like at runtime.
        for property in object.properties.iter().rev() {
            match property {
                ObjectPropertyKind::ObjectProperty(property) => {
                    let key = if property.computed {
                        match property.key.as_expression() {
                            Some(expression) => match self.expression(module, expression, &[]) {
                                Ok(ConstValue::String(key)) => Some(key),
                                Ok(ConstValue::Number(key)) => Some(js_number(key)),
                                Err(error) => return Err(error),
                            },
                            None => None,
                        }
                    } else {
                        property.key.static_name().map(|name| name.into_owned())
                    };
                    if key.as_deref() != Some(name) {
                        continue;
                    }
                    if property.kind != PropertyKind::Init || property.method {
                        return Err(FoldError::not_constant(format!(
                            "`{name}` is a getter, setter or method"
                        )));
                    }
                    return self.expression(module, &property.value, rest);
                }
                ObjectPropertyKind::SpreadProperty(spread) => {
                    let mut full = vec![name.to_owned()];
                    full.extend_from_slice(rest);
                    match self.expression(module, &spread.argument, &full) {
                        Err(FoldError::Missing(_)) => {}
                        result => return result,
                    }
                }
            }
        }
        Err(FoldError::Missing(format!("it has no member `{name}`")))
    }

    /// The module that `specifier` names from `importer`, once the host supplied it.
    fn load(&mut self, importer: usize, specifier: &str) -> Result<usize, FoldError> {
        let importer_id = self.modules[importer].id.clone();
        let Some(&supplied) = self.hosts.by_import.get(&(importer_id.as_str(), specifier)) else {
            self.requests.insert(ModuleRequest {
                importer: importer_id,
                specifier: specifier.to_owned(),
            });
            return Err(FoldError::Pending);
        };
        let Some(resolved) = supplied else {
            return Err(FoldError::not_constant(format!(
                "the module `{specifier}` could not be resolved"
            )));
        };
        if let Some(&index) = self.by_id.get(&resolved.id) {
            return index.ok_or_else(|| {
                FoldError::not_constant(format!("the module `{specifier}` could not be parsed"))
            });
        }
        if !self.deps.contains(&resolved.id) {
            self.deps.push(resolved.id.clone());
        }
        let parsed = self.parse(resolved);
        let index = parsed.map(|module| {
            self.modules.push(module);
            self.modules.len() - 1
        });
        self.by_id.insert(resolved.id.clone(), index);
        index.ok_or_else(|| {
            FoldError::not_constant(format!("the module `{specifier}` could not be parsed"))
        })
    }

    fn parse(&self, module: &ResolvedModule) -> Option<Module<'s, 'p>> {
        let path = module.id.split(['?', '#']).next().unwrap_or_default();
        let json = path.ends_with(".json");
        let text = if json {
            format!("export default (\n{}\n);", module.source)
        } else {
            match FileKind::from_path(path) {
                FileKind::Stsx => scanner::scan(&module.source, path).masked().to_owned(),
                _ => module.source.clone(),
            }
        };
        let source_type = if path.ends_with(".jsx") {
            SourceType::jsx()
        } else if path.ends_with(".js") || path.ends_with(".mjs") {
            SourceType::mjs()
        } else if path.ends_with(".tsx") || path.ends_with(".stsx") {
            SourceType::tsx()
        } else {
            SourceType::ts()
        };
        let text = self.allocator.alloc_str(&text);
        let parsed = Parser::new(self.allocator, text, source_type).parse();
        if parsed.fatal_error || !parsed.diagnostics.is_empty() {
            return None;
        }
        let program: &'p Program<'p> = self.allocator.alloc(parsed.program);
        let semantic = SemanticBuilder::new()
            .with_build_nodes(true)
            .build(program)
            .semantic;
        Some(index(
            &module.id,
            program,
            ModuleSemantic::Host(Box::new(semantic)),
            json,
        ))
    }
}

/// Imports and exports of a module.
fn index<'s, 'p>(
    id: &str,
    program: &'p Program<'p>,
    semantic: ModuleSemantic<'s, 'p>,
    json: bool,
) -> Module<'s, 'p> {
    let mut imports = HashMap::new();
    let mut exports = HashMap::new();
    let mut stars = Vec::new();
    let scoping = semantic.get().scoping();
    for statement in &program.body {
        match statement {
            Statement::ImportDeclaration(import) => {
                for specifier in import.specifiers.iter().flatten() {
                    let imported = match specifier {
                        ImportDeclarationSpecifier::ImportSpecifier(s) => {
                            s.imported.name().to_string()
                        }
                        ImportDeclarationSpecifier::ImportDefaultSpecifier(_) => {
                            "default".to_owned()
                        }
                        ImportDeclarationSpecifier::ImportNamespaceSpecifier(_) => "*".to_owned(),
                    };
                    if let Some(symbol) = specifier.local().symbol_id.get() {
                        imports.insert(symbol, (import.source.value.to_string(), imported));
                    }
                }
            }
            Statement::ExportDeclaration(export) => match &export.declaration {
                Declaration::VariableDeclaration(variables) => {
                    for declarator in &variables.declarations {
                        for id in declarator.id.get_binding_identifiers() {
                            if let Some(symbol) = id.symbol_id.get() {
                                exports.insert(id.name.to_string(), Export::Local(symbol));
                            }
                        }
                    }
                }
                Declaration::FunctionDeclaration(function) => {
                    if let Some(id) = &function.id {
                        exports.insert(id.name.to_string(), Export::NotConstant("a function"));
                    }
                }
                Declaration::ClassDeclaration(class) => {
                    if let Some(id) = &class.id {
                        exports.insert(id.name.to_string(), Export::NotConstant("a class"));
                    }
                }
                _ => {}
            },
            Statement::ExportNamedDeclaration(export) => {
                for specifier in &export.specifiers {
                    let local = specifier.local.name();
                    if let Some(symbol) = scoping.get_root_binding(local.as_str().into()) {
                        exports
                            .insert(specifier.exported.name().to_string(), Export::Local(symbol));
                    }
                }
            }
            Statement::ExportFromDeclaration(export) => {
                for specifier in &export.specifiers {
                    exports.insert(
                        specifier.exported.name().to_string(),
                        Export::From {
                            specifier: export.source.value.to_string(),
                            imported: specifier.local.name().to_string(),
                        },
                    );
                }
            }
            Statement::ExportAllDeclaration(export) => match &export.exported {
                Some(name) => {
                    exports.insert(
                        name.name().to_string(),
                        Export::From {
                            specifier: export.source.value.to_string(),
                            imported: "*".to_owned(),
                        },
                    );
                }
                None => stars.push(export.source.value.to_string()),
            },
            Statement::ExportDefaultDeclaration(export) => {
                let value = match &export.declaration {
                    ExportDefaultDeclarationKind::FunctionDeclaration(_) => {
                        Export::NotConstant("a function")
                    }
                    ExportDefaultDeclarationKind::ClassDeclaration(_) => {
                        Export::NotConstant("a class")
                    }
                    ExportDefaultDeclarationKind::TSInterfaceDeclaration(_) => {
                        Export::NotConstant("an interface")
                    }
                    declaration => match declaration.as_expression() {
                        Some(expression) => Export::Expression(expression),
                        None => Export::NotConstant("not an expression"),
                    },
                };
                exports.insert("default".to_owned(), value);
            }
            _ => {}
        }
    }
    Module {
        id: id.to_owned(),
        semantic,
        imports,
        exports,
        stars,
        json,
    }
}

/// The member path from a declarator's pattern to `symbol`: `[]` for `const a = …`, `["lg"]` for
/// `const { lg } = …`, `["a", "b"]` for `const { a: { b } } = …`. `None` for array patterns and
/// defaults.
fn pattern_path(pattern: &BindingPattern<'_>, symbol: SymbolId) -> Option<Vec<String>> {
    match pattern {
        BindingPattern::BindingIdentifier(id) => {
            (id.symbol_id.get() == Some(symbol)).then(Vec::new)
        }
        BindingPattern::ObjectPattern(object) => object.properties.iter().find_map(|property| {
            let key = if property.computed {
                None
            } else {
                property.key.static_name()
            }?;
            let mut rest = pattern_path(&property.value, symbol)?;
            rest.insert(0, key.into_owned());
            Some(rest)
        }),
        _ => None,
    }
}

fn binary_operation(operator: BinaryOperator, left: ConstValue, right: ConstValue) -> Fold {
    use ConstValue::{Number, String};
    match (operator, left, right) {
        (BinaryOperator::Addition, Number(a), Number(b)) => Ok(Number(a + b)),
        (BinaryOperator::Addition, a, b) => Ok(String(to_text(a) + &to_text(b))),
        (operator, Number(a), Number(b)) => match operator {
            BinaryOperator::Subtraction => Ok(Number(a - b)),
            BinaryOperator::Multiplication => Ok(Number(a * b)),
            BinaryOperator::Division => Ok(Number(a / b)),
            BinaryOperator::Remainder => Ok(Number(a % b)),
            BinaryOperator::Exponential => Ok(Number(a.powf(b))),
            _ => Err(FoldError::not_constant(SUPPORTED)),
        },
        _ => Err(FoldError::not_constant("a string is used in arithmetic")),
    }
}

fn to_text(value: ConstValue) -> String {
    match value {
        ConstValue::String(text) => text,
        ConstValue::Number(number) => js_number(number),
    }
}

/// `Number.prototype.toString()` for the values CSS constants use.
pub fn js_number(value: f64) -> String {
    if value.is_nan() {
        "NaN".to_owned()
    } else if value.is_infinite() {
        if value > 0.0 { "Infinity" } else { "-Infinity" }.to_owned()
    } else if value == 0.0 {
        "0".to_owned()
    } else {
        format!("{value}")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn numbers_print_like_javascript() {
        assert_eq!(js_number(4.0), "4");
        assert_eq!(js_number(-0.0), "0");
        assert_eq!(js_number(0.5), "0.5");
        assert_eq!(js_number(1.0 / 3.0), "0.3333333333333333");
        assert_eq!(js_number(f64::INFINITY), "Infinity");
    }
}
