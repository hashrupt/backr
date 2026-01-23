import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCC } from "@/lib/constants";
import { CampaignStatus, InterestStatus } from "@/types";
import { InterestReview } from "./InterestReview";
import { PublishButton } from "./PublishButton";

interface CampaignManagePageProps {
  params: Promise<{ id: string; campaignId: string }>;
}

async function getCampaign(campaignId: string, userId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      entity: { ownerId: userId },
    },
    include: {
      entity: {
        select: { id: true, name: true },
      },
      interests: {
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              bio: true,
              partyId: true,
              mockBalance: true,
            },
          },
        },
      },
      backings: {
        orderBy: { amount: "desc" },
        include: {
          user: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  return campaign;
}

export default async function CampaignManagePage({
  params,
}: CampaignManagePageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/my-entities");
  }

  const { id: entityId, campaignId } = await params;
  const campaign = await getCampaign(campaignId, session.user.id);

  if (!campaign) {
    notFound();
  }

  const target = Number(campaign.targetAmount);
  const current = Number(campaign.currentAmount);
  const percentage = target > 0 ? (current / target) * 100 : 0;

  const pendingInterests = campaign.interests.filter(
    (i) => i.status === InterestStatus.PENDING
  );
  const acceptedInterests = campaign.interests.filter(
    (i) => i.status === InterestStatus.ACCEPTED
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href={`/my-entities/${entityId}`}
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
        Back to {campaign.entity.name}
      </Link>

      {/* Campaign Header */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{campaign.title}</CardTitle>
              <p className="text-muted-foreground mt-1">
                Created {new Date(campaign.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
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
              {campaign.status === CampaignStatus.DRAFT && (
                <PublishButton campaignId={campaign.id} />
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {campaign.description && (
            <p className="text-muted-foreground">{campaign.description}</p>
          )}

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">{percentage.toFixed(0)}%</span>
            </div>
            <Progress value={current} max={target} />
            <p className="text-sm text-muted-foreground mt-2">
              {formatCC(current.toString())} / {formatCC(target.toString())} CC
            </p>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <p className="text-2xl font-bold">{campaign.backings.length}</p>
              <p className="text-sm text-muted-foreground">Backers</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{pendingInterests.length}</p>
              <p className="text-sm text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">{acceptedInterests.length}</p>
              <p className="text-sm text-muted-foreground">Accepted</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Interest Review Section */}
      <InterestReview
        interests={campaign.interests.map((i) => ({
          ...i,
          pledgeAmount: i.pledgeAmount.toString(),
          user: {
            ...i.user,
            mockBalance: i.user.mockBalance.toString(),
          },
        }))}
        campaignStatus={campaign.status}
      />

      {/* Confirmed Backers */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Confirmed Backers ({campaign.backings.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {campaign.backings.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No confirmed backers yet
            </p>
          ) : (
            <div className="space-y-3">
              {campaign.backings.map((backing) => (
                <div
                  key={backing.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <span className="text-sm font-medium">
                        {backing.user.name?.charAt(0) || "?"}
                      </span>
                    </div>
                    <span className="font-medium">
                      {backing.user.name || "Anonymous"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">
                      {formatCC(backing.amount.toString())} CC
                    </span>
                    <Badge variant="success">{backing.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
