//! HTML facts used to build minified templates: void elements, namespaces, escaping and the
//! JavaScript template-literal encoding of the result.

/// Elements without a closing tag.
pub fn is_void(tag: &str) -> bool {
    matches!(
        tag,
        "area"
            | "base"
            | "br"
            | "col"
            | "embed"
            | "hr"
            | "img"
            | "input"
            | "link"
            | "meta"
            | "source"
            | "track"
            | "wbr"
    )
}

/// The namespace a template root is parsed in (`template()` flags).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Namespace {
    Html,
    Svg,
    MathMl,
}

/// SVG elements that do not exist in HTML. `a`, `script`, `style` and `title` are ambiguous and
/// resolve to HTML unless an `<svg>` ancestor decides.
pub fn is_svg_only(tag: &str) -> bool {
    matches!(
        tag,
        "svg"
            | "animate"
            | "animateMotion"
            | "animateTransform"
            | "circle"
            | "clipPath"
            | "defs"
            | "desc"
            | "ellipse"
            | "feBlend"
            | "feColorMatrix"
            | "feComponentTransfer"
            | "feComposite"
            | "feConvolveMatrix"
            | "feDiffuseLighting"
            | "feDisplacementMap"
            | "feDistantLight"
            | "feDropShadow"
            | "feFlood"
            | "feFuncA"
            | "feFuncB"
            | "feFuncG"
            | "feFuncR"
            | "feGaussianBlur"
            | "feImage"
            | "feMerge"
            | "feMergeNode"
            | "feMorphology"
            | "feOffset"
            | "fePointLight"
            | "feSpecularLighting"
            | "feSpotLight"
            | "feTile"
            | "feTurbulence"
            | "filter"
            | "foreignObject"
            | "g"
            | "image"
            | "line"
            | "linearGradient"
            | "marker"
            | "mask"
            | "metadata"
            | "mpath"
            | "path"
            | "pattern"
            | "polygon"
            | "polyline"
            | "radialGradient"
            | "rect"
            | "set"
            | "stop"
            | "switch"
            | "symbol"
            | "text"
            | "textPath"
            | "tspan"
            | "use"
            | "view"
    )
}

/// MathML elements (presentation markup).
pub fn is_mathml(tag: &str) -> bool {
    matches!(
        tag,
        "math"
            | "annotation"
            | "annotation-xml"
            | "maction"
            | "menclose"
            | "merror"
            | "mfrac"
            | "mi"
            | "mmultiscripts"
            | "mn"
            | "mo"
            | "mover"
            | "mpadded"
            | "mphantom"
            | "mprescripts"
            | "mroot"
            | "mrow"
            | "ms"
            | "mspace"
            | "msqrt"
            | "mstyle"
            | "msub"
            | "msubsup"
            | "msup"
            | "mtable"
            | "mtd"
            | "mtext"
            | "mtr"
            | "munder"
            | "munderover"
            | "semantics"
    )
}

/// The namespace of an element's children.
pub fn child_namespace(parent: Namespace, tag: &str) -> Namespace {
    match (parent, tag) {
        (_, "svg") => Namespace::Svg,
        (_, "math") => Namespace::MathMl,
        (Namespace::Svg, "foreignObject") => Namespace::Html,
        (Namespace::MathMl, "annotation-xml") => Namespace::Html,
        (ns, _) => ns,
    }
}

/// The namespace a root element needs when it is created outside its parent (`template()` flag).
/// `svg` and `math` themselves are parsed fine by the HTML parser.
pub fn root_namespace(context: Namespace, tag: &str) -> Namespace {
    match tag {
        "svg" | "math" => Namespace::Html,
        _ if context != Namespace::Html => context,
        _ if is_svg_only(tag) => Namespace::Svg,
        _ if is_mathml(tag) => Namespace::MathMl,
        _ => Namespace::Html,
    }
}

/// `<script>` and `<style>` in HTML: raw text elements, whose content HTML does not decode (in
/// SVG and MathML it does).
pub fn is_raw_text(namespace: Namespace, tag: &str) -> bool {
    namespace == Namespace::Html && matches!(tag, "script" | "style")
}

/// Whether a `<script type>` holds JSON: `application/json`, `application/ld+json` and other
/// `…json` types, import maps and speculation rules.
pub fn is_json_script_type(value: &str) -> bool {
    let value = value.trim().to_ascii_lowercase();
    value.ends_with("json") || matches!(value.as_str(), "importmap" | "speculationrules")
}

/// The text of a raw text element `tag` as `lumiose/server`'s `rawText()` writes it (TASK-472
/// L7, TASK-495): as it is, except that the character after a `<` that could open a tag, an end
/// tag or a comment (a letter, `!`, `/`, `?`) is escaped: a letter as `\u0062` in a script and
/// `\62 ` in a style, the others as `\!`, `\/`, `\?`. They read back the same in JavaScript and
/// CSS strings, identifiers and regular expressions, and leave no tag for the HTML parser to
/// open, also where the element ends up inside `<svg>` or `<math>`, whose `<style>` and
/// `<script>` text is parsed as markup. In a JSON script every `<` is `\u003c` (TASK-472 L7).
pub fn raw_text(text: &str, tag: &str, json: bool) -> String {
    if json {
        return text.replace('<', "\\u003c");
    }
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        out.push(c);
        if c != '<' {
            continue;
        }
        match chars.peek().copied() {
            Some(next) if next.is_ascii_alphabetic() => {
                chars.next();
                let code = next as u32;
                if tag == "style" {
                    out.push_str(&format!("\\{code:x} "));
                } else {
                    out.push_str(&format!("\\u{code:04x}"));
                }
            }
            Some(next @ ('!' | '/' | '?')) => {
                chars.next();
                out.push('\\');
                out.push(next);
            }
            _ => {}
        }
    }
    out
}

/// Escapes text content (`&`, `<`).
pub fn escape_text(text: &str, out: &mut String) {
    for c in text.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            c => out.push(c),
        }
    }
}

/// Writes ` name`, ` name=value` or ` name="value"` (quotes only when needed).
pub fn write_attribute(name: &str, value: Option<&str>, out: &mut String) {
    out.push(' ');
    out.push_str(name);
    let Some(value) = value else {
        return;
    };
    if value.is_empty() {
        out.push_str("=\"\"");
        return;
    }
    let needs_quotes = value
        .chars()
        .any(|c| c.is_ascii_whitespace() || matches!(c, '"' | '\'' | '=' | '<' | '>' | '`'));
    out.push('=');
    if needs_quotes {
        out.push('"');
    }
    for c in value.chars() {
        match c {
            '&' => out.push_str("&amp;"),
            '"' => out.push_str("&quot;"),
            c => out.push(c),
        }
    }
    if needs_quotes {
        out.push('"');
    }
}

/// Encodes `text` as the raw content of a JavaScript template literal.
pub fn template_literal_raw(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(c) = chars.next() {
        match c {
            '\\' => out.push_str("\\\\"),
            '`' => out.push_str("\\`"),
            '$' if chars.peek() == Some(&'{') => out.push_str("\\$"),
            '\r' => out.push_str("\\r"),
            '\n' => out.push_str("\\n"),
            c => out.push(c),
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn attributes_are_quoted_only_when_needed() {
        let mut out = String::new();
        write_attribute("class", Some("card"), &mut out);
        write_attribute("title", Some("a b"), &mut out);
        write_attribute("data-q", Some(r#"say "hi" & go"#), &mut out);
        write_attribute("alt", Some(""), &mut out);
        write_attribute("hidden", None, &mut out);
        assert_eq!(
            out,
            r#" class=card title="a b" data-q="say &quot;hi&quot; &amp; go" alt="" hidden"#
        );
    }

    #[test]
    fn template_literal_raw_escapes_js_syntax() {
        assert_eq!(
            template_literal_raw("a`b${c}\\d\n$e"),
            "a\\`b\\${c}\\\\d\\n$e"
        );
    }

    #[test]
    fn raw_text_ends_no_element_early() {
        assert_eq!(
            raw_text("if (a < b && c) {}", "script", false),
            "if (a < b && c) {}"
        );
        assert_eq!(
            raw_text("'</script>' + '</SCRIPT' + '<!--' + '<?'", "script", false),
            r"'<\/script>' + '<\/SCRIPT' + '<\!--' + '<\?'"
        );
        assert_eq!(
            raw_text("a::after { content: '</style>' }", "style", false),
            r"a::after { content: '<\/style>' }"
        );
        assert_eq!(
            raw_text("<!-- </script>", "style", false),
            r"<\!-- <\/script>"
        );
        // A letter after `<` is escaped too, so no tag opens where the text is parsed as markup
        // (inside `<svg>` or `<math>`).
        assert_eq!(
            raw_text("i<n; x = '<img src=x>'; <<Z", "script", false),
            r"i<\u006e; x = '<\u0069mg src=x>'; <<\u005a"
        );
        assert_eq!(
            raw_text(
                "@media (400px<width) { a::after { content: '<b>' } }",
                "style",
                false
            ),
            r"@media (400px<\77 idth) { a::after { content: '<\62 >' } }"
        );
        assert_eq!(
            raw_text(r#"{"a":"</script>"}"#, "script", true),
            r#"{"a":"\u003c/script>"}"#
        );
        assert!(is_json_script_type(" Application/LD+JSON "));
        assert!(is_json_script_type("importmap"));
        assert!(!is_json_script_type("module"));
    }

    #[test]
    fn namespaces_follow_the_parser() {
        assert_eq!(root_namespace(Namespace::Html, "g"), Namespace::Svg);
        assert_eq!(root_namespace(Namespace::Html, "svg"), Namespace::Html);
        assert_eq!(root_namespace(Namespace::Html, "a"), Namespace::Html);
        assert_eq!(root_namespace(Namespace::Svg, "a"), Namespace::Svg);
        assert_eq!(root_namespace(Namespace::Html, "mi"), Namespace::MathMl);
        assert_eq!(
            child_namespace(Namespace::Svg, "foreignObject"),
            Namespace::Html
        );
    }
}
