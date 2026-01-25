import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { CampaignCard } from "@/components/campaigns/CampaignCard";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

export default function CampaignsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  const search = searchParams.get("search") || "";
  const type = searchParams.get("type") || "all";
  const sort = searchParams.get("sort") || "newest";

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (type !== "all") params.set("type", type);
    if (sort !== "newest") params.set("sort", sort);

    api
      .get<{ campaigns: Campaign[] }>(`/campaigns?${params.toString()}`)
      .then((data) => setCampaigns(data.campaigns || []))
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, [search, type, sort]);

  const updateParams = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all" && value !== "newest") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    setSearchParams(params);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Open Campaigns</h1>
        <p className="text-muted-foreground mt-1">
          Browse campaigns seeking backing from the community
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="search"
            placeholder="Search campaigns..."
            defaultValue={search}
            onChange={(e) => {
              const value = e.target.value;
              const timer = setTimeout(() => updateParams("search", value), 300);
              return () => clearTimeout(timer);
            }}
          />
        </div>
        <Select
          defaultValue={type}
          onChange={(e) => updateParams("type", e.target.value)}
          className="w-full sm:w-48"
        >
          <option value="all">All Types</option>
          <option value="FEATURED_APP">Featured Apps</option>
          <option value="VALIDATOR">Validators</option>
        </Select>
        <Select
          defaultValue={sort}
          onChange={(e) => updateParams("sort", e.target.value)}
          className="w-full sm:w-48"
        >
          <option value="newest">Newest First</option>
          <option value="ending">Ending Soon</option>
          <option value="funded">Most Funded</option>
        </Select>
      </div>

      {/* Campaign List */}
      <div className="mt-6">
        {loading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <div className="text-center py-12">
            <h3 className="text-lg font-medium">No campaigns found</h3>
            <p className="text-muted-foreground mt-1">
              Try adjusting your filters or check back later
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
