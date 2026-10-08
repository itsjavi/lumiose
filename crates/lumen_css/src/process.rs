//! The per-file pipeline: pre-pass, Lightning CSS parse, AST passes, merge, minify, print.

use std::collections::{BTreeSet, HashMap};
use std::sync::{Arc, RwLock};

use lightningcss::error::ErrorLocation;
use lightningcss::rules::CssRuleList;
use lightningcss::stylesheet::{MinifyOptions, ParserOptions, PrinterOptions, StyleSheet};
use parcel_sourcemap::SourceMap;

use crate::ast::{self, Renames};
use crate::diagnostics::{CssCode, CssDiagnostic, Fix, TextEdit};
use crate::edits::{Edit, Rewritten};
use crate::lines::{LineIndex, Newlines};
use crate::prepass::{self, RefSite};
use crate::selector::{self, Rewrite, ScopeContext};
use crate::{
    CssBlock, CssInput, CssOptions, CssOutput, RefValue, Scope, Span, scope_attribute, sourcemap,
};

/// Processes the `<style>` blocks of one file into a single stylesheet. See the crate docs
/// for the behaviour.
pub fn process(input: &CssInput, options: &CssOptions) -> CssOutput {
    let mut diagnostics = Vec::new();
    let mut blocks: Vec<&CssBlock> = input
        .blocks
        .iter()
        .filter(|block| !block.svg && input.source.get(block.content.range()).is_some())
        .collect();
    blocks.sort_by_key(|block| (block.scope.is_component_level(), block.content.start));

    let values: HashMap<Span, &RefValue> = input
        .refs
        .iter()
        .map(|resolved| (resolved.span, &resolved.value))
        .collect();
    let prepared: Vec<Prepared> = blocks
        .iter()
        .map(|block| prepare(input, block, &values, &mut diagnostics))
        .collect();

    let mut sheets = Vec::with_capacity(prepared.len());
    for (index, block) in prepared.iter().enumerate() {
        let warnings = Arc::new(RwLock::new(Vec::new()));
        let parsed = StyleSheet::parse(
            &block.rewritten.text,
            ParserOptions {
                filename: index.to_string(),
                source_index: crate::to_u32(index),
                error_recovery: true,
                warnings: Some(Arc::clone(&warnings)),
                ..ParserOptions::default()
            },
        );
        if let Ok(warnings) = warnings.read() {
            for warning in warnings.iter() {
                diagnostics.push(block.lightning_diagnostic(
                    CssCode::InvalidCssIgnored,
                    warning.kind.to_string(),
                    warning.loc.as_ref(),
                ));
            }
        }
        match parsed {
            Ok(sheet) => sheets.push(Some(sheet)),
            Err(error) => {
                diagnostics.push(block.lightning_diagnostic(
                    CssCode::CssSyntaxError,
                    error.kind.to_string(),
                    error.loc.as_ref(),
                ));
                sheets.push(None);
            }
        }
    }

    let reads = scope_keyframes(&prepared, &mut sheets);
    for set in input.custom_properties_set {
        if !reads.contains(&set.name) {
            let name = &set.name;
            diagnostics.push(
                CssDiagnostic::new(
                    CssCode::CustomPropertyNeverRead,
                    set.span,
                    format!(
                        "`{name}` is set in a `style` prop, but no `var({name})` in this file's CSS reads it"
                    ),
                )
                .with_help(format!(
                    "Read it with `var({name})` in a `<style>` block, or remove it"
                )),
            );
        }
    }

    let (css, map) = print(input, options, &prepared, sheets, &mut diagnostics);
    // A misused `:global`/`:deep` is already an error; Lightning CSS's warning about the
    // unknown pseudo-class at the same place adds nothing.
    let scope_errors: Vec<Span> = diagnostics
        .iter()
        .filter(|d| d.code == CssCode::InvalidScopeSelector)
        .map(|d| d.span)
        .collect();
    diagnostics.retain(|d| {
        d.code != CssCode::InvalidCssIgnored
            || !scope_errors
                .iter()
                .any(|s| s.start <= d.span.start && d.span.start < s.end)
    });
    diagnostics.sort_by_key(|d| (d.span.start, d.span.end));
    CssOutput {
        css,
        map,
        diagnostics,
        custom_properties_read: reads.into_iter().collect(),
    }
}

/// A block after the pre-pass: the text Lightning CSS parses and its way back to the source.
pub(crate) struct Prepared<'a> {
    block: &'a CssBlock,
    /// The original block text.
    content: &'a str,
    rewritten: Rewritten,
    lines: LineIndex,
}

impl Prepared<'_> {
    /// The source offset of a zero-based line and UTF-16 column of the rewritten text.
    pub fn original_offset(&self, line: u32, column: u32) -> usize {
        let offset = self.lines.offset(&self.rewritten.text, line, column);
        self.block.content.start as usize + self.rewritten.original_offset(offset)
    }

    /// A Lightning CSS error or warning as a diagnostic at its source location. The span runs
    /// to the end of the declaration or prelude on that line.
    fn lightning_diagnostic(
        &self,
        code: CssCode,
        message: String,
        location: Option<&ErrorLocation>,
    ) -> CssDiagnostic {
        let content = self.block.content;
        let start = location.map_or(content.start as usize, |loc| {
            self.original_offset(loc.line, loc.column.saturating_sub(1))
        });
        let rest = &self.content[start - content.start as usize..];
        let length = rest.find(['\n', '\r', ';', '{', '}']).unwrap_or(rest.len());
        let mut end = start + rest[..length].trim_end().len();
        if end == start {
            // Point at the offending character (`;`, `{`) rather than nothing.
            end += rest.chars().next().map_or(0, char::len_utf8);
        }
        CssDiagnostic::new(code, Span::from_usize(start, end), message)
    }
}

fn prepare<'a>(
    input: &CssInput<'a>,
    block: &'a CssBlock,
    values: &HashMap<Span, &RefValue>,
    diagnostics: &mut Vec<CssDiagnostic>,
) -> Prepared<'a> {
    let base = block.content.start;
    let content = &input.source[block.content.range()];
    let scan = prepass::scan(content);
    let mut edits = Vec::new();
    for site in &scan.refs {
        if site.hyphenated.is_some() {
            diagnostics.push(hyphenated_ref(content, site).offset(base));
            continue;
        }
        let base = base as usize;
        let span = Span::from_usize(base + site.range.start, base + site.range.end);
        if let Some(value) = values.get(&span) {
            edits.push(Edit::replace(site.range.clone(), value_text(value)));
        }
    }

    let attribute = block
        .scope
        .token()
        .map(|token| format!("[{}]", scope_attribute(token)));
    let label = match &block.scope {
        Scope::Component { name, .. } => format!("component `{name}`"),
        Scope::File { .. } | Scope::Global { .. } => "this file".to_owned(),
    };
    let scope = ScopeContext {
        attribute: attribute.as_deref(),
        inventory: block
            .scope
            .token()
            .and_then(|token| input.inventories.iter().find(|inv| inv.token == token)),
        scope_label: &label,
    };
    let mut rewrite = Rewrite::default();
    for prelude in &scan.preludes {
        selector::rewrite_prelude(content, prelude, &scope, &mut rewrite);
    }
    edits.extend(rewrite.edits);
    diagnostics.extend(rewrite.diagnostics.into_iter().map(|d| d.offset(base)));

    let rewritten = Rewritten::apply(content, edits);
    let lines = LineIndex::new(&rewritten.text, Newlines::Css);
    Prepared {
        block,
        content,
        rewritten,
        lines,
    }
}

/// `$brand-primary`: `LUM3009`, with a fix when every part is an identifier.
fn hyphenated_ref(content: &str, site: &RefSite) -> CssDiagnostic {
    let range = site
        .hyphenated
        .clone()
        .expect("only called for hyphenated refs");
    let text = &content[range.clone()];
    let parts: Vec<&str> = text[1..].split(['-', '.']).collect();
    let span = Span::from_usize(range.start, range.end);
    let diagnostic = CssDiagnostic::new(
        CssCode::HyphenatedStyleRef,
        span,
        format!("`{text}` is not a valid reference: JavaScript identifiers cannot contain `-`"),
    );
    let identifiers = parts.iter().all(|part| {
        part.chars()
            .next()
            .is_some_and(|ch| ch == '_' || ch.is_alphabetic())
    });
    if !identifiers {
        let (name, rest) = text.split_once('-').expect("hyphenated refs contain `-`");
        return diagnostic.with_help(format!(
            "If you meant a subtraction, put spaces around `-`: `calc({name} - {rest})`"
        ));
    }
    let dotted = format!("${}", parts.join("."));
    let camel: String = parts
        .iter()
        .enumerate()
        .map(|(i, part)| {
            let mut chars = part.chars();
            match chars.next() {
                Some(first) if i > 0 => first.to_uppercase().chain(chars).collect(),
                _ => (*part).to_owned(),
            }
        })
        .collect();
    diagnostic
        .with_help(format!(
            "Use `{dotted}` for a member of an `as const` object, or a camelCase constant such as `${camel}`"
        ))
        .with_fix(Fix {
            message: format!("Replace with `{dotted}`"),
            edits: vec![TextEdit { span, text: dotted }],
        })
}

/// Strings are inserted raw; numbers in plain decimal notation (`8`, `0.5`, never `1e21`).
fn value_text(value: &RefValue) -> String {
    match value {
        RefValue::String(text) => text.clone(),
        RefValue::Number(number) if *number == 0.0 => "0".to_owned(),
        RefValue::Number(number) => number.to_string(),
    }
}

/// Renames `@keyframes` of scoped blocks and the `animation` references that resolve to them,
/// then returns the custom properties read anywhere in the file.
fn scope_keyframes(prepared: &[Prepared], sheets: &mut [Option<StyleSheet>]) -> BTreeSet<String> {
    // Keyframes per scope token: `name → name-<token>`.
    let mut defined: HashMap<&str, HashMap<String, String>> = HashMap::new();
    let mut file_tokens = Vec::new();
    for (block, sheet) in prepared.iter().zip(sheets.iter_mut()) {
        let (Some(token), Some(sheet)) = (block.block.scope.token(), sheet) else {
            continue;
        };
        if matches!(block.block.scope, Scope::File { .. }) && !file_tokens.contains(&token) {
            file_tokens.push(token);
        }
        let names = defined.entry(token).or_default();
        for name in ast::keyframes_names(sheet) {
            let renamed = format!("{name}-{token}");
            names.insert(name, renamed);
        }
    }
    // A component sees its own keyframes first, then the file's.
    let file_names: HashMap<String, String> = file_tokens
        .iter()
        .filter_map(|token| defined.get(token))
        .flatten()
        .map(|(name, renamed)| (name.clone(), renamed.clone()))
        .collect();
    let mut visible: HashMap<&str, HashMap<String, String>> = HashMap::new();
    for (token, names) in &defined {
        let mut references = file_names.clone();
        references.extend(names.iter().map(|(n, r)| (n.clone(), r.clone())));
        visible.insert(token, references);
    }

    let empty = HashMap::new();
    let mut reads = BTreeSet::new();
    for (block, sheet) in prepared.iter().zip(sheets.iter_mut()) {
        let Some(sheet) = sheet else {
            continue;
        };
        let renames = block.block.scope.token().map(|token| Renames {
            definitions: defined.get(token).unwrap_or(&empty),
            references: visible.get(token).unwrap_or(&empty),
        });
        ast::rewrite(sheet, renames, &mut reads);
    }
    reads
}

/// Merges the blocks in order, minifies for the targets and prints, with a composed map.
fn print(
    input: &CssInput,
    options: &CssOptions,
    prepared: &[Prepared],
    sheets: Vec<Option<StyleSheet>>,
    diagnostics: &mut Vec<CssDiagnostic>,
) -> (String, Option<String>) {
    let mut rules = Vec::new();
    for sheet in sheets.into_iter().flatten() {
        rules.extend(sheet.rules.0);
    }
    if rules.is_empty() {
        return (String::new(), None);
    }
    let sources = (0..prepared.len()).map(|index| index.to_string()).collect();
    let mut sheet = StyleSheet::new(sources, CssRuleList(rules), ParserOptions::default());
    let location_diagnostic = |code, message: String, location: Option<&ErrorLocation>| {
        let block = location
            .and_then(|loc| loc.filename.parse::<usize>().ok())
            .and_then(|index| prepared.get(index));
        match block {
            Some(block) => block.lightning_diagnostic(code, message, location),
            None => CssDiagnostic::new(code, Span::default(), message),
        }
    };
    if let Err(error) = sheet.minify(MinifyOptions {
        targets: options.targets,
        ..MinifyOptions::default()
    }) {
        diagnostics.push(location_diagnostic(
            CssCode::CssSyntaxError,
            error.kind.to_string(),
            error.loc.as_ref(),
        ));
    }
    let mut printed_map = options.source_map.then(|| SourceMap::new(""));
    let printed = sheet.to_css(PrinterOptions {
        minify: options.minify,
        source_map: printed_map.as_mut(),
        targets: options.targets,
        ..PrinterOptions::default()
    });
    match printed {
        Ok(result) => {
            let map = printed_map
                .map(|map| sourcemap::compose(&map, prepared, input.filename, input.source));
            (result.code, map)
        }
        Err(error) => {
            diagnostics.push(location_diagnostic(
                CssCode::CssSyntaxError,
                error.kind.to_string(),
                error.loc.as_ref(),
            ));
            (String::new(), None)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn files_without_extracted_css_produce_nothing() {
        let source = "<svg><style>.a { fill: $x }</style></svg>";
        let blocks = [CssBlock {
            content: Span::new(12, 27),
            scope: Scope::File { token: "t".into() },
            svg: true,
        }];
        let options = CssOptions {
            source_map: true,
            ..CssOptions::default()
        };
        for blocks in [&blocks[..], &[]] {
            let output = process(
                &CssInput {
                    filename: "a.stsx",
                    source,
                    blocks,
                    ..CssInput::default()
                },
                &options,
            );
            assert_eq!(output, CssOutput::default());
        }
    }

    #[test]
    fn numbers_print_in_decimal_notation() {
        let text = |n| value_text(&RefValue::Number(n));
        assert_eq!(text(8.0), "8");
        assert_eq!(text(-0.0), "0");
        assert_eq!(text(0.5), "0.5");
        assert_eq!(text(1e21), "1000000000000000000000");
    }
}
