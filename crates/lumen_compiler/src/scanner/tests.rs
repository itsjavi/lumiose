use super::*;
use crate::diagnostics::{Code, Severity};

fn stsx(source: &str) -> ScanResult {
    scan(source, "test.stsx")
}

fn codes(result: &ScanResult) -> Vec<Code> {
    result
        .diagnostics
        .iter()
        .map(|diagnostic| diagnostic.code)
        .collect()
}

fn parses(text: &str) -> bool {
    let allocator = oxc_allocator::Allocator::default();
    let parsed = oxc_parser::Parser::new(&allocator, text, oxc_span::SourceType::tsx()).parse();
    parsed.diagnostics.is_empty() && !parsed.fatal_error
}

#[test]
fn file_kinds() {
    assert_eq!(FileKind::from_path("src/A.stsx"), FileKind::Stsx);
    assert_eq!(
        FileKind::from_path("/src/A.stsx?lumen&type=style&lang.css"),
        FileKind::Stsx
    );
    assert_eq!(FileKind::from_path("A.TSX"), FileKind::Tsx);
    assert_eq!(FileKind::from_path("a.jsx"), FileKind::Tsx);
    assert_eq!(FileKind::from_path("a.ts"), FileKind::Script);
    assert_eq!(FileKind::from_path("Makefile"), FileKind::Script);
}

#[test]
fn script_files_are_never_scanned() {
    let source = "const x = <T>y;\n<style>.a{}</style>\n";
    let result = scan(source, "a.ts");
    assert!(result.is_identity());
    assert_eq!(result.masked(), source);
}

#[test]
fn top_level_block_masks_references_as_statements() {
    let source = "const a = 1\n<style>.x { margin: $a; padding: $a }</style>\n";
    let result = stsx(source);
    assert_eq!(result.blocks.len(), 1);
    assert_eq!(result.blocks[0].placement, Placement::TopLevel);
    assert_eq!(
        result.masked(),
        format!(
            "const a = 1\n{};a;{};a;{}\n",
            " ".repeat(20),
            " ".repeat(10),
            " ".repeat(9)
        )
    );
    assert!(parses(result.masked()));
}

#[test]
fn jsx_block_masks_references_as_containers() {
    let source = "export const A = () => <div><style>.x { margin: $gap.lg }</style></div>;";
    let result = stsx(source);
    assert_eq!(
        result.masked(),
        format!(
            "export const A = () => <div>{}{{gap.lg}}{}</div>;",
            " ".repeat(20),
            " ".repeat(9)
        )
    );
    assert!(parses(result.masked()));
}

#[test]
fn crlf_line_endings_are_preserved() {
    let source = "export const A = () => (\r\n  <div>\r\n    <style>\r\n      .a { margin: $m\r\n      }\r\n    </style>\r\n  </div>\r\n);\r\n<style>\r\n.b { color: $c\r\n}\r\n</style>\r\n";
    let result = stsx(source);
    assert_eq!(result.blocks.len(), 2);
    let masked = result.masked();
    assert_eq!(
        masked.matches("\r\n").count(),
        source.matches("\r\n").count()
    );
    // The close character is the first one after the line break: the indentation.
    assert!(masked.contains("{m\r\n}      \r\n"), "{masked:?}");
    assert!(masked.contains(";c\r\n;"), "{masked:?}");
    assert!(parses(masked), "{masked}");
    assert_eq!(
        result.blocks[0].refs[0].close,
        Some(source.find("\r\n      }").unwrap() as u32 + 2)
    );
}

#[test]
fn utf16_masking_keeps_code_unit_offsets() {
    let source =
        "export const A = () => <p>😀<style>.a { content: \"→\"; margin: $x😀 }</style>é</p>;";
    let result = stsx(source);
    let masked16 = result.masked_utf16(source);
    let source16: Vec<u16> = source.encode_utf16().collect();
    assert_eq!(masked16.len(), source16.len());
    let text16 = String::from_utf16(&masked16).unwrap();
    assert!(text16.starts_with("export const A = () => <p>😀"));
    assert!(text16.ends_with("é</p>;"));
    assert!(text16.contains("{x} "), "{text16:?}");
    assert!(parses(&text16), "{text16}");
    // UTF-8: the emoji close character is four bytes, so `}` plus three spaces.
    assert!(result.masked().contains("{x}    "), "{:?}", result.masked());
    assert!(parses(result.masked()));

    let mut mapped = result.clone();
    let index = crate::span::Utf16Index::new(source);
    mapped.map_spans(&|offset| index.to_utf16(offset));
    let reference = &mapped.blocks[0].refs[0];
    let units = &source16[reference.span.start as usize..reference.span.end as usize];
    assert_eq!(String::from_utf16(units).unwrap(), "$x");
}

#[test]
fn style_must_be_followed_by_whitespace_or_gt() {
    let source = "export const A = () => <div><styles>x</styles><style-x /><style.x /></div>;\n";
    let result = stsx(source);
    assert!(result.blocks.is_empty());
    assert_eq!(result.masked(), source);
}

#[test]
fn comparison_with_a_style_variable_is_not_a_block() {
    let source = "const style = 1;\nconst a = 0 <style> 2;\nconst b = a < style;\n";
    let result = stsx(source);
    assert!(result.blocks.is_empty());
    assert!(result.diagnostics.is_empty());
}

#[test]
fn style_after_an_expression_on_the_same_line_is_ambiguous() {
    let source = "const a = b <style>\n.x { color: red }\n</style>\n";
    let result = stsx(source);
    assert!(result.blocks.is_empty());
    assert_eq!(codes(&result), [Code::ScannerAmbiguity]);
    assert_eq!(result.diagnostics[0].severity, Severity::Warning);
}

#[test]
fn top_level_block_after_an_unterminated_statement_line() {
    // No semicolon: a `<style` at the start of a line at top level is a block.
    let source = "const a = b\n<style>\n.x { color: red }\n</style>\n";
    let result = stsx(source);
    assert_eq!(result.blocks.len(), 1);
    assert_eq!(result.blocks[0].placement, Placement::TopLevel);
    assert!(result.diagnostics.is_empty());
    assert!(parses(result.masked()));
}

#[test]
fn type_endings_before_a_top_level_style() {
    for ending in [
        "] as const",
        "} satisfies Story<Args>",
        "type H = () => void",
        "let x: Map<K, V>",
    ] {
        let source = format!("{ending}\n<style>.x {{}}</style>\n");
        let result = stsx(&source);
        assert_eq!(result.blocks[0].placement, Placement::TopLevel, "{ending}");
        assert!(result.diagnostics.is_empty(), "{ending}");
    }
}

#[test]
fn incomplete_expression_before_a_top_level_style_is_an_expression() {
    let source = "export default\n<style>.x {}</style>\n";
    let result = stsx(source);
    assert_eq!(result.blocks[0].placement, Placement::Expression);
    assert_eq!(codes(&result), [Code::StyleAsRootOrExpression]);
    assert!(parses(result.masked()));
}

#[test]
fn generic_function_types_do_not_open_jsx() {
    let source = r#"type F = <T>(x: T) => T;
const f: <T>(x: T) => T = (x) => x;
interface C { <T>(x: T): T; new <T>(x: T): C }
function g(): <T>() => void { return () => {}; }
export const A = () => <div><style>.a { color: $c }</style></div>;
<style>.b {}</style>
"#;
    let result = stsx(source);
    assert_eq!(result.blocks.len(), 2, "{:#?}", result.blocks);
    assert!(matches!(
        result.blocks[0].placement,
        Placement::InJsx { .. }
    ));
    assert_eq!(result.blocks[1].placement, Placement::TopLevel);
    assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
    assert!(parses(result.masked()), "{}", result.masked());
}

#[test]
fn strings_templates_comments_and_regexes_hide_style_tags() {
    let source = r#"const s = "<style>.a{}</style>";
const t = `<style>${"x"}</style>`;
// <style>.a{}</style>
/* <style>.a{}</style> */
const r = /<style>.a{}<\/style>/;
export const A = () => <div title="<style>">{'<style>'}</div>;
"#;
    let result = stsx(source);
    assert!(result.blocks.is_empty(), "{:#?}", result.blocks);
    assert!(result.diagnostics.is_empty());
    assert_eq!(result.masked(), source);
}

#[test]
fn jsx_text_quotes_do_not_start_strings() {
    let source = "export const A = () => <p>Don't \"quote\" `tick`<style>.a{}</style></p>;\n";
    let result = stsx(source);
    assert_eq!(result.blocks.len(), 1);
    assert!(result.diagnostics.is_empty());
}

#[test]
fn unterminated_template_swallowing_blocks_is_reported() {
    let source = "const t = `open\nexport const A = () => <div><style>.a{}</style></div>;\n";
    let result = stsx(source);
    assert!(result.blocks.is_empty());
    assert_eq!(codes(&result), [Code::ScannerAmbiguity]);
    assert_eq!(result.diagnostics[0].severity, Severity::Error);
}

#[test]
fn svg_context_is_inherited_through_containers_and_reset_by_foreign_object() {
    let source = "export const A = (p: { on: boolean }) => <svg>{p.on && <g><style>.a{fill:$x}</style></g>}<foreignObject><div><style>.b{}</style></div></foreignObject></svg>;\n";
    let result = stsx(source);
    assert_eq!(result.blocks.len(), 2);
    assert!(result.blocks[0].svg);
    assert!(result.blocks[0].refs.is_empty());
    assert!(!result.blocks[1].svg);
    assert!(parses(result.masked()));
}

#[test]
fn style_inside_a_template_expression_in_jsx_is_dynamic() {
    let source = "export const A = () => <div>{`${<p><style>.a{}</style></p>}`}</div>;\n";
    let result = stsx(source);
    assert_eq!(codes(&result), [Code::MisplacedStyle]);
}

#[test]
fn style_in_a_child_container_is_an_expression() {
    let source = "export const A = () => <div>{<style>.a{}</style>}</div>;\n";
    let result = stsx(source);
    assert_eq!(result.blocks[0].placement, Placement::Expression);
    assert_eq!(codes(&result), [Code::StyleAsRootOrExpression]);
    assert!(parses(result.masked()));
}

#[test]
fn self_closing_style_is_an_empty_block() {
    let source = "export const A = () => <div><style /></div>;\n";
    let result = stsx(source);
    assert_eq!(result.blocks.len(), 1);
    assert!(result.blocks[0].content.is_empty());
    assert!(result.diagnostics.is_empty());
    assert!(parses(result.masked()));
}

#[test]
fn mismatched_closing_tags_recover() {
    let source =
        "export const A = () => <div><p>unclosed<style>.a{}</style></div>;\n<style>.b{}</style>\n";
    let result = stsx(source);
    assert_eq!(result.blocks.len(), 2, "{:#?}", result.blocks);
    assert_eq!(result.blocks[1].placement, Placement::TopLevel);
}

#[test]
fn fragment_with_other_children_is_valid() {
    let source = "export const A = () => <><style>.a{}</style><p>x</p></>;\n";
    let result = stsx(source);
    assert!(result.diagnostics.is_empty(), "{:?}", result.diagnostics);
}

#[test]
fn tsx_style_with_jsx_children_is_plain_tsx() {
    let source = "export const A = () => <style>{`.a{}`}</style>;\nexport const B = () => <style>\n</style>;\n";
    let result = scan(source, "a.tsx");
    assert!(result.blocks.is_empty());
    assert!(result.diagnostics.is_empty());
}

#[test]
fn diagnostics_are_sorted_and_have_docs() {
    let source =
        "<style lang=\"scss\">.a{}</style>\nexport const A = () => <B><style>.a{}</style></B>;\n";
    let result = stsx(source);
    assert_eq!(
        codes(&result),
        [Code::UnknownStyleAttribute, Code::MisplacedStyle]
    );
    assert_eq!(result.diagnostics[0].docs(), "diagnostics/LUM1005");
}
