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
