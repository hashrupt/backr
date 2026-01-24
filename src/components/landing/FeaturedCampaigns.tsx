import Link from "next/link";
import { prisma } from "@/lib/db";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { Button } from "@/components/ui/button";

async function getFeaturedCampaigns() {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: {
        status: "OPEN",
        entity: { type: "FEATURED_APP" },
      },
      orderBy: { currentAmount: "desc" },
      take: 3,
      include: {
        entity: {
          select: {
            id: true,
            name: true,
            type: true,
            logoUrl: true,
            owner: {
              select: { id: true, name: true },
            },
          },
        },
        _count: {
          select: { backings: true },
        },
      },
    });

    return campaigns;
  } catch {
    // Database not available (e.g., during build)
    return [];
  }
}

export async function FeaturedCampaigns() {
  const campaigns = await getFeaturedCampaigns();

  if (campaigns.length === 0) {
    return null;
  }

  return (
    <section className="py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold">Featured Campaigns</h2>
            <p className="mt-1 text-muted-foreground">
              Top campaigns seeking funding
            </p>
          </div>
          <Link href="/campaigns">
            <Button variant="outline">View All</Button>
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard
              key={campaign.id}
              campaign={{
                ...campaign,
                targetAmount: campaign.targetAmount.toString(),
                currentAmount: campaign.currentAmount.toString(),
                minContribution: campaign.minContribution?.toString(),
                maxContribution: campaign.maxContribution?.toString(),
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
