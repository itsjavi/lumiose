#!/bin/sh
# Seeds the corpus of each fuzz target with the crates' test fixtures (TASK-311): cargo-fuzz then
# mutates real components instead of starting from nothing. Run it before `cargo fuzz run`; the
# nightly workflow does, and keeps the grown corpora between runs.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)

seed() {
  target=$1
  shift
  dir="$root/fuzz/corpus/$target"
  mkdir -p "$dir"
  for fixtures in "$@"; do
    find "$root/$fixtures" -type f \( -name '*.stsx' -o -name '*.tsx' -o -name '*.ts' \) |
      while read -r file; do
        # Fixture names repeat across folders: the corpus file is named after its path.
        cp "$file" "$dir/$(printf '%s' "${file#"$root"/}" | tr '/' '_')"
      done
  done
}

compiler=crates/lumiose_compiler/tests/fixtures
seed scan "$compiler"
seed compile_client "$compiler"
seed compile_server "$compiler"
