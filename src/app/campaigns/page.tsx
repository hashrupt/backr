import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { CampaignStatus, EntityType } from "@/types";
import { CampaignFilters } from "./CampaignFilters";

interface CampaignsPageProps {
  searchParams: Promise<{
    search?: string;
    type?: string;
    sort?: string;
  }>;
}

async function getCampaigns(searchParams: {
  search?: string;
  type?: string;
  sort?: string;
}) {
  const where: Record<string, unknown> = {
    status: CampaignStatus.OPEN,
  };

  if (searchParams.type && searchParams.type !== "all") {
    where.entity = { type: searchParams.type as EntityType };
  }

  if (searchParams.search) {
    where.OR = [
      { title: { contains: searchParams.search, mode: "insensitive" } },
      {
        entity: { name: { contains: searchParams.search, mode: "insensitive" } },
      },
    ];
  }

  let orderBy: Record<string, string> = { createdAt: "desc" };
  if (searchParams.sort === "ending") {
    orderBy = { endsAt: "asc" };
  } else if (searchParams.sort === "funded") {
    orderBy = { currentAmount: "desc" };
  }

  const campaigns = await prisma.campaign.findMany({
    where,
    orderBy,
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
}

function CampaignList({
  campaigns,
}: {
  campaigns: Awaited<ReturnType<typeof getCampaigns>>;
}) {
  if (campaigns.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium">No campaigns found</h3>
        <p className="text-muted-foreground mt-1">
          Try adjusting your filters or check back later
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
  );
}

export default async function CampaignsPage({ searchParams }: CampaignsPageProps) {
  const params = await searchParams;
  const campaigns = await getCampaigns(params);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Open Campaigns</h1>
        <p className="text-muted-foreground mt-1">
          Browse campaigns seeking backing from the community
        </p>
      </div>

      <Suspense fallback={<div>Loading filters...</div>}>
        <CampaignFilters />
      </Suspense>

      <div className="mt-6">
        <CampaignList campaigns={campaigns} />
      </div>
    </div>
  );
}
