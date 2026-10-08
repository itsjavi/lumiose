#!/usr/bin/env node
// `lumen` CLI entry (owner: Beacon). Runs from source on Node ≥ 24 via native type stripping.
import pkg from "../../package.json" with { type: "json" };

console.log(`lumen ${pkg.version}`);
