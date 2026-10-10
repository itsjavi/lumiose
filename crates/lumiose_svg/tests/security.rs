//! Hostile SVG files (TASK-169, from Prism's TASK-162 review): what could run script, act as HTML
//! or crash the host never reaches the component.

use lumiose_svg::component_source;

fn component(svg: &str) -> String {
    component_source(svg).unwrap_or_else(|error| panic!("{error}\n{svg}"))
}

const NS: &str = r#"xmlns="http://www.w3.org/2000/svg""#;

#[test]
fn drops_foreign_object_and_the_html_in_it() {
    for inner in [
        r#"<div xmlns="http://www.w3.org/1999/xhtml" innerHTML="&lt;img src=x onerror=alert(1)&gt;"/>"#,
        r#"<iframe xmlns="http://www.w3.org/1999/xhtml" srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;"/>"#,
        r#"<base xmlns="http://www.w3.org/1999/xhtml" href="https://evil.example/"/><meta xmlns="http://www.w3.org/1999/xhtml" http-equiv="refresh" content="0;url=https://evil.example"/>"#,
        "<window.alert/>",
    ] {
        let source = component(&format!(
            "<svg {NS} viewBox=\"0 0 10 10\"><foreignObject width=\"9\" height=\"9\">{inner}</foreignObject><path d=\"M0 0\"/></svg>"
        ));
        for absent in [
            "foreignObject",
            "innerHTML",
            "iframe",
            "srcdoc",
            "<base",
            "<meta",
            "window",
            "alert",
        ] {
            assert!(!source.contains(absent), "{absent} in\n{source}");
        }
        assert!(source.contains("<path d=\"M0 0\" />"), "{source}");
    }
}

#[test]
fn keeps_only_allowed_elements_and_attributes() {
    let source = component(&format!(
        "<svg {NS} aé=\"1\" innerHTML=\"x\" ref=\"r\"><window.alert/><process.exit/><unknown><path d=\"M0 0\"/></unknown><g data-x=\"1\" aria-label=\"a\" onclick=\"x\" fill=\"red\"/></svg>"
    ));
    for absent in [
        "aé",
        "innerHTML",
        "ref=",
        "window",
        "process",
        "unknown",
        "onclick",
        "M0 0",
    ] {
        assert!(!source.contains(absent), "{absent} in\n{source}");
    }
    assert!(
        source.contains(r#"<g data-x="1" aria-label="a" fill="red" />"#),
        "{source}"
    );
}

#[test]
fn drops_animations_of_links_handlers_and_script_urls_in_any_case() {
    let source = component(&format!(
        "<svg {NS}><a>\
         <set ATTRIBUTENAME=\"href\" to=\"x\"/>\
         <aNIMATE attributeName=\"href\" values=\"#;javascript:alert(1)\" dur=\"1s\"/>\
         <animate attributeName=\"xlink:HREF\" to=\"#a\"/>\
         <animate attributeName=\"onbegin\" to=\"alert(1)\"/>\
         <animate attributeName=\"fill\" values=\"red; JavaScript:alert(1)\"/>\
         <animate attributeName=\"fill\" from=\"red\" to=\"blue\" dur=\"1s\"/>\
         <text>x</text></a></svg>"
    ));
    assert_eq!(source.matches("<animate").count(), 1, "{source}");
    assert!(source.contains(r#"<animate attributeName="fill" from="red" to="blue" dur="1s" />"#));
    for absent in [
        "javascript",
        "JavaScript",
        "alert",
        "href",
        "<set",
        "aNIMATE",
    ] {
        assert!(!source.contains(absent), "{absent} in\n{source}");
    }
}

#[test]
fn escapes_markup_characters_in_style_text() {
    let source = component(&format!(
        "<svg {NS}><style>.a:hover{{font-family:\"&lt;img src=x onerror=alert(1)&gt;\"}} .b{{content:\"&amp;lt;\"}}</style><path class=\"a b\" d=\"M0 0\"/></svg>"
    ));
    let style = &source[source.find("<style>").unwrap()..source.find("</style>").unwrap()];
    assert!(!style[1..].contains('<') && !style.contains('&'), "{style}");
    assert!(
        style.contains(r"\3c img") && style.contains(r"\26 lt;"),
        "{style}"
    );
}

#[test]
fn nesting_depth_is_an_error_not_a_crash() {
    for depth in [129, 100_000] {
        let svg = format!(
            "<svg {NS}>{}{}</svg>",
            "<g>".repeat(depth),
            "</g>".repeat(depth)
        );
        let error = component_source(&svg).unwrap_err();
        assert_eq!(error.message, "elements are nested deeper than 128 levels");
        assert_eq!(error.position.map(|(line, _)| line), Some(1));
    }
    // The deepest file allowed parses; in debug builds the XML parser needs more than a test
    // thread's 2 MB of stack for it (release builds need a fraction).
    let svg = format!(
        "<svg {NS}>{}{}</svg>",
        "<g>".repeat(127),
        "</g>".repeat(127)
    );
    let parsed = std::thread::Builder::new()
        .stack_size(32 << 20)
        .spawn(move || component_source(&svg).is_ok())
        .unwrap()
        .join()
        .unwrap();
    assert!(parsed);
    // Self-closing tags, comments and quoted `>` do not count.
    let svg = format!("<svg {NS}>{}</svg>", "<g a='>'/><!-- <g> -->".repeat(1000));
    assert!(component_source(&svg).is_ok());
}
