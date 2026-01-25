import { Card, CardContent } from "@/components/ui/card";

interface ApplicationData {
  transactionScaling?: string;
  dailyTransactionsPerUser?: string;
  mainnetLaunchDate?: string;
  firstCustomers?: string;
  codeRepository?: string;
  bonafideControls?: string;
  noFAStatusImpact?: string;
  usesCantonCoinOrMarkers?: string;
  applicationSummary?: string;
  expectedUsers?: string;
}

// Extract one-sentence highlight from app summary
function getHighlight(data: ApplicationData): string | null {
  const summary = data.applicationSummary;
  if (!summary) return null;

  // Take first sentence (up to first period, exclamation, or ~120 chars)
  const firstSentence = summary.match(/^[^.!?]+[.!?]?/)?.[0] || summary;
  if (firstSentence.length <= 120) return firstSentence.trim();

  // Truncate at word boundary
  const truncated = firstSentence.slice(0, 120).replace(/\s+\S*$/, "");
  return truncated + "...";
}

interface BackerInsightsProps {
  data: ApplicationData;
  category?: string | null;
  networkStats?: {
    totalApps: number;
    appsWithCode: number;
    appsWithCustomers: number;
    appsLive: number;
  };
}

type Signal = "green" | "yellow" | "red" | "gray";

interface Indicator {
  label: string;
  signal: Signal;
}

interface Insight {
  icon: string;
  text: string;
  sentiment: "positive" | "neutral" | "warning";
}

// Analyze data and return indicators
function getIndicators(data: ApplicationData): Indicator[] {
  const indicators: Indicator[] = [];

  // Launch status
  const launch = data.mainnetLaunchDate?.toLowerCase() || "";
  if (launch.includes("live") || launch.includes("launched") || launch.includes("production")) {
    indicators.push({ label: "Live", signal: "green" });
  } else if (launch && launch !== "tbd") {
    indicators.push({ label: "Planned", signal: "yellow" });
  } else {
    indicators.push({ label: "TBD", signal: "gray" });
  }

  // Customer status
  const customers = data.firstCustomers?.toLowerCase() || "";
  if (customers.includes("live") || customers.includes("active") || customers.includes("confirmed") || customers.includes("signed")) {
    indicators.push({ label: "Customers", signal: "green" });
  } else if (customers.includes("discussion") || customers.includes("pipeline")) {
    indicators.push({ label: "Pipeline", signal: "yellow" });
  } else {
    indicators.push({ label: "No Users", signal: "red" });
  }

  // Code transparency
  if (data.codeRepository) {
    indicators.push({ label: "Open Code", signal: "green" });
  } else {
    indicators.push({ label: "Closed", signal: "red" });
  }

  // Fraud controls
  const controls = data.bonafideControls?.toLowerCase() || "";
  if (controls && controls !== "no" && controls !== "n/a" && controls.length > 10) {
    indicators.push({ label: "Controls", signal: "green" });
  } else {
    indicators.push({ label: "No Controls", signal: "red" });
  }

  // Scaling
  const scaling = data.transactionScaling?.toLowerCase() || "";
  if (scaling.includes("super") || scaling.includes("exponential")) {
    indicators.push({ label: "High Growth", signal: "green" });
  } else if (scaling.includes("linear")) {
    indicators.push({ label: "Steady", signal: "yellow" });
  }

  return indicators;
}

// Calculate score from indicators
function calculateScore(indicators: Indicator[]): number {
  let score = 50;
  for (const ind of indicators) {
    if (ind.signal === "green") score += 10;
    else if (ind.signal === "yellow") score += 3;
    else if (ind.signal === "red") score -= 8;
  }
  return Math.max(0, Math.min(100, score));
}

// Generate 3 key insights
function generateInsights(data: ApplicationData, score: number): Insight[] {
  const insights: Insight[] = [];

  // Launch insight
  const launch = data.mainnetLaunchDate?.toLowerCase() || "";
  if (launch.includes("live") || launch.includes("launched")) {
    insights.push({ icon: "🚀", text: "Already live on MainNet", sentiment: "positive" });
  } else if (data.mainnetLaunchDate && launch !== "tbd") {
    insights.push({ icon: "📅", text: `Launch planned: ${data.mainnetLaunchDate.slice(0, 30)}`, sentiment: "neutral" });
  }

  // Customer insight
  const customers = data.firstCustomers?.toLowerCase() || "";
  if (customers.includes("live") || customers.includes("active") || customers.includes("confirmed")) {
    insights.push({ icon: "✅", text: "Has confirmed or active customers", sentiment: "positive" });
  } else if (customers.includes("pipeline") || customers.includes("discussion")) {
    insights.push({ icon: "🤝", text: "Customers in pipeline/discussion", sentiment: "neutral" });
  }

  // Scaling insight
  const scaling = data.transactionScaling?.toLowerCase() || "";
  if (scaling.includes("super") || scaling.includes("exponential")) {
    insights.push({ icon: "📈", text: "High growth potential (super-linear)", sentiment: "positive" });
  } else if (scaling.includes("linear")) {
    insights.push({ icon: "📊", text: "Steady linear growth expected", sentiment: "neutral" });
  }

  // Code transparency
  if (!data.codeRepository) {
    insights.push({ icon: "⚠️", text: "No public code repository", sentiment: "warning" });
  } else {
    insights.push({ icon: "💻", text: "Open source code available", sentiment: "positive" });
  }

  // FA Dependency
  const faDep = data.noFAStatusImpact?.toLowerCase() || "";
  if (faDep.includes("critical") || faDep.includes("cannot") || faDep.includes("would not")) {
    insights.push({ icon: "⚠️", text: "Highly dependent on FA status", sentiment: "warning" });
  }

  // Return top 3 most relevant
  return insights.slice(0, 3);
}

// Get comparison bar data
function getComparisonBars(
  data: ApplicationData,
  networkStats?: BackerInsightsProps["networkStats"]
): { label: string; value: number; benchmark: number; better: boolean }[] {
  const bars: { label: string; value: number; benchmark: number; better: boolean }[] = [];

  // Default benchmarks if no network stats
  const stats = networkStats || { totalApps: 90, appsWithCode: 25, appsWithCustomers: 40, appsLive: 15 };

  // Code transparency
  const hasCode = data.codeRepository ? 100 : 0;
  const codeBenchmark = Math.round((stats.appsWithCode / stats.totalApps) * 100);
  bars.push({ label: "Transparency", value: hasCode, benchmark: codeBenchmark, better: hasCode > codeBenchmark });

  // Customer traction
  const customers = data.firstCustomers?.toLowerCase() || "";
  const hasTraction = customers.includes("live") || customers.includes("confirmed") || customers.includes("active") ? 100 :
                      customers.includes("pipeline") || customers.includes("discussion") ? 60 : 20;
  const tractionBenchmark = Math.round((stats.appsWithCustomers / stats.totalApps) * 100);
  bars.push({ label: "Traction", value: hasTraction, benchmark: tractionBenchmark, better: hasTraction > tractionBenchmark });

  // Launch readiness
  const launch = data.mainnetLaunchDate?.toLowerCase() || "";
  const launchReady = launch.includes("live") || launch.includes("launched") ? 100 :
                      launch && launch !== "tbd" ? 70 : 30;
  const launchBenchmark = Math.round((stats.appsLive / stats.totalApps) * 100);
  bars.push({ label: "Launch Ready", value: launchReady, benchmark: launchBenchmark, better: launchReady > launchBenchmark });

  return bars;
}

function getSignalColor(signal: Signal): string {
  switch (signal) {
    case "green": return "bg-green-500";
    case "yellow": return "bg-amber-400";
    case "red": return "bg-red-500";
    default: return "bg-gray-300";
  }
}

function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600 border-green-500";
  if (score >= 50) return "text-amber-600 border-amber-500";
  return "text-red-600 border-red-500";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 65) return "Good";
  if (score >= 50) return "Fair";
  return "Weak";
}

export function BackerInsights({ data, category, networkStats }: BackerInsightsProps) {
  const indicators = getIndicators(data);
  const score = calculateScore(indicators);
  const insights = generateInsights(data, score);
  const bars = getComparisonBars(data, networkStats);
  const highlight = getHighlight(data);

  return (
    <Card className="mb-6">
      <CardContent className="pt-6">
        <div className="flex gap-6">
          {/* Left: Score Circle */}
          <div className="flex-shrink-0 text-center">
            <div className={`w-20 h-20 rounded-full border-4 flex flex-col items-center justify-center ${getScoreColor(score)}`}>
              <span className="text-2xl font-bold">{score}</span>
              <span className="text-xs">{getScoreLabel(score)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Backer Score</p>
          </div>

          {/* Right: Content */}
          <div className="flex-1 min-w-0">
            {/* One-line highlight */}
            {highlight && (
              <p className="text-sm text-foreground mb-3 italic">&ldquo;{highlight}&rdquo;</p>
            )}

            {/* Traffic Light Indicators */}
            <div className="flex flex-wrap gap-2 mb-4">
              {indicators.map((ind, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-muted/50 rounded text-xs"
                >
                  <span className={`w-2 h-2 rounded-full ${getSignalColor(ind.signal)}`} />
                  {ind.label}
                </span>
              ))}
              {category && (
                <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium">
                  {category}
                </span>
              )}
            </div>

            {/* Key Insights */}
            <div className="space-y-1.5 mb-4">
              {insights.map((insight, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-2 text-sm ${
                    insight.sentiment === "warning" ? "text-amber-700" :
                    insight.sentiment === "positive" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <span>{insight.icon}</span>
                  <span>{insight.text}</span>
                </div>
              ))}
            </div>

            {/* Comparison Bars */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">vs Network Average</p>
              {bars.map((bar, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-xs w-20 text-muted-foreground">{bar.label}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden relative">
                    {/* Benchmark marker */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10"
                      style={{ left: `${bar.benchmark}%` }}
                    />
                    {/* Value bar */}
                    <div
                      className={`h-full rounded-full ${bar.better ? "bg-green-500" : "bg-amber-500"}`}
                      style={{ width: `${bar.value}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium w-16 ${bar.better ? "text-green-600" : "text-amber-600"}`}>
                    {bar.better ? "Above" : "Below"} avg
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground italic mt-4 pt-3 border-t">
          Based on self-reported FA application data. Not independently verified. DYOR.
        </p>
      </CardContent>
    </Card>
  );
}
