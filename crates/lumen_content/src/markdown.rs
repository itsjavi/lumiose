//! Markdown: frontmatter, rendering with comrak, heading ids.

use std::collections::HashSet;

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

pub(crate) fn to_html(body: &str) -> String {
    let mut options = comrak::Options::default();
    options.extension.strikethrough = true;
    options.extension.table = true;
    options.extension.autolink = true;
    options.extension.tasklist = true;
    options.extension.footnotes = true;
    // The project's own files: raw HTML is kept (GFM's tag filter would drop `<style>`).
    options.render.r#unsafe = true;
    comrak::markdown_to_html(body, &options)
}

/// Gives `<h1>`…`<h6>` without an id a GitHub-style slug of their text, unique in the file.
pub(crate) fn heading_ids(nodes: &[Handle]) {
    let mut elements = Vec::new();
    let mut stack: Vec<Handle> = nodes.iter().rev().cloned().collect();
    while let Some(node) = stack.pop() {
        if let Data::Element { .. } = node.data {
            stack.extend(node.children.borrow().iter().rev().cloned());
            elements.push(node);
        }
    }
    let mut used: HashSet<String> = elements.iter().filter_map(|e| e.attribute("id")).collect();
    for element in &elements {
        let heading = matches!(
            element.html_name(),
            Some("h1" | "h2" | "h3" | "h4" | "h5" | "h6")
        );
        if !heading || element.attribute("id").is_some() {
            continue;
        }
        let mut text = String::new();
        element.text_content(&mut text);
        let slug = slug(&text);
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
        used.insert(id);
    }
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
