import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCC } from "@/lib/constants";
import { InterestStatus } from "@/types";
import { CompleteBackingForm } from "./CompleteBackingForm";

interface CompletePageProps {
  params: Promise<{ id: string }>;
}

async function getInterest(id: string, userId: string) {
  const interest = await prisma.interest.findFirst({
    where: {
      id,
      userId,
      status: InterestStatus.ACCEPTED,
    },
    include: {
      campaign: {
        include: {
          entity: {
            select: {
              id: true,
              name: true,
              type: true,
              logoUrl: true,
            },
          },
        },
      },
    },
  });

  return interest;
}

export default async function CompletePage({ params }: CompletePageProps) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/my-interests");
  }

  const { id } = await params;
  const interest = await getInterest(id, session.user.id);

  if (!interest) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/my-interests"
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
        Back to My Interests
      </Link>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Complete Your Backing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 pb-4 border-b">
            {interest.campaign.entity.logoUrl ? (
              <img
                src={interest.campaign.entity.logoUrl}
                alt={interest.campaign.entity.name}
                className="h-16 w-16 rounded-lg object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                <span className="text-2xl font-bold text-muted-foreground">
                  {interest.campaign.entity.name.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <h3 className="text-xl font-semibold">
                {interest.campaign.entity.name}
              </h3>
              <p className="text-muted-foreground">
                {interest.campaign.title}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Pledge Amount</p>
              <p className="text-2xl font-bold">
                {formatCC(interest.pledgeAmount.toString())} CC
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <p className="text-2xl font-bold text-green-600">Accepted</p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground mb-4">
              By completing this backing, you agree to lock{" "}
              <strong>{formatCC(interest.pledgeAmount.toString())} CC</strong>{" "}
              for this entity. The locked CC will be held in a segregated
              account and can be unlocked after a 365-day notice period.
            </p>

            <CompleteBackingForm
              interestId={interest.id}
              campaignId={interest.campaign.id}
              entityId={interest.campaign.entity.id}
              amount={Number(interest.pledgeAmount)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
