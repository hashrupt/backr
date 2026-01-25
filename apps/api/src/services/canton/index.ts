// Canton Service Export
// TODO: DAML_INTEGRATION - Switch from mock to real implementation
// When real DAML integration is added, use config.DAML_MODEL_VERSION
// and config.CANTON_LEDGER_URL to connect to the correct Canton endpoint.
// Site A and Site B will talk to different Canton ledger URLs.
// See: apps/api/src/config.ts for environment configuration.

export * from "./types.js";
export { cantonService, default } from "./mock.js";
