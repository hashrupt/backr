import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface ApplicationData {
  codeRepository?: string;
  bonafideControls?: string;
  noFAStatusImpact?: string;
  firstCustomers?: string;
  mainnetLaunchDate?: string;
  transactionScaling?: string;
  documentationUrls?: string[];
}

interface RiskAssessmentProps {
  data: ApplicationData;
}

interface RiskFactor {
  name: string;
  status: "low" | "medium" | "high" | "unknown";
  detail: string;
}

function assessRisks(data: ApplicationData): RiskFactor[] {
  const risks: RiskFactor[] = [];

  // Code Transparency
  if (data.codeRepository) {
    risks.push({
      name: "Code Transparency",
      status: "low",
      detail: "Public repository available",
    });
  } else {
    risks.push({
      name: "Code Transparency",
      status: "high",
      detail: "No public code repository",
    });
  }

  // Fraud Controls
  if (data.bonafideControls) {
    const controls = data.bonafideControls.toLowerCase();
    if (controls.includes("no") || controls === "n/a" || controls.length < 10) {
      risks.push({
        name: "Fraud Prevention",
        status: "high",
        detail: "Limited fraud controls mentioned",
      });
    } else {
      risks.push({
        name: "Fraud Prevention",
        status: "low",
        detail: "Fraud controls in place",
      });
    }
  } else {
    risks.push({
      name: "Fraud Prevention",
      status: "unknown",
      detail: "Not specified",
    });
  }

  // FA Dependency
  if (data.noFAStatusImpact) {
    const impact = data.noFAStatusImpact.toLowerCase();
    if (impact.includes("critical") || impact.includes("cannot") || impact.includes("would not") || impact.includes("dependent")) {
      risks.push({
        name: "FA Dependency",
        status: "high",
        detail: "Highly dependent on FA status",
      });
    } else if (impact.includes("minimal") || impact.includes("continue") || impact.includes("alternative")) {
      risks.push({
        name: "FA Dependency",
        status: "low",
        detail: "Can operate without FA status",
      });
    } else {
      risks.push({
        name: "FA Dependency",
        status: "medium",
        detail: "Moderate dependency on FA status",
      });
    }
  } else {
    risks.push({
      name: "FA Dependency",
      status: "unknown",
      detail: "Not specified",
    });
  }

  // Customer Traction
  if (data.firstCustomers) {
    const customers = data.firstCustomers.toLowerCase();
    if (customers.includes("live") || customers.includes("active") || customers.includes("confirmed") || customers.includes("signed")) {
      risks.push({
        name: "Customer Traction",
        status: "low",
        detail: "Customers confirmed or active",
      });
    } else if (customers.includes("discussion") || customers.includes("pipeline")) {
      risks.push({
        name: "Customer Traction",
        status: "medium",
        detail: "Customers in pipeline",
      });
    } else {
      risks.push({
        name: "Customer Traction",
        status: "high",
        detail: "No confirmed customers yet",
      });
    }
  } else {
    risks.push({
      name: "Customer Traction",
      status: "unknown",
      detail: "Not specified",
    });
  }

  // Documentation
  if (data.documentationUrls && data.documentationUrls.length > 0) {
    risks.push({
      name: "Documentation",
      status: "low",
      detail: `${data.documentationUrls.length} doc(s) available`,
    });
  }

  return risks;
}

function calculateScore(risks: RiskFactor[]): number {
  let score = 50; // Start at neutral

  for (const risk of risks) {
    switch (risk.status) {
      case "low":
        score += 12;
        break;
      case "medium":
        score += 0;
        break;
      case "high":
        score -= 12;
        break;
      case "unknown":
        score -= 5;
        break;
    }
  }

  return Math.max(0, Math.min(100, score));
}

function getScoreColor(score: number): string {
  if (score >= 70) return "text-green-600";
  if (score >= 40) return "text-amber-600";
  return "text-red-600";
}

function getScoreLabel(score: number): string {
  if (score >= 80) return "Strong";
  if (score >= 60) return "Good";
  if (score >= 40) return "Fair";
  if (score >= 20) return "Weak";
  return "Poor";
}

function getStatusColor(status: RiskFactor["status"]): string {
  switch (status) {
    case "low":
      return "bg-green-500";
    case "medium":
      return "bg-amber-500";
    case "high":
      return "bg-red-500";
    default:
      return "bg-gray-300";
  }
}

function getStatusIcon(status: RiskFactor["status"]): string {
  switch (status) {
    case "low":
      return "✓";
    case "medium":
      return "~";
    case "high":
      return "!";
    default:
      return "?";
  }
}

export function RiskAssessment({ data }: RiskAssessmentProps) {
  const risks = assessRisks(data);
  const score = calculateScore(risks);
  const scoreColor = getScoreColor(score);
  const scoreLabel = getScoreLabel(score);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Risk Assessment</h2>
            <p className="text-xs text-muted-foreground">Automated analysis of application data</p>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-bold ${scoreColor}`}>{score}</p>
            <p className="text-xs text-muted-foreground">{scoreLabel}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Score Bar */}
        <div className="mb-4">
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${score >= 60 ? "bg-green-500" : score >= 40 ? "bg-amber-500" : "bg-red-500"}`}
              style={{ width: `${score}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>High Risk</span>
            <span>Low Risk</span>
          </div>
        </div>

        {/* Risk Factors */}
        <div className="space-y-2">
          {risks.map((risk, i) => (
            <div key={i} className="flex items-center gap-3 p-2 bg-muted/30 rounded">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${getStatusColor(risk.status)}`}>
                {getStatusIcon(risk.status)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{risk.name}</p>
                <p className="text-xs text-muted-foreground truncate">{risk.detail}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Disclaimer */}
        <p className="text-xs text-muted-foreground italic border-t pt-3 mt-4">
          Score calculated from self-reported application data. Conduct your own due diligence before backing.
        </p>
      </CardContent>
    </Card>
  );
}
