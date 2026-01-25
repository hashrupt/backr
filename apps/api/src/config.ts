import { z } from "zod";
import "dotenv/config";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4001),
  HOST: z.string().default("0.0.0.0"),

  // Database
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: z.string().optional(),

  // Keycloak
  KEYCLOAK_URL: z.string().default("http://localhost:8080"),
  KEYCLOAK_REALM: z.string().default("backr"),
  KEYCLOAK_CLIENT_ID: z.string().default("backr-api"),

  // Canton Ledger
  CANTON_LEDGER_HOST: z.string().default("localhost"),
  CANTON_LEDGER_PORT: z.coerce.number().default(5011),
  CANTON_USE_TLS: z.string().default("false").transform((s) => s === "true"),
  CANTON_AUTH_TOKEN: z.string().optional(),
  SITE_VARIANT: z.enum(["A", "B"]).default("A"),
  DAML_MODEL_VERSION: z.string().default("1.0"),

  // Canton Scan Proxy (CIP-56)
  CANTON_SCAN_PROXY_URL: z.string().optional(),
  CANTON_SCAN_PROXY_TOKEN: z.string().optional(),

  // Validator Wallet (for scan-proxy context)
  VALIDATOR_HOST: z.string().default("http://localhost:3000"),

  // CORS
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export type Env = z.infer<typeof envSchema>;

function loadConfig(): Env {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    console.error("Invalid environment variables:", result.error.format());
    process.exit(1);
  }
  return result.data;
}

export const config = loadConfig();
