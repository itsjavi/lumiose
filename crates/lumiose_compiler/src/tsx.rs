//! TSX for other JSX frameworks (`@lumiose/stsx`, decision-86): a `.stsx` file as the TSX the
//! framework's own JSX transform compiles, plus its stylesheet.
//!
//! The output is the source with edits, so everything else (types, JSX semantics, comments) is
//! the framework's:
//! - **Blocks.** `<style>` blocks are removed; SVG blocks stay (they are native SVG CSS).
//! - **Markers** (`scopedStyles`, decision-85). Intrinsic elements get their scopes' markers:
//!   attributes after the tag name (`data-lum-<hash>=""`), or classes merged into the
//!   [`TsxOptions::class_attribute`] (`className` for React, `class` for Solid): appended to a
//!   string, joined with a computed value (`[value, "lum-<hash>"].filter(Boolean).join(" ")`), or
//!   added. An element with spreads and no class of its own gets one after the last spread that
//!   keeps the spreads' class when every spread is a plain reference, else before the first one.
//! - **Class passthrough** (class strategy only): a component element given the class attribute
//!   gets the caller's scope classes appended to it, so a component that forwards it receives
//!   them. With attributes there is no passthrough; `:deep()` reaches child components.
//! - **CSS** comes from `lumiose_css` as in [`crate::compile`], with the unused-selector inventory
//!   reading the class attribute. Only scanner, syntax and style diagnostics are reported: the
//!   framework's semantics are not Lumiose's.
//! - **Source map.** Unchanged text maps to itself (at each line start and word start); inserted
//!   text maps to the position it was inserted at.

use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use oxc_ast_visit::{Visit, walk};
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_span::{GetSpan, SourceType};
use oxc_syntax::scope::ScopeFlags;

use crate::analyze::{self, Analysis};
use crate::codegen::ast::Ast;
use crate::codegen::client::{ScopeTokens, is_intrinsic};
use crate::css::{self, CssOptions, ScopePlan};
use crate::diagnostics::{Code, Diagnostic};
use crate::module_id::PackageRoot;
use crate::prepare::{self, HostModule, ModuleRequest};
use crate::scanner;

#[derive(Debug, Clone)]
pub struct TsxOptions {
    /// `targets`, `minify` and `scoped` (decision-85).
    pub css: CssOptions,
    /// Produce [`TsxResult::map`] and [`TsxResult::css_map`].
    pub source_map: bool,
    /// The project root and linked packages: scope tokens hash the module path relative to them.
    pub root: Option<String>,
    pub packages: Vec<PackageRoot>,
    /// Modules answering earlier [`TsxResult::module_requests`].
    pub modules: Vec<HostModule>,
    /// The attribute that holds classes: `className` (React, Preact) or `class` (Solid).
    pub class_attribute: String,
    /// When the file has CSS, `import "<specifier>";` goes first (after directives).
    pub style_import: Option<String>,
}

impl Default for TsxOptions {
    fn default() -> Self {
        Self {
            css: CssOptions::default(),
            source_map: true,
            root: None,
            packages: Vec::new(),
            modules: Vec::new(),
            class_attribute: "className".to_owned(),
            style_import: None,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct TsxResult {
    /// The TSX; empty when the source could not be parsed.
    pub code: String,
    /// Source map v3 JSON from `code` to the source.
    pub map: Option<String>,
    /// The stylesheet; `None` without style blocks or while `module_requests` is not empty.
    pub css: Option<String>,
    pub css_map: Option<String>,
    /// Ids of the modules imported constants were folded from.
    pub css_deps: Vec<String>,
    /// Modules needed to fold imported constants: compile again with them in `modules`.
    pub module_requests: Vec<ModuleRequest>,
    /// Scanner, syntax and style (`LUM3xxx`) diagnostics; spans are byte offsets.
    pub diagnostics: Vec<Diagnostic>,
    /// The markers stamped per scope.
    pub scope_tokens: ScopeTokens,
}

impl TsxResult {
    pub fn map_spans(&mut self, f: &impl Fn(u32) -> u32) {
        for diagnostic in &mut self.diagnostics {
            diagnostic.map_spans(f);
        }
        for subtrees in self.scope_tokens.components.values_mut() {
            for subtree in subtrees {
                subtree.span = subtree.span.map(f);
            }
        }
    }
}

/// Compiles a `.stsx` module to TSX and CSS for another JSX framework.
pub fn compile_tsx(source: &str, filename: &str, options: &TsxOptions) -> TsxResult {
    let scan = scanner::scan(source, filename);
    let mut diagnostics = scan.diagnostics.clone();
    if let Some(span) = crate::depth::too_deep(scan.masked()) {
        diagnostics.push(Diagnostic::new(
            Code::SourceNestedTooDeep,
            span,
            format!(
                "brackets are nested more than {} levels deep here; the file is not compiled",
                crate::depth::MAX_DEPTH
            ),
        ));
        return TsxResult {
            diagnostics,
            ..TsxResult::default()
        };
    }

    let allocator = Allocator::default();
    let ast = Ast::new(&allocator);
    let parsed = Parser::new(&allocator, scan.masked(), SourceType::tsx()).parse();
    diagnostics.extend(
        parsed
            .diagnostics
            .into_vec()
            .iter()
            .map(|d| prepare::from_oxc(Code::SyntaxError, d)),
    );
    if parsed.fatal_error {
        sort(&mut diagnostics);
        return TsxResult {
            diagnostics,
            ..TsxResult::default()
        };
    }
    let mut program = parsed.program;
    let directives_end = program.directives.last().map(|d| d.span.end);

    let has_refs = scan.blocks.iter().any(|block| !block.refs.is_empty());
    let semantic = SemanticBuilder::new()
        .with_enum_eval(true)
        .with_build_nodes(has_refs)
        .build(&program)
        .semantic;
    let style = prepare::resolve_style_refs(
        &allocator,
        &program,
        &semantic,
        filename,
        &scan.blocks,
        &options.modules,
        &css::hyphenated_refs(source, &scan.blocks),
    );
    // The analysis (components, misplaced blocks) runs on the program Lumiose would compile.
    let scoping = semantic.into_scoping();
    prepare::strip_style_artifacts(&ast, &mut program, &scan.blocks, &style);
    let _ = prepare::strip_types(&allocator, &mut program, scoping, filename);
    let scoping = SemanticBuilder::new()
        .build(&program)
        .semantic
        .into_scoping();
    let analysis = analyze::analyze(
        &program,
        &scoping,
        &scan.blocks,
        &scan.diagnostics,
        |_| false,
        false,
    );
    diagnostics.extend(
        analysis
            .diagnostics
            .iter()
            .filter(|d| d.code.id().starts_with("LUM3"))
            .cloned(),
    );

    let scopes = ScopePlan::new(
        &scan.blocks,
        &program,
        &analysis,
        &crate::compile::scope_path(filename, options.root.as_deref(), &options.packages),
        &options.css.scoped,
    );
    let emit_css = scopes.has_css() && style.is_complete();
    let (css, css_map) = if emit_css {
        let inventories = css::inventories(&program, &analysis, &scopes, &options.class_attribute);
        let (output, css_diagnostics) = css::process(
            source,
            filename,
            &scopes,
            &style.refs,
            &inventories,
            &options.css,
            options.source_map,
        );
        diagnostics.extend(css_diagnostics);
        (Some(output.css), output.map)
    } else {
        (None, None)
    };
    diagnostics.extend(style.diagnostics);
    sort(&mut diagnostics);

    let mut edits = Edits::default();
    for block in scan.blocks.iter().filter(|block| !block.svg) {
        edits.push(block.span.start, block.span.end, String::new());
    }
    let classes = options.css.scoped.strategy == lumiose_css::ScopeStrategy::Class;
    let mut stamper = Stamper {
        source,
        analysis: &analysis,
        tokens: &scopes.tokens,
        classes,
        class_attribute: &options.class_attribute,
        components: Vec::new(),
        edits: &mut edits,
    };
    stamper.visit_program(&program);
    if let (Some(specifier), Some(_)) = (&options.style_import, &css) {
        let at = directives_end.unwrap_or(0);
        let separator = if at == 0 { "" } else { "\n" };
        let line = format!("{separator}import {};\n", json_string(specifier));
        edits.push(at, at, line);
    }
    let (code, map) = edits.apply(source, filename, options.source_map);
    TsxResult {
        code,
        map,
        css,
        css_map,
        css_deps: style.deps,
        module_requests: style.requests,
        diagnostics,
        scope_tokens: scopes.tokens,
    }
}

fn sort(diagnostics: &mut [Diagnostic]) {
    diagnostics.sort_by_key(|d| (d.span.start, d.span.end));
}

fn json_string(text: &str) -> String {
    let mut out = String::with_capacity(text.len() + 2);
    out.push('"');
    for c in text.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            c => out.push(c),
        }
    }
    out.push('"');
    out
}

/// Stamps scope markers on intrinsic elements and passes scope classes to components.
struct Stamper<'s> {
    source: &'s str,
    analysis: &'s Analysis,
    tokens: &'s ScopeTokens,
    classes: bool,
    class_attribute: &'s str,
    /// Names of the components being visited (innermost last).
    components: Vec<String>,
    edits: &'s mut Edits,
}

impl Stamper<'_> {
    fn enter(&mut self, span_start: u32) -> bool {
        match self.analysis.component_at(span_start) {
            Some(component) => {
                self.components.push(component.name.clone());
                true
            }
            None => false,
        }
    }

    fn text(&self, span: oxc_span::Span) -> &str {
        &self.source[span.start as usize..span.end as usize]
    }

    /// Appends `classes` to a class attribute's value.
    fn append_classes(&mut self, attribute: &JSXAttribute<'_>, classes: &str) {
        match &attribute.value {
            Some(JSXAttributeValue::StringLiteral(literal)) => {
                let at = literal.span.end - 1;
                let separator = if literal.value.trim().is_empty() {
                    ""
                } else {
                    " "
                };
                self.edits.push(at, at, format!("{separator}{classes}"));
            }
            Some(JSXAttributeValue::ExpressionContainer(container))
                if container.expression.as_expression().is_some() =>
            {
                let start = container.span.start + 1;
                let end = container.span.end - 1;
                self.edits.push(start, start, "[".to_owned());
                self.edits.push(
                    end,
                    end,
                    format!(", {}].filter(Boolean).join(\" \")", json_string(classes)),
                );
            }
            // `className` alone, or an element value: replaced by the classes.
            _ => {
                let span = attribute.span;
                let replacement = format!("{}={}", self.class_attribute, json_string(classes));
                self.edits.push(span.start, span.end, replacement);
            }
        }
    }

    fn class_attribute<'b, 'a>(
        &self,
        opening: &'b JSXOpeningElement<'a>,
    ) -> Option<&'b JSXAttribute<'a>> {
        opening.attributes.iter().rev().find_map(|item| match item {
            JSXAttributeItem::Attribute(attribute)
                if matches!(&attribute.name, JSXAttributeName::Identifier(name)
                    if name.name == self.class_attribute) =>
            {
                Some(&**attribute)
            }
            _ => None,
        })
    }

    fn stamp(&mut self, element: &JSXElement<'_>) {
        let component = self.components.last().map(String::as_str);
        let markers = self.tokens.at(component, element.span, false);
        if markers.is_empty() {
            return;
        }
        let opening = &element.opening_element;
        if !is_intrinsic(&opening.name) {
            // Class passthrough: only a class the caller passes carries its scope.
            if self.classes
                && let Some(attribute) = self.class_attribute(opening)
            {
                let classes = markers.join(" ");
                self.append_classes(attribute, &classes);
            }
            return;
        }
        let name_end = opening.name.span().end;
        if !self.classes {
            let attributes: String = markers.iter().map(|m| format!(" {m}=\"\"")).collect();
            self.edits.push(name_end, name_end, attributes);
            return;
        }
        let classes = markers.join(" ");
        if let Some(attribute) = self.class_attribute(opening) {
            self.append_classes(attribute, &classes);
            return;
        }
        let spreads: Vec<&JSXSpreadAttribute<'_>> = opening
            .attributes
            .iter()
            .filter_map(|item| match item {
                JSXAttributeItem::SpreadAttribute(spread) => Some(&**spread),
                JSXAttributeItem::Attribute(_) => None,
            })
            .collect();
        let class = self.class_attribute;
        let Some(last) = spreads.last() else {
            let attribute = format!(" {class}={}", json_string(&classes));
            self.edits.push(name_end, name_end, attribute);
            return;
        };
        if spreads.iter().all(|spread| is_reference(&spread.argument)) {
            // After the spreads, keeping the class the last of them that has one gives.
            let passed: Vec<String> = spreads
                .iter()
                .rev()
                .map(|spread| format!("({})?.{class}", self.text(spread.argument.span())))
                .collect();
            let attribute = format!(
                " {class}={{[{}, {}].filter(Boolean).join(\" \")}}",
                passed.join(" ?? "),
                json_string(&classes)
            );
            self.edits.push(last.span.end, last.span.end, attribute);
        } else {
            // Before the spreads: one that sets the class replaces the markers.
            let attribute = format!(" {class}={}", json_string(&classes));
            self.edits.push(name_end, name_end, attribute);
        }
    }
}

/// An identifier or a chain of static member accesses (`props`, `props.rest`): safe to read
/// again.
fn is_reference(expression: &Expression<'_>) -> bool {
    match expression.get_inner_expression() {
        Expression::Identifier(_) | Expression::ThisExpression(_) => true,
        Expression::StaticMemberExpression(member) => is_reference(&member.object),
        _ => false,
    }
}

impl<'a> Visit<'a> for Stamper<'_> {
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
        self.stamp(it);
        walk::walk_jsx_element(self, it);
    }
}

/// Text edits on the source, applied in order, with the source map they make.
#[derive(Default)]
struct Edits {
    /// `(start, end, replacement)`, byte offsets into the source.
    items: Vec<(u32, u32, String)>,
}

impl Edits {
    fn push(&mut self, start: u32, end: u32, text: String) {
        self.items.push((start, end, text));
    }

    fn apply(mut self, source: &str, filename: &str, source_map: bool) -> (String, Option<String>) {
        // Removals before insertions at the same offset; insertions keep their push order.
        self.items
            .sort_by_key(|(start, end, _)| (*start, std::cmp::Reverse(*end)));
        let mut out = String::with_capacity(source.len() + 256);
        let mut map = source_map.then(|| MapBuilder::new(source));
        let mut cursor = 0usize;
        for (start, end, text) in &self.items {
            let (start, end) = (*start as usize, *end as usize);
            if start < cursor {
                // Overlaps an earlier edit (never expected): keep the earlier one.
                continue;
            }
            if let Some(map) = &mut map {
                map.copy(&mut out, source, cursor, start);
                map.insert(&mut out, text);
            } else {
                out.push_str(&source[cursor..start]);
                out.push_str(text);
            }
            cursor = end;
        }
        match &mut map {
            Some(map) => map.copy(&mut out, source, cursor, source.len()),
            None => out.push_str(&source[cursor..]),
        }
        let json = map.map(|map| map.finish(source, filename));
        (out, json)
    }
}

/// Source map tokens for text copied from the source, at line starts and word starts.
struct MapBuilder {
    /// Byte offsets of the source's line starts.
    lines: Vec<usize>,
    tokens: Vec<(u32, u32, u32, u32)>,
    out_line: u32,
    /// UTF-16 column in the output.
    out_column: u32,
}

impl MapBuilder {
    fn new(source: &str) -> Self {
        let mut lines = vec![0];
        lines.extend(source.match_indices('\n').map(|(i, _)| i + 1));
        Self {
            lines,
            tokens: Vec::new(),
            out_line: 0,
            out_column: 0,
        }
    }

    /// The line and UTF-16 column of a source byte offset.
    fn position(&self, source: &str, offset: usize) -> (u32, u32) {
        let line = self.lines.partition_point(|&start| start <= offset) - 1;
        let column = source[self.lines[line]..offset].encode_utf16().count();
        (line as u32, column as u32)
    }

    fn advance(&mut self, text: &str) {
        for c in text.chars() {
            if c == '\n' {
                self.out_line += 1;
                self.out_column = 0;
            } else {
                self.out_column += c.len_utf16() as u32;
            }
        }
    }

    fn copy(&mut self, out: &mut String, source: &str, start: usize, end: usize) {
        if start >= end {
            return;
        }
        let (mut line, mut column) = self.position(source, start);
        let mut previous: Option<char> = None;
        for c in source[start..end].chars() {
            // At the run's start, each line start, and where a word or a punctuation run starts.
            let boundary = match previous {
                None | Some('\n') => c != '\n',
                Some(p) => !c.is_whitespace() && (p.is_whitespace() || is_word(c) != is_word(p)),
            };
            if boundary {
                self.tokens
                    .push((self.out_line, self.out_column, line, column));
            }
            if c == '\n' {
                line += 1;
                column = 0;
                self.out_line += 1;
                self.out_column = 0;
            } else {
                let width = c.len_utf16() as u32;
                column += width;
                self.out_column += width;
            }
            previous = Some(c);
        }
        out.push_str(&source[start..end]);
    }

    fn insert(&mut self, out: &mut String, text: &str) {
        self.advance(text);
        out.push_str(text);
    }

    fn finish(self, source: &str, filename: &str) -> String {
        let mut builder = oxc_sourcemap::SourceMapBuilder::default();
        let id = builder.add_source_and_content(filename, source);
        for (out_line, out_column, line, column) in self.tokens {
            builder.add_token(out_line, out_column, line, column, Some(id), None);
        }
        builder.into_sourcemap().to_json_string()
    }
}

fn is_word(c: char) -> bool {
    c.is_alphanumeric() || c == '_' || c == '$'
}
