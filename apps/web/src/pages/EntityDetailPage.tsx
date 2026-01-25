import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { formatCC } from "@backr/shared";
import api, { ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyButton } from "@/components/ui/copy-button";
import { BackerInsights } from "@/components/entities/BackerInsights";
import { CollaborationSuggestions } from "@/components/entities/CollaborationSuggestions";
import { getKeywordIcon, extractOneLiner } from "@/lib/keyword-icons";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

interface EntityDetail {
  id: string;
  name: string;
  type: string;
  partyId: string;
  description?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  externalId?: string | null;
  category?: string | null;
  tags: string[];
  claimStatus: string;
  activeStatus: string;
  foundationStatus: string;
  targetAmount: string;
  currentAmount: string;
  applicationData?: ApplicationData | null;
  createdAt: string;
  owner?: { id: string; name: string | null; email: string } | null;
  campaigns: {
    id: string;
    title: string;
    targetAmount: string;
    currentAmount: string;
    status: string;
  }[];
  backings: {
    id: string;
    amount: string;
    status: string;
    user: { id: string; name: string | null };
  }[];
  _count: { campaigns: number; backings: number };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const categoryColors: Record<string, string> = {
  DeFi: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100",
  RWA: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100",
  Data: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100",
  Identity:
    "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  Gaming: "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100",
  Other: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
};

function claimStatusLabel(status: string): string {
  switch (status) {
    case "CLAIMED":
      return "Claimed";
    case "PENDING_CLAIM":
      return "Claim Pending";
    case "SELF_REGISTERED":
      return "Self-Registered";
    default:
      return "Available to Claim";
  }
}

function claimStatusVariant(
  status: string,
): "success" | "warning" | "outline" | "info" {
  switch (status) {
    case "CLAIMED":
      return "success";
    case "PENDING_CLAIM":
      return "warning";
    case "SELF_REGISTERED":
      return "info";
    default:
      return "outline";
  }
}

// ---------------------------------------------------------------------------
// ApplicationOverview (inline sub-component)
// ---------------------------------------------------------------------------

function ApplicationOverview({ data }: { data: ApplicationData }) {
  const fields: { label: string; value: string | undefined }[] = [
    { label: "Application Summary", value: data.applicationSummary },
    { label: "Transaction Scaling", value: data.transactionScaling },
    {
      label: "Daily Transactions / User",
      value: data.dailyTransactionsPerUser,
    },
    { label: "Mainnet Launch Date", value: data.mainnetLaunchDate },
    { label: "First Customers", value: data.firstCustomers },
    { label: "Code Repository", value: data.codeRepository },
    { label: "Bona-Fide Controls", value: data.bonafideControls },
    { label: "Impact Without FA Status", value: data.noFAStatusImpact },
    {
      label: "Uses Canton Coin / Markers",
      value: data.usesCantonCoinOrMarkers,
    },
    { label: "Expected Users", value: data.expectedUsers },
  ];

  const populated = fields.filter((f) => f.value);

  if (populated.length === 0) return null;

  return (
    <details className="group rounded-lg border">
      <summary className="flex cursor-pointer items-center justify-between p-4 font-semibold text-lg hover:bg-muted/50 transition-colors">
        <span>Application Overview</span>
        <svg
          className="h-5 w-5 text-muted-foreground transition-transform group-open:rotate-180"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </summary>
      <div className="border-t p-4 space-y-4">
        {populated.map((field) => (
          <div key={field.label}>
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {field.label}
            </p>
            {field.label === "Code Repository" && field.value ? (
              <a
                href={field.value}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline break-all"
              >
                {field.value}
              </a>
            ) : (
              <p className="text-sm whitespace-pre-wrap">{field.value}</p>
            )}
          </div>
        ))}
      </div>
    </details>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function EntityDetailSkeleton() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <Skeleton className="h-5 w-32 mb-6" />
      <div className="flex items-center gap-4 mb-8">
        <Skeleton className="h-20 w-20 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
        <Skeleton className="h-48" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page Component
// ---------------------------------------------------------------------------

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setNotFound(false);

    api
      .get<EntityDetail>(`/entities/${id}`)
      .then(setEntity)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        }
        setEntity(null);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // --- Loading State ---
  if (loading) {
    return <EntityDetailSkeleton />;
  }

  // --- Not Found ---
  if (notFound || !entity) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/entities"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-6"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Entities
        </Link>
        <div className="text-center py-20">
          <h1 className="text-2xl font-bold mb-2">Entity not found</h1>
          <p className="text-muted-foreground">
            The entity you are looking for does not exist or has been removed.
          </p>
          <Link to="/entities">
            <Button className="mt-6">Browse All Entities</Button>
          </Link>
        </div>
      </div>
    );
  }

  // --- Derived Values ---
  const partyIdParts = entity.partyId.split("::");
  const namespace = partyIdParts[0] || "";
  const identifier = partyIdParts[1] || "";
  const shortId =
    identifier.length > 16
      ? `${identifier.slice(0, 10)}...${identifier.slice(-6)}`
      : identifier;

  const oneLiner = extractOneLiner(entity.description);

  const target = parseFloat(entity.targetAmount) || 0;
  const current = parseFloat(entity.currentAmount) || 0;
  const progressPct = target > 0 ? Math.min((current / target) * 100, 100) : 0;

  const networkStatsPlaceholder = [
    { label: "Backers", value: "--" },
    { label: "Total Staked", value: "--" },
    { label: "Campaigns", value: String(entity._count.campaigns) },
    { label: "Backings", value: String(entity._count.backings) },
    { label: "Rank", value: "--" },
    { label: "Network Share", value: "--" },
  ];

  // --- Render ---
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back Link */}
      <Link
        to="/entities"
        className="inline-flex items-center gap-1 text-sm text-primary hover:underline mb-6"
      >
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Back to Entities
      </Link>

      {/* ---------------------------------------------------------------- */}
      {/* Entity Header                                                    */}
      {/* ---------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row items-start gap-5 mb-8">
        {entity.logoUrl ? (
          <img
            src={entity.logoUrl}
            alt={entity.name}
            className="h-20 w-20 rounded-xl object-cover"
          />
        ) : (
          <div className="h-20 w-20 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-3xl font-bold text-primary">
              {entity.name.charAt(0)}
            </span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{entity.name}</h1>
            <Badge variant={claimStatusVariant(entity.claimStatus)}>
              {claimStatusLabel(entity.claimStatus)}
            </Badge>
            {entity.category && (
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  categoryColors[entity.category] || categoryColors["Other"]
                }`}
              >
                {entity.category}
              </span>
            )}
            <Badge variant="outline">
              {entity.type === "FEATURED_APP" ? "Featured App" : "Validator"}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {entity.website && (
              <a
                href={entity.website}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                {entity.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </a>
            )}
            {entity.externalId && (
              <a
                href={entity.externalId}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                  />
                </svg>
                CF Link
              </a>
            )}
            {entity.owner && (
              <span>
                Owner: {entity.owner.name || entity.owner.email}
              </span>
            )}
            <span>
              Joined{" "}
              {new Date(entity.createdAt).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>

        {/* Claim button (if unclaimed) */}
        {entity.claimStatus === "UNCLAIMED" && (
          <Link to={`/claim-entity?partyId=${encodeURIComponent(entity.partyId)}`}>
            <Button>Claim This Entity</Button>
          </Link>
        )}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* About Section                                                    */}
      {/* ---------------------------------------------------------------- */}
      {(oneLiner || entity.description || entity.tags.length > 0) && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>About</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {oneLiner && (
              <p className="text-lg font-medium text-foreground">{oneLiner}</p>
            )}
            {entity.description && entity.description !== oneLiner && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {entity.description}
              </p>
            )}
            {entity.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2">
                {entity.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-sm"
                  >
                    <span>{getKeywordIcon(tag)}</span>
                    <span>{tag}</span>
                  </span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Network Stats Placeholder Grid                                   */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 mb-6">
        {networkStatsPlaceholder.map((stat) => (
          <div
            key={stat.label}
            className="rounded-lg border bg-card p-4 text-center"
          >
            <p className="text-2xl font-bold">{stat.value}</p>
            <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Details Grid                                                     */}
      {/* ---------------------------------------------------------------- */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* Party ID Card */}
        <Card>
          <CardHeader>
            <CardTitle>Party ID</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/50 rounded-lg p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-mono truncate"
                    title={entity.partyId}
                  >
                    <span className="text-primary">{namespace}</span>
                    <span className="text-muted-foreground">::</span>
                    <span>{shortId}</span>
                  </p>
                </div>
                <CopyButton text={entity.partyId} iconOnly />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Full Party ID on Canton Network
            </p>
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card>
          <CardHeader>
            <CardTitle>Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Active Status
                </span>
                <Badge
                  variant={
                    entity.activeStatus === "ACTIVE" ? "success" : "secondary"
                  }
                >
                  {entity.activeStatus}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Foundation Status
                </span>
                <Badge
                  variant={
                    entity.foundationStatus === "APPROVED"
                      ? "success"
                      : entity.foundationStatus === "PENDING"
                        ? "warning"
                        : "secondary"
                  }
                >
                  {entity.foundationStatus}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Claim Status
                </span>
                <Badge variant={claimStatusVariant(entity.claimStatus)}>
                  {claimStatusLabel(entity.claimStatus)}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Backing Progress Card */}
        <Card>
          <CardHeader>
            <CardTitle>Backing Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Current</span>
                <span className="font-semibold">
                  {formatCC(entity.currentAmount)} CC
                </span>
              </div>
              <Progress value={progressPct} />
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Target</span>
                <span className="font-semibold">
                  {formatCC(entity.targetAmount)} CC
                </span>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                {progressPct.toFixed(1)}% funded
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Statistics Card */}
        <Card>
          <CardHeader>
            <CardTitle>Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Active Campaigns
                </span>
                <span className="text-sm font-semibold">
                  {entity._count.campaigns}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Total Backings
                </span>
                <span className="text-sm font-semibold">
                  {entity._count.backings}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Entity Type
                </span>
                <span className="text-sm font-semibold">
                  {entity.type === "FEATURED_APP" ? "Featured App" : "Validator"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ---------------------------------------------------------------- */}
      {/* Backer Insights                                                  */}
      {/* ---------------------------------------------------------------- */}
      {entity.applicationData && (
        <BackerInsights
          data={entity.applicationData}
          category={entity.category}
        />
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Application Overview (collapsible)                               */}
      {/* ---------------------------------------------------------------- */}
      {entity.applicationData && (
        <div className="mb-6">
          <ApplicationOverview data={entity.applicationData} />
        </div>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Active Campaigns                                                 */}
      {/* ---------------------------------------------------------------- */}
      {entity.campaigns.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Active Campaigns</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {entity.campaigns.map((campaign) => {
                const cTarget = parseFloat(campaign.targetAmount) || 0;
                const cCurrent = parseFloat(campaign.currentAmount) || 0;
                const cPct =
                  cTarget > 0
                    ? Math.min((cCurrent / cTarget) * 100, 100)
                    : 0;

                return (
                  <Link
                    key={campaign.id}
                    to={`/campaigns/${campaign.id}`}
                    className="block"
                  >
                    <div className="flex items-center gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium truncate">
                            {campaign.title}
                          </span>
                          <Badge
                            variant={
                              campaign.status === "ACTIVE"
                                ? "success"
                                : "secondary"
                            }
                            className="shrink-0"
                          >
                            {campaign.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>
                            {formatCC(campaign.currentAmount)} /{" "}
                            {formatCC(campaign.targetAmount)} CC
                          </span>
                          <span>({cPct.toFixed(0)}%)</span>
                        </div>
                        <Progress value={cPct} className="mt-2" />
                      </div>
                      <svg
                        className="h-5 w-5 text-muted-foreground shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Recent Backings                                                  */}
      {/* ---------------------------------------------------------------- */}
      {entity.backings.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Recent Backings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {entity.backings.map((backing) => (
                <div
                  key={backing.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {(backing.user.name || "A").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        {backing.user.name || "Anonymous Backer"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatCC(backing.amount)} CC
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={
                      backing.status === "CONFIRMED"
                        ? "success"
                        : backing.status === "PENDING"
                          ? "warning"
                          : "secondary"
                    }
                  >
                    {backing.status}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ---------------------------------------------------------------- */}
      {/* Collaboration Suggestions                                        */}
      {/* ---------------------------------------------------------------- */}
      <CollaborationSuggestions entityId={entity.id} />
    </div>
  );
}
