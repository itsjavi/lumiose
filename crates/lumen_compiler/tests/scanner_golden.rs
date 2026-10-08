//! Golden tests: each `tests/fixtures/scanner/*.{stsx,tsx}` has a `.masked` file (the
//! masked UTF-8 TSX) and a `.snap` file (blocks and diagnostics). Regenerate with
//! `UPDATE_GOLDEN=1 cargo test -p lumen_compiler --test scanner_golden`.
//!
//! Every masked output must parse as TSX, except fixtures named `broken-*`, whose source
//! is intentionally malformed.

mod support;

use lumen_compiler::scan;

#[test]
fn scanner_goldens() {
    let files = support::fixtures("scanner");
    assert!(!files.is_empty());
    for path in files {
        let name = path.file_name().unwrap().to_str().unwrap().to_owned();
        let source = std::fs::read_to_string(&path).unwrap();
        let result = scan(&source, &name);
        support::check_invariants(&source, &result);
        if !name.starts_with("broken-") {
            support::assert_masked_parses(&name, &source, &result);
        }
        support::assert_golden(
            &path.with_file_name(format!("{name}.masked")),
            result.masked(),
        );
        support::assert_golden(
            &path.with_file_name(format!("{name}.snap")),
            &support::summary(&source, &result),
        );
    }
}
