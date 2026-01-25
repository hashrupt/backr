// Canton Service Export
// TODO: DAML_INTEGRATION - Switch from mock to real implementation
// When real DAML integration is added, use env.damlModelVersion
// and env.cantonLedgerUrl to connect to the correct Canton endpoint.
// Site A and Site B will talk to different Canton ledger URLs.
// See: src/lib/env.ts for environment configuration.

export * from "./types";
export { cantonService, default } from "./mock";
