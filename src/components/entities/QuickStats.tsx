interface ApplicationData {
  transactionScaling?: string;
  mainnetLaunchDate?: string;
  codeRepository?: string;
  firstCustomers?: string;
}

interface QuickStatsProps {
  data: ApplicationData | null;
}

// Minimal indicators for card view
export function QuickStats({ data }: QuickStatsProps) {
  if (!data) return null;

  const indicators: { icon: string; label: string; color: string }[] = [];

  // Launch status
  if (data.mainnetLaunchDate) {
    const lower = data.mainnetLaunchDate.toLowerCase();
    if (lower.includes("live") || lower.includes("launched") || lower.includes("production")) {
      indicators.push({ icon: "🟢", label: "Live", color: "text-green-600" });
    } else {
      indicators.push({ icon: "📅", label: "Planned", color: "text-blue-600" });
    }
  }

  // Scaling
  if (data.transactionScaling) {
    const lower = data.transactionScaling.toLowerCase();
    if (lower.includes("super") || lower.includes("exponential")) {
      indicators.push({ icon: "📈", label: "High Growth", color: "text-green-600" });
    } else if (lower.includes("linear")) {
      indicators.push({ icon: "📊", label: "Steady", color: "text-blue-600" });
    }
  }

  // Code transparency
  if (data.codeRepository) {
    indicators.push({ icon: "💻", label: "Open Source", color: "text-green-600" });
  }

  // Customer status
  if (data.firstCustomers) {
    const lower = data.firstCustomers.toLowerCase();
    if (lower.includes("live") || lower.includes("active") || lower.includes("confirmed")) {
      indicators.push({ icon: "👥", label: "Active Users", color: "text-green-600" });
    }
  }

  if (indicators.length === 0) return null;

  // Show max 3 indicators
  const display = indicators.slice(0, 3);

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {display.map((ind, i) => (
        <span
          key={i}
          className={`inline-flex items-center gap-1 text-xs ${ind.color}`}
          title={ind.label}
        >
          <span>{ind.icon}</span>
          <span className="hidden sm:inline">{ind.label}</span>
        </span>
      ))}
    </div>
  );
}
