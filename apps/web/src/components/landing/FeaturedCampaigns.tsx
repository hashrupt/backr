import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { Button } from "@/components/ui/button";
import api from "@/lib/api";

interface Campaign {
  id: string;
  title: string;
  description?: string | null;
  targetAmount: string;
  currentAmount: string;
  minContribution?: string | null;
  maxContribution?: string | null;
  endsAt?: string | null;
  status: "DRAFT" | "OPEN" | "SELECTING" | "FUNDED" | "CLOSED" | "CANCELLED";
  entity: {
    id: string;
    name: string;
    type: "FEATURED_APP" | "VALIDATOR";
    logoUrl?: string | null;
    owner?: { id: string; name: string | null } | null;
  };
  _count?: { backings: number };
}

export function FeaturedCampaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ campaigns: Campaign[] }>("/campaigns?sort=funded&limit=3")
      .then((data) => setCampaigns(data.campaigns || []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/4" />
            <div className="grid gap-6 md:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-64 bg-muted rounded-lg" />
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

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
          <Link to="/campaigns">
            <Button variant="outline">View All</Button>
          </Link>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {campaigns.map((campaign) => (
            <CampaignCard key={campaign.id} campaign={campaign} />
          ))}
        </div>
      </div>
    </section>
  );
}
