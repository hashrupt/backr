import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { formatCC } from "@/lib/constants";

// Type for FA application data from tokenomics crawler
interface ApplicationData {
  institutionName?: string;
  applicationName?: string;
  institutionUrl?: string;
  responsibleEmails?: string[];
  codeRepository?: string;
  applicationSummary?: string;
  expectedUsers?: string;
  ledgerInteraction?: string;
  rewardActivities?: string;
  usesCantonCoinOrMarkers?: string;
  dailyTransactionsPerUser?: string;
  multipleTransactionConditions?: string;
  transactionScaling?: string;
  mainnetLaunchDate?: string;
  firstCustomers?: string;
  noFAStatusImpact?: string;
  bonafideControls?: string;
  additionalNotes?: string;
  organizationBackground?: string;
  documentationUrls?: string[];
  submissionDate?: string;
  topicUrl?: string;
}

// Application Overview component
function ApplicationOverview({ data }: { data: ApplicationData }) {
  const sections = [
    { label: "Application Summary", value: data.applicationSummary },
    { label: "Organization Background", value: data.organizationBackground },
    { label: "Expected Users", value: data.expectedUsers },
    { label: "Ledger Interaction", value: data.ledgerInteraction },
    { label: "Reward Activities", value: data.rewardActivities },
    { label: "Uses Canton Coin or Markers", value: data.usesCantonCoinOrMarkers },
    { label: "Daily Transactions per User", value: data.dailyTransactionsPerUser },
    { label: "Transaction Scaling", value: data.transactionScaling },
    { label: "MainNet Launch Date", value: data.mainnetLaunchDate },
    { label: "First Customers", value: data.firstCustomers },
    { label: "Bona Fide Controls", value: data.bonafideControls },
  ].filter(s => s.value);

  if (sections.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-lg font-semibold">Application Overview</h2>
        <p className="text-sm text-muted-foreground">Details from Featured App application</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.map(({ label, value }) => (
          <div key={label}>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">{label}</h3>
            <p className="text-sm whitespace-pre-wrap">{value}</p>
          </div>
        ))}
        {data.codeRepository && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Code Repository</h3>
            <a
              href={data.codeRepository}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline"
            >
              {data.codeRepository}
            </a>
          </div>
        )}
        {data.documentationUrls && data.documentationUrls.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-1">Documentation</h3>
            <div className="flex flex-wrap gap-2">
              {data.documentationUrls.map((url, i) => (
                <a
                  key={i}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline"
                >
                  Doc {i + 1}
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Collaboration suggestions component
interface CollaborationEntity {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  type: string;
}

function CollaborationPotential({
  suggestions,
  currentCategory
}: {
  suggestions: CollaborationEntity[];
  currentCategory: string | null;
}) {
  if (suggestions.length === 0) return null;

  // Category color mapping
  const categoryColors: Record<string, string> = {
    'DeFi': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
    'Infrastructure': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100',
    'RWA': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
    'Data': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100',
    'Identity': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
    'Gaming': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100',
    'Storage': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-100',
    'Other': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <h2 className="text-lg font-semibold">Collaboration Potential</h2>
        <p className="text-sm text-muted-foreground">
          Entities that may benefit from collaboration
          {currentCategory && ` (based on ${currentCategory} category)`}
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {suggestions.map((entity) => (
            <Link
              key={entity.id}
              href={`/entities/${entity.id}`}
              className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium truncate">{entity.name}</span>
                {entity.category && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ml-2 ${categoryColors[entity.category] || categoryColors['Other']}`}>
                    {entity.category}
                  </span>
                )}
              </div>
              {entity.description && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {entity.description}
                </p>
              )}
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface EntityPageProps {
  params: Promise<{ id: string }>;
}

async function getEntity(id: string) {
  const entity = await prisma.entity.findUnique({
    where: { id },
    include: {
      owner: {
        select: { id: true, name: true, email: true },
      },
      campaigns: {
        where: { status: "OPEN" },
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          title: true,
          targetAmount: true,
          currentAmount: true,
          status: true,
        },
      },
      backings: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          amount: true,
          status: true,
          user: {
            select: { id: true, name: true },
          },
        },
      },
      _count: {
        select: { campaigns: true, backings: true },
      },
    },
  });

  return entity;
}

// Get collaboration suggestions based on category
async function getCollaborationSuggestions(entityId: string, category: string | null) {
  if (!category) return [];

  // Find entities in same category or complementary categories
  const complementaryCategories: Record<string, string[]> = {
    'DeFi': ['Infrastructure', 'Data', 'Identity', 'RWA'],
    'Infrastructure': ['DeFi', 'Data', 'Identity'],
    'RWA': ['DeFi', 'Identity', 'Data'],
    'Data': ['DeFi', 'Infrastructure', 'RWA'],
    'Identity': ['DeFi', 'RWA', 'Infrastructure'],
    'Gaming': ['Infrastructure', 'DeFi'],
    'Storage': ['Data', 'Infrastructure'],
  };

  const relatedCategories = [category, ...(complementaryCategories[category] || [])];

  const suggestions = await prisma.entity.findMany({
    where: {
      id: { not: entityId },
      category: { in: relatedCategories },
    },
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      type: true,
    },
    orderBy: [
      // Prioritize same category
      { category: 'asc' },
      { name: 'asc' },
    ],
    take: 6,
  });

  // Sort to prioritize same category first
  return suggestions.sort((a, b) => {
    if (a.category === category && b.category !== category) return -1;
    if (a.category !== category && b.category === category) return 1;
    return 0;
  });
}

export default async function EntityPage({ params }: EntityPageProps) {
  const { id } = await params;
  const entity = await getEntity(id);

  if (!entity) {
    notFound();
  }

  // Fetch collaboration suggestions
  const collaborationSuggestions = await getCollaborationSuggestions(id, entity.category);

  const targetNum = parseFloat(entity.targetAmount.toString());
  const currentNum = parseFloat(entity.currentAmount.toString());
  const fundingProgress = targetNum > 0 ? (currentNum / targetNum) * 100 : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/entities"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Featured Apps
      </Link>

      {/* Header */}
      <div className="flex items-start gap-6 mb-8">
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
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold">{entity.name}</h1>
            <Badge variant={entity.claimStatus === "CLAIMED" ? "success" : "secondary"}>
              {entity.claimStatus === "CLAIMED" ? "Claimed" : "Unclaimed"}
            </Badge>
          </div>
          <p className="text-lg text-muted-foreground">
            {entity.type === "FEATURED_APP" ? "Featured App" : "Validator"}
          </p>
          <div className="flex gap-4">
            {entity.website && (
              <a
                href={entity.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm"
              >
                {entity.website}
              </a>
            )}
            {entity.externalId && (
              <a
                href={entity.externalId}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-sm"
              >
                CF Link
              </a>
            )}
          </div>
        </div>
        {entity.claimStatus === "UNCLAIMED" && (
          <Link href={`/claim-entity?partyId=${encodeURIComponent(entity.partyId)}`}>
            <Button size="lg">Claim This Entity</Button>
          </Link>
        )}
      </div>

      {/* Description */}
      {entity.description && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">About</h2>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">{entity.description}</p>
          </CardContent>
        </Card>
      )}

      {/* Details Grid */}
      <div className="grid gap-6 md:grid-cols-2 mb-6">
        {/* Party ID */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Party ID</h2>
          </CardHeader>
          <CardContent>
            <code className="text-xs bg-muted p-3 rounded-md block break-all font-mono">
              {entity.partyId}
            </code>
            <CopyButton text={entity.partyId} className="mt-2 text-sm text-primary hover:underline" />
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Status</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Claim Status</span>
              <Badge variant={entity.claimStatus === "CLAIMED" ? "success" : "secondary"}>
                {entity.claimStatus.replace("_", " ")}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Active Status</span>
              <Badge variant={entity.activeStatus === "ACTIVE" ? "success" : "secondary"}>
                {entity.activeStatus.replace("_", " ")}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Foundation Status</span>
              <Badge variant={entity.foundationStatus === "APPROVED" ? "success" : "secondary"}>
                {entity.foundationStatus}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Funding Progress */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Backing Progress</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current</span>
                <span className="font-medium">{formatCC(entity.currentAmount)} CC</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${Math.min(fundingProgress, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Target</span>
                <span className="font-medium">{formatCC(entity.targetAmount)} CC</span>
              </div>
              <p className="text-center text-lg font-semibold mt-2">
                {fundingProgress.toFixed(1)}% funded
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Statistics</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Campaigns</span>
              <span className="font-medium">{entity._count.campaigns}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Backings</span>
              <span className="font-medium">{entity._count.backings}</span>
            </div>
            {entity.owner && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Owner</span>
                <span className="font-medium">{entity.owner.name || "Anonymous"}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Registered</span>
              <span className="font-medium">
                {new Date(entity.createdAt).toLocaleDateString()}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Application Overview - FA Application Data */}
      {entity.applicationData && (
        <ApplicationOverview data={entity.applicationData as ApplicationData} />
      )}

      {/* Active Campaigns */}
      {entity.campaigns.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">Active Campaigns</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {entity.campaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="block p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div className="flex justify-between items-center">
                    <span className="font-medium">{campaign.title}</span>
                    <Badge variant="success">{campaign.status}</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {formatCC(campaign.currentAmount)} / {formatCC(campaign.targetAmount)} CC
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Backings */}
      {entity.backings.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <h2 className="text-lg font-semibold">Recent Backings</h2>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {entity.backings.map((backing) => (
                <div
                  key={backing.id}
                  className="flex justify-between items-center p-3 rounded-lg border"
                >
                  <span className="font-medium">
                    {backing.user.name || "Anonymous"}
                  </span>
                  <div className="text-right">
                    <span className="font-medium">{formatCC(backing.amount)} CC</span>
                    <Badge variant="secondary" className="ml-2">
                      {backing.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collaboration Potential */}
      <CollaborationPotential
        suggestions={collaborationSuggestions}
        currentCategory={entity.category}
      />
    </div>
  );
}
