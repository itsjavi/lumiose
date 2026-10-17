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

#[path = "support/animations.rs"]
mod animations;

const NAMESPACES: &str =
    r#"xmlns:x="urn:x" xmlns:y="urn:y" xmlns:xlink="http://www.w3.org/1999/xlink""#;

/// A component for `animation` inside a link, with the namespaces the cases use.
fn animated(animation: &str) -> String {
    component(&format!(
        "<svg {NS} {NAMESPACES}><a href=\"#t\" id=\"t\"><text>t</text>{animation}</a></svg>"
    ))
}

#[test]
fn decoys_cannot_vouch_for_an_animation_of_a_link() {
    // Prism's cases (TASK-468): the check read the decoy, the emitter kept the real attribute.
    for animation in [
        r##"<animate attributename="fill" attributeName="href" values="#a;#b" dur="1s"/>"##,
        r##"<animate x:attributeName="fill" attributeName="href" values="#a;#b" dur="1s"/>"##,
        r##"<animate attributeName="href" ATTRIBUTENAME="fill" values="#a;#b" dur="1s"/>"##,
        r##"<set xml:attributeName="fill" attributeName="xlink:href" to="#a"/>"##,
        r##"<animate attributeName="fill" x:values="red" values="red;javascript:alert(1)"/>"##,
        r##"<animate attributeName="fill" Values="red" values="red; java&#9;script:alert(1)"/>"##,
        r##"<animate attributeName="fill" from="red" TO="red" to="javascript:alert(1)"/>"##,
    ] {
        let source = animated(animation);
        assert!(
            !source.contains("<animate") && !source.contains("<set"),
            "{animation}\n{source}"
        );
        assert_eq!(animations::unsafe_animation(&source), None);
    }
}

#[test]
fn keeps_animations_of_presentation_attributes() {
    let source = animated(
        "<animate attributeName=\"fill\" values=\"red;blue\" dur=\"1s\"/>\
         <animate attributeName=\"opacity\" from=\"0\" to=\"1\" dur=\"1s\"/>\
         <animateTransform attributeName=\"transform\" type=\"rotate\" by=\"90\" dur=\"1s\"/>\
         <set attributeName=\"visibility\" to=\"hidden\"/>",
    );
    for kept in [
        r#"<animate attributeName="fill" values="red;blue" dur="1s" />"#,
        r#"<animate attributeName="opacity" from="0" to="1" dur="1s" />"#,
        r#"<animateTransform attributeName="transform" type="rotate" by="90" dur="1s" />"#,
        r#"<set attributeName="visibility" to="hidden" />"#,
    ] {
        assert!(source.contains(kept), "{kept} not in\n{source}");
    }
}

/// A property test (TASK-468): random animations, with decoys in any case, namespace and order,
/// never emit an animation of a link, a handler or a style, or a `javascript:` value.
#[test]
fn no_emitted_animation_targets_a_link_a_handler_or_a_style() {
    const ELEMENTS: [&str; 4] = ["animate", "animateMotion", "animateTransform", "set"];
    const TARGET_NAMES: [&str; 7] = [
        "attributeName",
        "attributename",
        "ATTRIBUTENAME",
        "x:attributeName",
        "y:attributename",
        "xlink:attributeName",
        "xml:attributeName",
    ];
    const TARGETS: [&str; 12] = [
        "href",
        "xlink:href",
        "HREF",
        " href ",
        "onbegin",
        "onClick",
        "style",
        "STYLE",
        "fill",
        "opacity",
        "transform",
        "stroke-dashoffset",
    ];
    const VALUE_NAMES: [&str; 9] = [
        "values", "Values", "x:values", "from", "x:from", "to", "TO", "by", "y:by",
    ];
    const ITEMS: [&str; 7] = [
        "red",
        "#t",
        "0",
        " javascript:alert(1)",
        "JavaScript:void 0",
        "java&#9;script:alert(1)",
        "&#10;javascript:alert(1)",
    ];

    // SplitMix64: a fixed seed, so a failure reproduces.
    let mut state = 0x9e37_79b9_7f4a_7c15_u64;
    let mut next = |below: usize| {
        state = state.wrapping_add(0x9e37_79b9_7f4a_7c15);
        let mut z = state;
        z = (z ^ (z >> 30)).wrapping_mul(0xbf58_476d_1ce4_e5b9);
        z = (z ^ (z >> 27)).wrapping_mul(0x94d0_49bb_1331_11eb);
        usize::try_from((z ^ (z >> 31)) % below as u64).unwrap()
    };

    let (mut kept, mut dropped) = (0, 0);
    for _ in 0..3000 {
        let mut names: Vec<&str> = Vec::new();
        for _ in 0..1 + next(3) {
            names.push(TARGET_NAMES[next(TARGET_NAMES.len())]);
        }
        for _ in 0..next(4) {
            names.push(VALUE_NAMES[next(VALUE_NAMES.len())]);
        }
        names.sort_unstable();
        names.dedup();
        // Shuffled: a decoy may come before or after the attribute it hides.
        for i in (1..names.len()).rev() {
            names.swap(i, next(i + 1));
        }
        let mut animation = format!("<{}", ELEMENTS[next(ELEMENTS.len())]);
        for name in names {
            let value = if name.to_ascii_lowercase().ends_with("attributename") {
                TARGETS[next(TARGETS.len())].to_owned()
            } else {
                (0..1 + next(3))
                    .map(|_| ITEMS[next(ITEMS.len())])
                    .collect::<Vec<_>>()
                    .join(";")
            };
            animation.push_str(&format!(" {name}=\"{value}\""));
        }
        animation.push_str(" dur=\"1s\"/>");
        let source = animated(&animation);
        if let Some(line) = animations::unsafe_animation(&source) {
            panic!("{animation} emitted\n{line}");
        }
        if source.contains(" dur=\"1s\"") {
            kept += 1;
        } else {
            dropped += 1;
        }
    }
    // Both outcomes occur, so the property is not vacuous.
    assert!(
        kept > 100 && dropped > 100,
        "kept {kept}, dropped {dropped}"
    );
}
