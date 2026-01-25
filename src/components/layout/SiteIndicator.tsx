"use client";

/**
 * Floating badge that shows which site variant (A or B) and DAML model
 * version this deploy is running. Visible in all non-production environments
 * so QA can tell sites apart at a glance.
 *
 * Reads NEXT_PUBLIC_SITE_VARIANT and NEXT_PUBLIC_DAML_MODEL_VERSION so the
 * values are available in the browser (server env vars are not).
 */

const siteVariant = process.env.NEXT_PUBLIC_SITE_VARIANT || "A";
const damlVersion = process.env.NEXT_PUBLIC_DAML_MODEL_VERSION || "1.0";
const vercelEnv = process.env.NEXT_PUBLIC_VERCEL_ENV || "development";

export function SiteIndicator() {
  // Hide in production
  if (vercelEnv === "production") return null;

  const colorClass =
    siteVariant === "A"
      ? "bg-blue-600 text-white"
      : "bg-purple-600 text-white";

  const envLabel =
    vercelEnv === "preview" ? "Preview" : vercelEnv.charAt(0).toUpperCase() + vercelEnv.slice(1);

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium shadow-lg ${colorClass}`}
    >
      <span className="opacity-75">{envLabel}</span>
      <span className="font-bold">Site {siteVariant}</span>
      <span className="opacity-75">v{damlVersion}</span>
    </div>
  );
}
