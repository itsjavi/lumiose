//! Custom properties set in JSX `style` props, for the project-wide `LUM3012` check (TASK-62).
//!
//! A property set here is often read by another file's CSS (a child component, global CSS), so
//! `compile()` only reports what the file sets and what its CSS reads (`CompileMeta`); hosts that
//! see every stylesheet of the project (the Vite build, `lumiose check`) report the unread ones.

use oxc_ast::ast::{
    Expression, JSXAttributeItem, JSXAttributeName, JSXAttributeValue, JSXOpeningElement,
    ObjectPropertyKind, Program, PropertyKey,
};
use oxc_ast_visit::{Visit, walk};

use crate::span::Span;

/// A custom property set in a `style` prop.
#[derive(Debug, Clone, PartialEq, Eq)]
#[cfg_attr(
    feature = "serde",
    derive(serde::Serialize),
    serde(rename_all = "camelCase")
)]
pub struct CustomPropertySet {
    /// The property name, including `--`.
    pub name: String,
    /// The name as written (the object key, or the name inside a `style` string).
    pub span: Span,
}

/// Every custom property the file's `style` props set (on elements and components), in source
/// order: `style={{ "--x": value }}` keys and `--x:` declarations of `style` strings.
pub fn set_in_style_props(program: &Program<'_>) -> Vec<CustomPropertySet> {
    let mut collector = Collector { found: Vec::new() };
    collector.visit_program(program);
    collector.found
}

struct Collector {
    found: Vec<CustomPropertySet>,
}

impl Collector {
    fn string(&mut self, text: &str, start: u32) {
        let mut offset = 0;
        for declaration in text.split(';') {
            let trimmed = declaration.trim_start();
            let lead = declaration.len() - trimmed.len();
            if let Some((name, _)) = trimmed.split_once(':') {
                let name = name.trim_end();
                if is_custom_property(name) {
                    let at = start + (offset + lead) as u32;
                    self.found.push(CustomPropertySet {
                        name: name.to_owned(),
                        span: Span::new(at, at + name.len() as u32),
                    });
                }
            }
            offset += declaration.len() + 1;
        }
    }

    fn expression(&mut self, expression: &Expression<'_>) {
        match expression.without_parentheses() {
            Expression::ObjectExpression(object) => {
                for property in &object.properties {
                    let ObjectPropertyKind::ObjectProperty(property) = property else {
                        continue;
                    };
                    if let PropertyKey::StringLiteral(key) = &property.key
                        && is_custom_property(&key.value)
                    {
                        self.found.push(CustomPropertySet {
                            name: key.value.to_string(),
                            // Without the quotes.
                            span: Span::new(key.span.start + 1, key.span.end - 1),
                        });
                    }
                }
            }
            Expression::StringLiteral(literal) => {
                self.string(&literal.value, literal.span.start + 1)
            }
            Expression::TemplateLiteral(template) if template.expressions.is_empty() => {
                if let Some(quasi) = template.quasis.first() {
                    self.string(&quasi.value.raw, quasi.span.start);
                }
            }
            _ => {}
        }
    }
}

impl<'a> Visit<'a> for Collector {
    fn visit_jsx_opening_element(&mut self, it: &JSXOpeningElement<'a>) {
        for attribute in &it.attributes {
            let JSXAttributeItem::Attribute(attribute) = attribute else {
                continue;
            };
            let JSXAttributeName::Identifier(name) = &attribute.name else {
                continue;
            };
            if name.name != "style" {
                continue;
            }
            match &attribute.value {
                Some(JSXAttributeValue::StringLiteral(literal)) => {
                    self.string(&literal.value, literal.span.start + 1);
                }
                Some(JSXAttributeValue::ExpressionContainer(container)) => {
                    if let Some(expression) = container.expression.as_expression() {
                        self.expression(expression);
                    }
                }
                _ => {}
            }
        }
        walk::walk_jsx_opening_element(self, it);
    }
}

fn is_custom_property(name: &str) -> bool {
    name.len() > 2
        && name.starts_with("--")
        && name[2..]
            .chars()
            .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
}

#[cfg(test)]
mod tests {
    use oxc_allocator::Allocator;
    use oxc_parser::Parser;
    use oxc_span::SourceType;

    use super::*;

    fn set(source: &str) -> Vec<(String, &str)> {
        let allocator = Allocator::default();
        let program = Parser::new(&allocator, source, SourceType::tsx())
            .parse()
            .program;
        set_in_style_props(&program)
            .into_iter()
            .map(|p| {
                let written = &source[p.span.start as usize..p.span.end as usize];
                (p.name, written)
            })
            .collect()
    }

    #[test]
    fn finds_object_keys_and_string_declarations() {
        let found = set(
            r#"const a = <div style={{ "--fill": x(), color: "red", "--gap": 1 }} />;
const b = <Card style="color: red; --accent: navy" />;
const c = <p style={`--w: 3px`}>{x}</p>;
const d = <p style={styles} data-x={{ "--no": 1 }} />;"#,
        );
        assert_eq!(
            found,
            [
                ("--fill".to_owned(), "--fill"),
                ("--gap".to_owned(), "--gap"),
                ("--accent".to_owned(), "--accent"),
                ("--w".to_owned(), "--w"),
            ]
        );
    }
}
