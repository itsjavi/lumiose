#!/usr/bin/env node
// `lumiose` CLI entry (owner: Beacon). Runs from source on Node ≥ 24 via native type stripping.
import { main } from "./main.ts";

process.exitCode = await main(process.argv.slice(2));
