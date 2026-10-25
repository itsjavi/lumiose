#!/usr/bin/env node
// `stsx` CLI entry. Runs from source on Node ≥ 24 via native type stripping.
import { main } from "./cli.ts";

process.exitCode = main(process.argv.slice(2));
