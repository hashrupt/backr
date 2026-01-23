import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatCC } from "@/lib/constants";
import { EntityType, CampaignStatus } from "@/types";
import { InterestForm } from "./InterestForm";
import { BackersList } from "./BackersList";

interface CampaignPageProps {
  params: Promise<{ id: string }>;
}

async function getCampaign(id: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      entity: {
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          logoUrl: true,
          partyId: true,
          website: true,
          owner: {
            select: { id: true, name: true },
          },
        },
      },
      backings: {
        where: { status: { in: ["PLEDGED", "LOCKED"] } },
        select: {
          id: true,
          amount: true,
          status: true,
          user: {
            select: { id: true, name: true },
          },
        },
        orderBy: { amount: "desc" },
        take: 20,
      },
      _count: {
        select: { backings: true },
      },
    },
  });

  return campaign;
}

export default async function CampaignPage({ params }: CampaignPageProps) {
  const { id } = await params;
  const campaign = await getCampaign(id);

  if (!campaign) {
    notFound();
  }

  const target = Number(campaign.targetAmount);
  const current = Number(campaign.currentAmount);
  const percentage = target > 0 ? (current / target) * 100 : 0;

  const daysLeft = campaign.endsAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(campaign.endsAt).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        )
      )
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/campaigns"
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
        Back to Campaigns
      </Link>

      {/* Entity Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="flex items-center gap-4">
          {campaign.entity.logoUrl ? (
            <img
              src={campaign.entity.logoUrl}
              alt={campaign.entity.name}
              className="h-16 w-16 rounded-xl object-cover"
            />
          ) : (
            <div className="h-16 w-16 rounded-xl bg-muted flex items-center justify-center">
              <span className="text-2xl font-bold text-muted-foreground">
                {campaign.entity.name.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold">{campaign.entity.name}</h1>
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>
                {campaign.entity.type === EntityType.FEATURED_APP
                  ? "Featured App"
                  : "Validator"}
              </span>
              {campaign.entity.owner && (
                <>
                  <span>·</span>
                  <span>Claimed by {campaign.entity.owner.name}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Badge
          variant={
            campaign.status === CampaignStatus.OPEN ? "success" : "secondary"
          }
          className="text-sm"
        >
          {campaign.status}
        </Badge>
      </div>

      {/* Campaign Details */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>{campaign.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaign.description && (
            <p className="text-muted-foreground">{campaign.description}</p>
          )}

          {/* Progress */}
          <div className="space-y-2">
            <Progress value={current} max={target} />
            <div className="flex justify-between">
              <span className="text-lg font-semibold">
                {formatCC(current)} / {formatCC(target)} CC
              </span>
              <span className="text-lg font-semibold">
                {percentage.toFixed(0)}%
              </span>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold">
                {campaign.minContribution
                  ? formatCC(campaign.minContribution.toString())
                  : "—"}
              </p>
              <p className="text-sm text-muted-foreground">Min CC</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {campaign.maxContribution
                  ? formatCC(campaign.maxContribution.toString())
                  : "—"}
              </p>
              <p className="text-sm text-muted-foreground">Max CC</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">
                {daysLeft !== null ? (daysLeft > 0 ? daysLeft : "Ended") : "—"}
              </p>
              <p className="text-sm text-muted-foreground">
                {daysLeft !== null && daysLeft > 0 ? "Days Left" : "Status"}
              </p>
            </div>
          </div>

          {campaign.terms && (
            <div className="pt-4 border-t">
              <h4 className="font-medium mb-2">Terms & Conditions</h4>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {campaign.terms}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Interest Form */}
      {campaign.status === CampaignStatus.OPEN && (
        <InterestForm
          campaignId={campaign.id}
          minContribution={
            campaign.minContribution
              ? Number(campaign.minContribution)
              : undefined
          }
          maxContribution={
            campaign.maxContribution
              ? Number(campaign.maxContribution)
              : undefined
          }
          entityOwnerId={campaign.entity.owner?.id}
        />
      )}

      {/* Backers List */}
      <BackersList
        backings={campaign.backings.map((b) => ({
          ...b,
          amount: b.amount.toString(),
        }))}
        totalCount={campaign._count.backings}
      />
    </div>
  );
}
