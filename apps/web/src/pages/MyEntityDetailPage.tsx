import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { formatCC } from "@backr/shared";
import { useAuth } from "@/stores/authStore";
import api, { ApiError } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface Campaign {
  id: string;
  title: string;
  status: "DRAFT" | "OPEN" | "SELECTING" | "FUNDED" | "CLOSED" | "CANCELLED";
  targetAmount: string;
  currentAmount: string;
  createdAt: string;
  _count: {
    interests: number;
    backings: number;
  };
}

interface EntityDetail {
  id: string;
  name: string;
  type: "FEATURED_APP" | "VALIDATOR";
  partyId: string;
  description?: string | null;
  logoUrl?: string | null;
  website?: string | null;
  activeStatus: string;
  targetAmount: string;
  currentAmount: string;
  campaigns: Campaign[];
}

const campaignStatusVariant: Record<string, "default" | "success" | "warning" | "secondary" | "destructive" | "info"> = {
  DRAFT: "secondary",
  OPEN: "default",
  SELECTING: "info",
  FUNDED: "success",
  CLOSED: "secondary",
  CANCELLED: "destructive",
};

export default function MyEntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get<EntityDetail>(`/entities/${id}?owned=true`)
      .then((data) => setEntity(data))
      .catch((err) => {
        setError(err instanceof ApiError ? err.message : "Failed to load entity");
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-8 w-32 bg-muted animate-pulse rounded mb-6" />
        <div className="h-64 bg-muted animate-pulse rounded-lg mb-6" />
        <div className="h-48 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/my-entities"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to My Entities
        </Link>
        <div className="text-center py-12">
          <h3 className="text-lg font-medium">Entity not found</h3>
          <p className="text-muted-foreground mt-1">{error || "This entity could not be loaded."}</p>
        </div>
      </div>
    );
  }

  const isActive = entity.activeStatus === "ACTIVE";
  const target = Number(entity.targetAmount) || 1;
  const current = Number(entity.currentAmount) || 0;
  const progressPct = Math.min((current / target) * 100, 100);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        to="/my-entities"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to My Entities
      </Link>

      {/* Entity Header Card */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              {entity.logoUrl ? (
                <img
                  src={entity.logoUrl}
                  alt={entity.name}
                  className="h-16 w-16 rounded-xl object-cover"
                />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl font-bold text-primary">
                    {entity.name.charAt(0)}
                  </span>
                </div>
              )}
              <div>
                <h1 className="text-2xl font-bold">{entity.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {entity.type === "FEATURED_APP" ? "Featured App" : "Validator"}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1">
                  {entity.partyId}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Link to={`/my-entities/${entity.id}/edit`}>
                <Button variant="outline" size="sm">
                  Edit Profile
                </Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Badge variant={isActive ? "success" : "warning"}>
            {isActive ? "Active" : "Inactive"}
          </Badge>

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Backing Progress</span>
              <span className="font-medium">
                {formatCC(entity.currentAmount)} / {formatCC(entity.targetAmount)} CC
              </span>
            </div>
            <Progress value={progressPct} />
          </div>
        </CardContent>
      </Card>

      {/* Campaigns Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Campaigns</h2>
          <Link to={`/my-entities/${entity.id}/campaigns/new`}>
            <Button size="sm">Create Campaign</Button>
          </Link>
        </div>

        {entity.campaigns.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-medium">No campaigns yet</h3>
              <p className="text-muted-foreground mt-1 mb-4">
                Create your first campaign to start gathering backing from the community.
              </p>
              <Link to={`/my-entities/${entity.id}/campaigns/new`}>
                <Button>Create Your First Campaign</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {entity.campaigns.map((campaign) => {
              const cTarget = Number(campaign.targetAmount) || 1;
              const cCurrent = Number(campaign.currentAmount) || 0;
              const cProgress = Math.min((cCurrent / cTarget) * 100, 100);

              return (
                <Card key={campaign.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base">{campaign.title}</CardTitle>
                      <Badge variant={campaignStatusVariant[campaign.status] || "secondary"}>
                        {campaign.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {formatCC(campaign.currentAmount)} / {formatCC(campaign.targetAmount)} CC
                        </span>
                      </div>
                      <Progress value={cProgress} />
                    </div>

                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Interests: </span>
                        <span className="font-medium">{campaign._count.interests}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Backings: </span>
                        <span className="font-medium">{campaign._count.backings}</span>
                      </div>
                    </div>

                    <Link to={`/my-entities/${entity.id}/campaigns/${campaign.id}`}>
                      <Button variant="outline" size="sm" className="w-full">
                        Manage
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
