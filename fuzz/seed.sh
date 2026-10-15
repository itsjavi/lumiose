#!/bin/sh
# Seeds the corpus of each fuzz target with the crates' test fixtures (TASK-311, TASK-312):
# cargo-fuzz then mutates real inputs instead of starting from nothing. Run it before
# `cargo fuzz run`; the nightly workflow does, and keeps the grown corpora between runs.
set -eu
root=$(cd "$(dirname "$0")/.." && pwd)

# seed <target> "<extensions>" <directory>…: copies the files with those extensions.
seed() {
  target=$1
  extensions=$2
  shift 2
  dir="$root/fuzz/corpus/$target"
  mkdir -p "$dir"
  for fixtures in "$@"; do
    for extension in $extensions; do
      find "$root/$fixtures" -type f -name "*.$extension" -not -path '*/node_modules/*' |
        while read -r file; do
          # Fixture names repeat across folders: the corpus file is named after its path.
          cp "$file" "$dir/$(printf '%s' "${file#"$root"/}" | tr '/' '_')"
        done
    done
  done
}

compiler=crates/lumiose_compiler/tests/fixtures
seed scan "stsx tsx ts" "$compiler"
seed compile_client "stsx tsx ts" "$compiler"
seed compile_server "stsx tsx ts" "$compiler"
# Whole .stsx files are malformed CSS, which the pipeline must survive too.
seed css_process "css stsx" "$compiler" crates/lumiose_css/tests/fixtures
seed svg_component svg crates/lumiose_svg/tests/fixtures
seed content_markdown md crates/lumiose_content/tests/fixtures packages/lumiose/docs/concepts
seed content_html html crates/lumiose_content/tests/fixtures
