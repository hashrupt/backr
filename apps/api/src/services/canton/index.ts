/**
 * Canton Service Exports
 *
 * Currently exports mock implementation.
 * When CANTON_LEDGER_HOST is configured, the real client can be used.
 *
 * Usage:
 *   import { cantonService } from "./services/canton/index.js";  // Mock
 *   import { cantonClient } from "./services/canton/client.js";  // Real
 */

// Types
export * from "./types.js";

// Mock implementation (current default)
export { cantonService, default } from "./mock.js";

// Real Canton client (for when ledger is connected)
export { cantonClient, TEMPLATE_IDS, CHOICES } from "./client.js";
export type {
  ActiveContract,
  CreatedContract,
  CommandResult,
  DisclosedContract,
  CantonHealthStatus,
} from "./client.js";

// Scan-proxy client (for CIP-56 token operations)
export { scanProxyClient } from "./scan-proxy.js";
