//! Markdown: frontmatter, rendering with comrak, heading ids.

use std::collections::HashSet;

use comrak::nodes::NodeValue;

use crate::dom::{Data, Handle};

/// `(frontmatter, body)`: a leading block between `---` lines (the closing one may be `...`).
pub(crate) fn split_frontmatter(source: &str) -> (Option<&str>, &str) {
    let text = source.strip_prefix('\u{feff}').unwrap_or(source);
    let Some(rest) = strip_line(text, "---") else {
        return (None, source);
    };
    let mut offset = 0;
    for line in rest.split_inclusive('\n') {
        let trimmed = line
            .trim_end_matches(['\n', '\r'])
            .trim_end_matches([' ', '\t']);
        if trimmed == "---" || trimmed == "..." {
            return (Some(&rest[..offset]), &rest[offset + line.len()..]);
        }
        offset += line.len();
    }
    (None, source)
}

/// `text` after a first line that is exactly `marker` (trailing spaces allowed).
fn strip_line<'a>(text: &'a str, marker: &str) -> Option<&'a str> {
    let rest = text.strip_prefix(marker)?;
    let rest = rest.trim_start_matches([' ', '\t']);
    rest.strip_prefix("\r\n")
        .or_else(|| rest.strip_prefix('\n'))
}

/// The HTML of a Markdown body, and the byte offsets in `body` of the `<script>` start tags of
/// its raw HTML (unsupported in Markdown, decision-22).
pub(crate) fn to_html(body: &str) -> (String, Vec<usize>) {
    let mut options = comrak::Options::default();
    options.extension.strikethrough = true;
    options.extension.table = true;
    options.extension.autolink = true;
    options.extension.tasklist = true;
    options.extension.footnotes = true;
    // The project's own files: raw HTML is kept (GFM's tag filter would drop `<style>`).
    options.render.r#unsafe = true;
    let arena = comrak::Arena::new();
    let root = comrak::parse_document(&arena, body, &options);
    let mut scripts = Vec::new();
    for node in root.descendants() {
        let ast = node.data();
        let literal = match &ast.value {
            NodeValue::HtmlBlock(block) => &block.literal,
            NodeValue::HtmlInline(html) => html,
            _ => continue,
        };
        for offset in script_tags(literal) {
            scripts.push(source_offset(
                body,
                ast.sourcepos.start.line,
                literal,
                offset,
            ));
        }
    }
    let mut html = String::new();
    // Writing to a `String` cannot fail.
    let _ = comrak::format_html(root, &options, &mut html);
    (html, scripts)
}

/// The offsets of the `<script` start tags in raw HTML, outside comments and script contents.
fn script_tags(html: &str) -> Vec<usize> {
    let lower = html.to_ascii_lowercase();
    let mut tags = Vec::new();
    let mut at = 0;
    while let Some(found) = lower[at..].find('<') {
        let start = at + found;
        let rest = &lower[start..];
        if rest.starts_with("<!--") {
            at = rest.find("-->").map_or(lower.len(), |end| start + end + 3);
        } else if rest.strip_prefix("<script").is_some_and(|after| {
            after.is_empty()
                || after.starts_with(|c: char| c.is_ascii_whitespace() || c == '>' || c == '/')
        }) {
            tags.push(start);
            at = rest
                .find("</script")
                .map_or(lower.len(), |end| start + end + 8);
        } else {
            at = start + 1;
        }
    }
    tags
}

/// The offset in `body` of the tag at `offset` in the raw HTML `literal` of a node that starts on
/// `line` (1-based). Container markers (`> `, list indentation) are not part of the literal, so
/// the tag is found again on its source line, as the same occurrence on that line.
fn source_offset(body: &str, line: usize, literal: &str, offset: usize) -> usize {
    let before = &literal[..offset];
    let line = line + before.matches('\n').count();
    let index = script_tags(&before[before.rfind('\n').map_or(0, |i| i + 1)..]).len();
    let line_start = body
        .split_inclusive('\n')
        .take(line.saturating_sub(1))
        .map(str::len)
        .sum::<usize>()
        .min(body.len());
    let source_line = body[line_start..].lines().next().unwrap_or("");
    script_tags(source_line)
        .get(index)
        .map_or(line_start, |tag| line_start + tag)
}

/// A heading of a Markdown file, for its `headings` export.
pub(crate) struct Heading {
    pub(crate) depth: u8,
    pub(crate) text: String,
    pub(crate) id: String,
}

/// Gives `<h1>`…`<h6>` without an id a GitHub-style slug of their text, unique in the file, and
/// returns the headings that have an id (all but those whose text has no slug), in document
/// order.
pub(crate) fn heading_ids(nodes: &[Handle]) -> Vec<Heading> {
    let mut elements = Vec::new();
    let mut stack: Vec<Handle> = nodes.iter().rev().cloned().collect();
    while let Some(node) = stack.pop() {
        if let Data::Element { .. } = node.data {
            stack.extend(node.children.borrow().iter().rev().cloned());
            elements.push(node);
        }
    }
    let mut used: HashSet<String> = elements.iter().filter_map(|e| e.attribute("id")).collect();
    let mut headings = Vec::new();
    for element in &elements {
        let depth = match element.html_name() {
            Some("h1") => 1,
            Some("h2") => 2,
            Some("h3") => 3,
            Some("h4") => 4,
            Some("h5") => 5,
            Some("h6") => 6,
            _ => continue,
        };
        let mut raw = String::new();
        element.text_content(&mut raw);
        let text = raw.split_whitespace().collect::<Vec<_>>().join(" ");
        let id = match element.attribute("id") {
            Some(id) => id,
            None => {
                let slug = slug(&raw);
                if slug.is_empty() {
                    continue;
                }
                let mut id = slug.clone();
                let mut n = 0;
                while used.contains(&id) {
                    n += 1;
                    id = format!("{slug}-{n}");
                }
                element.set_attribute("id", &id);
                used.insert(id.clone());
                id
            }
        };
        headings.push(Heading { depth, text, id });
    }
    headings
}

/// GitHub's heading slug: lowercase, punctuation and symbols removed, spaces as `-`.
fn slug(text: &str) -> String {
    text.trim()
        .chars()
        .filter(|c| c.is_alphanumeric() || matches!(c, ' ' | '-' | '_'))
        .flat_map(char::to_lowercase)
        .map(|c| if c == ' ' { '-' } else { c })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splits_frontmatter() {
        assert_eq!(
            split_frontmatter("---\ntitle: A\n---\n# A\n"),
            (Some("title: A\n"), "# A\n")
        );
        assert_eq!(
            split_frontmatter("\u{feff}--- \r\na: 1\r\n...\r\nx"),
            (Some("a: 1\r\n"), "x")
        );
        assert_eq!(split_frontmatter("---\n---\nx"), (Some(""), "x"));
        // A thematic break, not frontmatter.
        assert_eq!(split_frontmatter("---\nno end"), (None, "---\nno end"));
        assert_eq!(split_frontmatter("x\n---\na\n---\n").0, None);
    }

    #[test]
    fn slugs_like_github() {
        assert_eq!(slug("Hello, World!"), "hello-world");
        assert_eq!(slug(" Ünïcode  and `code` "), "ünïcode--and-code");
        assert_eq!(slug("snake_case & kebab-case"), "snake_case--kebab-case");
        assert_eq!(slug("!!!"), "");
    }
}
