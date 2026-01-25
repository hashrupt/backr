const siteVariant = import.meta.env.VITE_SITE_VARIANT || "A";
const damlVersion = import.meta.env.VITE_DAML_MODEL_VERSION || "1.0";
const appEnv = import.meta.env.VITE_APP_ENV || "development";

export function SiteIndicator() {
  // Hide in production
  if (appEnv === "production") return null;

  const colorClass =
    siteVariant === "A"
      ? "bg-blue-600 text-white"
      : "bg-purple-600 text-white";

  const envLabel =
    appEnv === "preview" ? "Preview" : appEnv.charAt(0).toUpperCase() + appEnv.slice(1);

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
