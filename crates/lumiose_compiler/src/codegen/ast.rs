//! Small AST construction helpers over OXC's node builders.
//!
//! Generated nodes use the span of the JSX they come from, so source maps point back at the
//! authored code. Names are arena-allocated `&'a str`.

use oxc_allocator::{Allocator, ArenaBox, ArenaVec, GetAllocator};
use oxc_ast::ast::*;
use oxc_ast::builder::{AstBuilder, GetAstBuilder};
use oxc_span::Span;
use oxc_syntax::number::NumberBase;
use oxc_syntax::operator::{BinaryOperator, UnaryOperator};

/// An AST builder plus convenience constructors for the shapes the codegen emits.
pub struct Ast<'a> {
    builder: AstBuilder<'a>,
}

impl<'a> GetAstBuilder<'a> for Ast<'a> {
    type Builder = AstBuilder<'a>;

    fn builder(&self) -> &AstBuilder<'a> {
        &self.builder
    }
}

impl<'a> GetAllocator<'a> for Ast<'a> {
    fn allocator(&self) -> &'a Allocator {
        self.builder.allocator()
    }
}

impl<'a> Ast<'a> {
    pub fn new(allocator: &'a Allocator) -> Self {
        Self {
            builder: AstBuilder::new(allocator),
        }
    }

    pub fn str(&self, s: &str) -> &'a str {
        self.allocator().alloc_str(s)
    }

    pub fn vec<T>(&self) -> ArenaVec<'a, T> {
        ArenaVec::new_in(self)
    }

    pub fn vec_from<T>(&self, items: impl IntoIterator<Item = T>) -> ArenaVec<'a, T> {
        ArenaVec::from_iter_in(items, self)
    }

    pub fn boxed<T>(&self, value: T) -> ArenaBox<'a, T> {
        ArenaBox::new_in(value, self)
    }

    // ---- expressions -------------------------------------------------------------------------

    pub fn ident(&self, span: Span, name: &str) -> Expression<'a> {
        Expression::new_identifier(span, self.str(name), self)
    }

    pub fn string(&self, span: Span, value: &str) -> Expression<'a> {
        Expression::new_string_literal(span, self.str(value), None, self)
    }

    pub fn number(&self, span: Span, value: f64) -> Expression<'a> {
        Expression::new_numeric_literal(span, value, None, NumberBase::Decimal, self)
    }

    pub fn boolean(&self, span: Span, value: bool) -> Expression<'a> {
        Expression::new_boolean_literal(span, value, self)
    }

    pub fn null(&self, span: Span) -> Expression<'a> {
        Expression::new_null_literal(span, self)
    }

    pub fn undefined(&self, span: Span) -> Expression<'a> {
        Expression::new_void_0(span, self)
    }

    /// A template literal without expressions; `raw` must already be escaped.
    pub fn template_literal(&self, span: Span, raw: &str) -> Expression<'a> {
        let raw = self.str(raw);
        let value = TemplateElementValue {
            raw: raw.into(),
            cooked: None,
        };
        let quasi = TemplateElement::new(span, value, true, self);
        Expression::new_template_literal(span, self.vec_from([quasi]), self.vec(), self)
    }

    pub fn member(&self, span: Span, object: Expression<'a>, property: &str) -> Expression<'a> {
        let property = IdentifierName::new(span, self.str(property), self);
        Expression::new_static_member_expression(span, object, property, false, self)
    }

    pub fn computed_member(
        &self,
        span: Span,
        object: Expression<'a>,
        property: Expression<'a>,
    ) -> Expression<'a> {
        Expression::new_computed_member_expression(span, object, property, false, self)
    }

    pub fn index(&self, span: Span, object: Expression<'a>, index: usize) -> Expression<'a> {
        let index = self.number(span, index as f64);
        self.computed_member(span, object, index)
    }

    pub fn call(
        &self,
        span: Span,
        callee: Expression<'a>,
        args: impl IntoIterator<Item = Expression<'a>>,
    ) -> Expression<'a> {
        let args = self.vec_from(args.into_iter().map(Argument::from));
        Expression::new_call_expression(span, callee, None, args, false, self)
    }

    /// A call annotated `/* @__PURE__ */` (tree-shakable when unused).
    pub fn call_pure(
        &self,
        span: Span,
        callee: Expression<'a>,
        args: impl IntoIterator<Item = Expression<'a>>,
    ) -> Expression<'a> {
        let args = self.vec_from(args.into_iter().map(Argument::from));
        Expression::new_call_expression_with_pure(span, callee, None, args, false, true, self)
    }

    pub fn not(&self, span: Span, argument: Expression<'a>) -> Expression<'a> {
        Expression::new_unary_expression(span, UnaryOperator::LogicalNot, argument, self)
    }

    pub fn binary(
        &self,
        span: Span,
        left: Expression<'a>,
        operator: BinaryOperator,
        right: Expression<'a>,
    ) -> Expression<'a> {
        Expression::new_binary_expression(span, left, operator, right, self)
    }

    /// `left ?? right`.
    pub fn coalesce(
        &self,
        span: Span,
        left: Expression<'a>,
        right: Expression<'a>,
    ) -> Expression<'a> {
        Expression::new_logical_expression(span, left, LogicalOperator::Coalesce, right, self)
    }

    pub fn conditional(
        &self,
        span: Span,
        test: Expression<'a>,
        consequent: Expression<'a>,
        alternate: Expression<'a>,
    ) -> Expression<'a> {
        Expression::new_conditional_expression(span, test, consequent, alternate, self)
    }

    pub fn array(
        &self,
        span: Span,
        elements: impl IntoIterator<Item = Expression<'a>>,
    ) -> Expression<'a> {
        let elements = self.vec_from(elements.into_iter().map(ArrayExpressionElement::from));
        Expression::new_array_expression(span, elements, self)
    }

    pub fn object(
        &self,
        span: Span,
        properties: impl IntoIterator<Item = ObjectPropertyKind<'a>>,
    ) -> Expression<'a> {
        Expression::new_object_expression(span, self.vec_from(properties), self)
    }

    pub fn params(&self, span: Span, names: &[&str]) -> ArenaBox<'a, FormalParameters<'a>> {
        let items = self.vec_from(names.iter().map(|name| self.param(span, name)));
        FormalParameters::boxed(
            span,
            FormalParameterKind::ArrowFormalParameters,
            items,
            None,
            self,
        )
    }

    pub fn param(&self, span: Span, name: &str) -> FormalParameter<'a> {
        let pattern = BindingPattern::new_binding_identifier(span, self.str(name), self);
        FormalParameter::new(
            span,
            self.vec(),
            pattern,
            None,
            None,
            false,
            None,
            false,
            false,
            self,
        )
    }

    /// `(params) => body`
    pub fn arrow(&self, span: Span, params: &[&str], body: Expression<'a>) -> Expression<'a> {
        let params = self.params(span, params);
        Expression::new_arrow_function_expression(
            span,
            false,
            None,
            params,
            None,
            ArrowFunctionBody::from(body),
            self,
        )
    }

    /// `(params) => { statements }`
    pub fn arrow_block(
        &self,
        span: Span,
        params: &[&str],
        statements: impl IntoIterator<Item = Statement<'a>>,
    ) -> Expression<'a> {
        let params = self.params(span, params);
        let body =
            ArrowFunctionBody::new_function_body(span, self.vec(), self.vec_from(statements), self);
        Expression::new_arrow_function_expression(span, false, None, params, None, body, self)
    }

    /// An arrow returning `value`, inlining `setup` statements when there are any.
    pub fn arrow_returning(
        &self,
        span: Span,
        params: &[&str],
        setup: Vec<Statement<'a>>,
        value: Expression<'a>,
    ) -> Expression<'a> {
        if setup.is_empty() {
            return self.arrow(span, params, value);
        }
        let mut statements = setup;
        statements.push(self.ret(span, value));
        self.arrow_block(span, params, statements)
    }

    /// `(() => { setup; return value; })()`, or `value` when there is no setup.
    pub fn iife(
        &self,
        span: Span,
        setup: Vec<Statement<'a>>,
        value: Expression<'a>,
    ) -> Expression<'a> {
        if setup.is_empty() {
            return value;
        }
        let function = self.arrow_returning(span, &[], setup, value);
        self.call(span, function, [])
    }

    pub fn function_body(
        &self,
        span: Span,
        statements: impl IntoIterator<Item = Statement<'a>>,
    ) -> ArenaBox<'a, FunctionBody<'a>> {
        FunctionBody::boxed(span, self.vec(), self.vec_from(statements), self)
    }

    // ---- object members ----------------------------------------------------------------------

    pub fn property_key(&self, span: Span, name: &str) -> PropertyKey<'a> {
        if is_identifier_name(name) {
            PropertyKey::new_static_identifier(span, self.str(name), self)
        } else {
            PropertyKey::new_string_literal(span, self.str(name), None, self)
        }
    }

    /// `name: value`
    pub fn property(
        &self,
        span: Span,
        name: &str,
        value: Expression<'a>,
    ) -> ObjectPropertyKind<'a> {
        let key = self.property_key(span, name);
        ObjectPropertyKind::new_object_property(
            span,
            PropertyKind::Init,
            key,
            value,
            false,
            false,
            false,
            self,
        )
    }

    /// `get name() { setup; return value; }`
    pub fn getter(
        &self,
        span: Span,
        name: &str,
        setup: Vec<Statement<'a>>,
        value: Expression<'a>,
    ) -> ObjectPropertyKind<'a> {
        let key = self.property_key(span, name);
        let mut statements = setup;
        statements.push(self.ret(span, value));
        let params = FormalParameters::boxed(
            span,
            FormalParameterKind::UniqueFormalParameters,
            self.vec(),
            None,
            self,
        );
        let body = self.function_body(span, statements);
        let function = Expression::new_function_expression(
            span,
            FunctionType::FunctionExpression,
            None,
            false,
            false,
            false,
            None,
            None,
            params,
            None,
            Some(body),
            self,
        );
        ObjectPropertyKind::new_object_property(
            span,
            PropertyKind::Get,
            key,
            function,
            false,
            false,
            false,
            self,
        )
    }

    pub fn spread_property(&self, span: Span, argument: Expression<'a>) -> ObjectPropertyKind<'a> {
        ObjectPropertyKind::new_spread_property(span, argument, self)
    }

    // ---- statements --------------------------------------------------------------------------

    pub fn ret(&self, span: Span, value: Expression<'a>) -> Statement<'a> {
        Statement::new_return_statement(span, Some(value), self)
    }

    pub fn expr_stmt(&self, span: Span, expression: Expression<'a>) -> Statement<'a> {
        Statement::new_expression_statement(span, expression, self)
    }

    pub fn declarator(
        &self,
        span: Span,
        name: &str,
        init: Expression<'a>,
    ) -> VariableDeclarator<'a> {
        let id = BindingPattern::new_binding_identifier(span, self.str(name), self);
        VariableDeclarator::new(span, id, None, Some(init), false, self)
    }

    /// `const a = x, b = y;`
    pub fn const_decls(
        &self,
        span: Span,
        declarators: impl IntoIterator<Item = (String, Expression<'a>)>,
    ) -> Statement<'a> {
        let declarators = self.vec_from(
            declarators
                .into_iter()
                .map(|(name, init)| self.declarator(span, &name, init)),
        );
        Statement::new_variable_declaration(
            span,
            VariableDeclarationKind::Const,
            declarators,
            false,
            self,
        )
    }

    pub fn const_decl(&self, span: Span, name: &str, init: Expression<'a>) -> Statement<'a> {
        self.const_decls(span, [(name.to_owned(), init)])
    }

    /// `object.property = value;`
    pub fn assign_member(
        &self,
        span: Span,
        object: Expression<'a>,
        property: &str,
        value: Expression<'a>,
    ) -> Statement<'a> {
        let property = IdentifierName::new(span, self.str(property), self);
        let target =
            AssignmentTarget::new_static_member_expression(span, object, property, false, self);
        let assignment = Expression::new_assignment_expression(
            span,
            oxc_syntax::operator::AssignmentOperator::Assign,
            target,
            value,
            self,
        );
        self.expr_stmt(span, assignment)
    }

    /// `import { a, b as c } from "source";` (`(imported, local)` pairs).
    pub fn import_named(&self, source: &str, names: &[(&str, &str)]) -> Statement<'a> {
        let span = Span::default();
        let specifiers = self.vec_from(names.iter().map(|(imported, local)| {
            ImportDeclarationSpecifier::new_import_specifier(
                span,
                ModuleExportName::new_identifier_name(span, self.str(imported), self),
                BindingIdentifier::new(span, self.str(local), self),
                ImportOrExportKind::Value,
                self,
            )
        }));
        let source = StringLiteral::new(span, self.str(source), None, self);
        Statement::new_import_declaration(
            span,
            Some(specifiers),
            source,
            None,
            None,
            ImportOrExportKind::Value,
            self,
        )
    }

    /// `import "source";`
    pub fn import_side_effect(&self, source: &str) -> Statement<'a> {
        let span = Span::default();
        let source = StringLiteral::new(span, self.str(source), None, self);
        Statement::new_import_declaration(
            span,
            None,
            source,
            None,
            None,
            ImportOrExportKind::Value,
            self,
        )
    }
}

/// True for names usable as an unquoted property key / identifier (ASCII subset).
pub fn is_identifier_name(name: &str) -> bool {
    let mut chars = name.chars();
    match chars.next() {
        Some(c) if c.is_ascii_alphabetic() || c == '_' || c == '$' => {}
        _ => return false,
    }
    chars.all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '$')
}
