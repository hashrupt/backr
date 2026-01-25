import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface ApplicationData {
  transactionScaling?: string;
  dailyTransactionsPerUser?: string;
  mainnetLaunchDate?: string;
  firstCustomers?: string;
  codeRepository?: string;
  bonafideControls?: string;
  noFAStatusImpact?: string;
  usesCantonCoinOrMarkers?: string;
}

interface InvestmentProfileProps {
  data: ApplicationData;
  category?: string | null;
}

// Parse scaling type for display
function getScalingInfo(scaling?: string): { label: string; color: string; icon: string } {
  if (!scaling) return { label: "Unknown", color: "bg-gray-100 text-gray-600", icon: "?" };

  const lower = scaling.toLowerCase();
  if (lower.includes("super") || lower.includes("exponential")) {
    return { label: "Super Linear", color: "bg-green-100 text-green-700", icon: "📈" };
  }
  if (lower.includes("linear")) {
    return { label: "Linear", color: "bg-blue-100 text-blue-700", icon: "📊" };
  }
  if (lower.includes("sub")) {
    return { label: "Sub Linear", color: "bg-amber-100 text-amber-700", icon: "📉" };
  }
  return { label: scaling.slice(0, 20), color: "bg-gray-100 text-gray-600", icon: "📊" };
}

// Parse launch date status
function getLaunchStatus(dateStr?: string): { status: string; color: string; daysAway?: number } {
  if (!dateStr) return { status: "TBD", color: "text-gray-500" };

  const lower = dateStr.toLowerCase();

  // Check if already live
  if (lower.includes("live") || lower.includes("launched") || lower.includes("production")) {
    return { status: "Live", color: "text-green-600" };
  }

  // Try to parse date
  const dateMatch = dateStr.match(/(\d{4})|Q([1-4])\s*(\d{4})?|(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i);
  if (dateMatch) {
    return { status: dateStr.slice(0, 30), color: "text-blue-600" };
  }

  return { status: dateStr.slice(0, 30), color: "text-gray-600" };
}

// Parse daily transactions
function parseDailyTxns(txnStr?: string): string {
  if (!txnStr) return "N/A";

  // Try to extract numbers
  const numMatch = txnStr.match(/(\d+(?:,\d{3})*(?:\.\d+)?)/);
  if (numMatch) {
    const num = parseFloat(numMatch[1].replace(/,/g, ""));
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  }

  return txnStr.slice(0, 15);
}

// Check if has customers
function getCustomerStatus(customers?: string): { status: string; color: string } {
  if (!customers) return { status: "Not specified", color: "text-gray-500" };

  const lower = customers.toLowerCase();
  if (lower.includes("live") || lower.includes("active") || lower.includes("confirmed") || lower.includes("signed")) {
    return { status: "Confirmed", color: "text-green-600" };
  }
  if (lower.includes("discussion") || lower.includes("pipeline") || lower.includes("negotiat")) {
    return { status: "In Pipeline", color: "text-blue-600" };
  }
  return { status: "Planned", color: "text-amber-600" };
}

export function InvestmentProfile({ data, category }: InvestmentProfileProps) {
  const scaling = getScalingInfo(data.transactionScaling);
  const launch = getLaunchStatus(data.mainnetLaunchDate);
  const dailyTxns = parseDailyTxns(data.dailyTransactionsPerUser);
  const customers = getCustomerStatus(data.firstCustomers);

  // Check indicators
  const hasCodeRepo = !!data.codeRepository;
  const hasFraudControls = !!data.bonafideControls && data.bonafideControls.toLowerCase() !== "no" && data.bonafideControls.toLowerCase() !== "n/a";
  const rewardType = data.usesCantonCoinOrMarkers?.toLowerCase().includes("coin") ? "CC" :
                     data.usesCantonCoinOrMarkers?.toLowerCase().includes("marker") ? "Activity" : "Both";

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Investment Profile</h2>
            <p className="text-xs text-muted-foreground">Key metrics for potential backers</p>
          </div>
          {category && (
            <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
              {category}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          {/* Launch Status */}
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Launch</p>
            <p className={`font-semibold ${launch.color}`}>{launch.status}</p>
          </div>

          {/* Scaling Model */}
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Scaling</p>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-sm font-medium ${scaling.color}`}>
              {scaling.icon} {scaling.label}
            </span>
          </div>

          {/* Daily Transactions */}
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Daily Txns/User</p>
            <p className="font-semibold">{dailyTxns}</p>
          </div>

          {/* Customer Status */}
          <div className="text-center p-3 bg-muted/30 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Customers</p>
            <p className={`font-semibold ${customers.color}`}>{customers.status}</p>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${hasCodeRepo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {hasCodeRepo ? "✓" : "✗"} Public Code
          </span>
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${hasFraudControls ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {hasFraudControls ? "✓" : "✗"} Fraud Controls
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-700">
            {rewardType} Rewards
          </span>
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground italic border-t pt-3">
          Based on self-reported data from Featured App application. Not independently verified.
        </p>
      </CardContent>
    </Card>
  );
}
