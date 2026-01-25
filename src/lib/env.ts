/**
 * Centralized environment configuration.
 *
 * Reads environment variables once and exposes typed helpers used by the
 * Canton service, deploy tooling, and the SiteIndicator component.
 *
 * A/B site architecture:
 *   - Each environment (dev, test, prod) deploys two sites: A and B
 *   - Sites share the same codebase and database
 *   - Differentiation is at the Canton ledger layer (DAML model version)
 *   - SITE_VARIANT and DAML_MODEL_VERSION control which Canton endpoint is used
 */

export const env = {
  /** "A" or "B" — identifies which Canton DAML model variant this site runs */
  siteVariant: (process.env.SITE_VARIANT || "A") as "A" | "B",

  /** DAML model version string, e.g. "1.0" or "2.0" */
  damlModelVersion: process.env.DAML_MODEL_VERSION || "1.0",

  /** Canton ledger URL for real DAML integration (currently mocked) */
  cantonLedgerUrl: process.env.CANTON_LEDGER_URL || "",

  /** true when NODE_ENV === 'production' */
  isProduction: process.env.NODE_ENV === "production",

  /** Vercel environment: "development" | "preview" | "production" */
  environment: (process.env.VERCEL_ENV || "development") as
    | "development"
    | "preview"
    | "production",

  /** Public site variant for client components */
  publicSiteVariant: (process.env.NEXT_PUBLIC_SITE_VARIANT || "A") as "A" | "B",
};

/** Short label for display — e.g. "Site A / DAML v1.0" */
export function siteLabel(): string {
  return `Site ${env.siteVariant} / DAML v${env.damlModelVersion}`;
}
