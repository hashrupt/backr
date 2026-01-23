import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
// import { CollaborationSuggestions } from "@/components/entities/CollaborationSuggestions";
import { formatCC } from "@/lib/constants";

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

export default async function EntityPage({ params }: EntityPageProps) {
  const { id } = await params;
  const entity = await getEntity(id);

  if (!entity) {
    notFound();
  }

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

      {/* Collaboration Suggestions - temporarily disabled */}
      {/* <CollaborationSuggestions entityId={entity.id} /> */}
    </div>
  );
}
