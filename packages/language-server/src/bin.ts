#!/usr/bin/env node
// `lumiose-language-server --stdio` (also `--node-ipc`, `--socket=<port>`, `--pipe=<name>`).
// Runs from source on Node ≥ 24 via native type stripping.
import { createConnection, ProposedFeatures } from "vscode-languageserver/node";
import { compilerDiagnostics, projectDiagnostics } from "./providers.ts";
import { startServer } from "./server.ts";

startServer(createConnection(ProposedFeatures.all), {
  diagnosticProviders: [compilerDiagnostics],
  projectDiagnostics,
});
