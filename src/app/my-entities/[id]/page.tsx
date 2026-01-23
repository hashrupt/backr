import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
// import { CollaborationSuggestions } from "@/components/entities/CollaborationSuggestions";
import { formatCC } from "@/lib/constants";
import { EntityType, CampaignStatus } from "@/types";

interface EntityPageProps {
  params: Promise<{ id: string }>;
}

async function getEntity(id: string, userId: string) {
  const entity = await prisma.entity.findFirst({
    where: { id, ownerId: userId },
    include: {
      campaigns: {
        orderBy: { createdAt: "desc" },
        include: {
          _count: {
            select: { interests: true, backings: true },
          },
        },
      },
    },
  });

  return entity;
}

export default async function EntityPage({ params }: EntityPageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/my-entities");
  }

  const { id } = await params;
  const entity = await getEntity(id, session.user.id);

  if (!entity) {
    notFound();
  }

  const target = Number(entity.targetAmount);
  const current = Number(entity.currentAmount);
  const percentage = target > 0 ? (current / target) * 100 : 0;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/my-entities"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <svg
          className="mr-2 h-4 w-4"
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
        Back to My Entities
      </Link>

      {/* Entity Header */}
      <Card className="mb-8">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              {entity.logoUrl ? (
                <img
                  src={entity.logoUrl}
                  alt={entity.name}
                  className="h-20 w-20 rounded-xl object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-xl bg-muted flex items-center justify-center">
                  <span className="text-3xl font-bold text-muted-foreground">
                    {entity.name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{entity.name}</h1>
                <p className="text-muted-foreground">
                  {entity.type === EntityType.FEATURED_APP
                    ? "Featured App"
                    : "Validator"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  PartyId: {entity.partyId}
                </p>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              <Link href={`/my-entities/${entity.id}/edit`}>
                <Button variant="outline" size="sm">
                  Edit Profile
                </Button>
              </Link>
              <Badge
                variant={
                  entity.activeStatus === "ACTIVE" ? "success" : "secondary"
                }
              >
                {entity.activeStatus}
              </Badge>
            </div>
          </div>

          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Backing Progress</span>
              <span className="font-medium">{percentage.toFixed(0)}%</span>
            </div>
            <Progress value={current} max={target} />
            <p className="text-sm text-muted-foreground mt-2">
              {formatCC(current.toString())} / {formatCC(target.toString())} CC
              required
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Campaigns Section */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold">Campaigns</h2>
        <Link href={`/my-entities/${entity.id}/campaigns/new`}>
          <Button>Create Campaign</Button>
        </Link>
      </div>

      {entity.campaigns.length === 0 ? (
        <Card className="mb-8">
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium">No campaigns yet</h3>
            <p className="text-muted-foreground mt-1">
              Create a campaign to start raising backing
            </p>
            <Link href={`/my-entities/${entity.id}/campaigns/new`}>
              <Button className="mt-4">Create Your First Campaign</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 mb-8">
          {entity.campaigns.map((campaign) => {
            const campaignTarget = Number(campaign.targetAmount);
            const campaignCurrent = Number(campaign.currentAmount);
            const campaignPercentage =
              campaignTarget > 0 ? (campaignCurrent / campaignTarget) * 100 : 0;

            return (
              <Card key={campaign.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{campaign.title}</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        Created{" "}
                        {new Date(campaign.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge
                      variant={
                        campaign.status === CampaignStatus.OPEN
                          ? "success"
                          : campaign.status === CampaignStatus.DRAFT
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {campaign.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Progress value={campaignCurrent} max={campaignTarget} />
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatCC(campaignCurrent.toString())} /{" "}
                      {formatCC(campaignTarget.toString())} CC (
                      {campaignPercentage.toFixed(0)}%)
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex gap-6 text-sm text-muted-foreground">
                      <span>{campaign._count.interests} interests</span>
                      <span>{campaign._count.backings} backers</span>
                    </div>
                    <Link
                      href={`/my-entities/${entity.id}/campaigns/${campaign.id}`}
                    >
                      <Button variant="outline" size="sm">
                        Manage
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Collaboration Suggestions - temporarily disabled */}
      {/* <CollaborationSuggestions entityId={entity.id} /> */}
    </div>
  );
}
