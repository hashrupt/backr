import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useAuth } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api, { ApiError } from "@/lib/api";
import {
  formatCC,
  CampaignStatus,
  InterestStatus,
  type CampaignStatus as CampaignStatusType,
  type InterestStatus as InterestStatusType,
} from "@backr/shared";

interface Interest {
  id: string;
  pledgeAmount: string;
  status: InterestStatusType;
  message?: string | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface Backer {
  id: string;
  amount: string;
  status: string;
  user: {
    id: string;
    name: string | null;
  };
}

interface Campaign {
  id: string;
  title: string;
  description?: string | null;
  targetAmount: string;
  currentAmount: string;
  status: CampaignStatusType;
  entity: {
    id: string;
    name: string;
    type: string;
    logoUrl?: string | null;
  };
  interests: Interest[];
  backings: Backer[];
  _count?: {
    backings: number;
  };
}

const campaignStatusConfig: Record<
  CampaignStatusType,
  { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" | "info" }
> = {
  [CampaignStatus.DRAFT]: { label: "Draft", variant: "secondary" },
  [CampaignStatus.OPEN]: { label: "Open", variant: "success" },
  [CampaignStatus.SELECTING]: { label: "Selecting", variant: "info" },
  [CampaignStatus.FUNDED]: { label: "Funded", variant: "success" },
  [CampaignStatus.CLOSED]: { label: "Closed", variant: "secondary" },
  [CampaignStatus.CANCELLED]: { label: "Cancelled", variant: "destructive" },
};

export default function ManageCampaignPage() {
  const { campaignId } = useParams<{ campaignId: string }>();
  const { user } = useAuth();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState("");

  const fetchCampaign = useCallback(async () => {
    try {
      const data = await api.get<{ campaign: Campaign }>(
        `/campaigns/${campaignId}?manage=true`,
      );
      setCampaign(data.campaign);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load campaign");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCampaign();
  }, [fetchCampaign]);

  const handlePublish = async () => {
    setPublishError("");
    try {
      await api.post(`/campaigns/${campaignId}/publish`);
      await fetchCampaign();
    } catch (err) {
      setPublishError(err instanceof ApiError ? err.message : "Failed to publish");
    }
  };

  const handleReviewInterest = async (interestId: string, decision: "ACCEPTED" | "DECLINED") => {
    setReviewingId(interestId);
    try {
      await api.patch(`/interests/${interestId}/review`, { decision });
      await fetchCampaign();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to review interest");
    } finally {
      setReviewingId(null);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          <div className="h-8 w-64 bg-muted animate-pulse rounded" />
          <div className="h-4 w-96 bg-muted animate-pulse rounded" />
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (error && !campaign) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!campaign) return null;

  const target = Number(campaign.targetAmount);
  const current = Number(campaign.currentAmount);
  const progressPercent = target > 0 ? (current / target) * 100 : 0;
  const statusConfig = campaignStatusConfig[campaign.status];

  const pendingInterests = campaign.interests.filter(
    (i) => i.status === InterestStatus.PENDING,
  );
  const reviewedInterests = campaign.interests.filter(
    (i) => i.status !== InterestStatus.PENDING,
  );

  const interestStatusBadge = (status: InterestStatusType) => {
    const config: Record<string, { label: string; variant: "success" | "destructive" | "secondary" | "warning" }> = {
      [InterestStatus.ACCEPTED]: { label: "Accepted", variant: "success" },
      [InterestStatus.DECLINED]: { label: "Declined", variant: "destructive" },
      [InterestStatus.WITHDRAWN]: { label: "Withdrawn", variant: "secondary" },
      [InterestStatus.CONVERTED]: { label: "Completed", variant: "success" },
    };
    const c = config[status] || { label: status, variant: "secondary" as const };
    return <Badge variant={c.variant}>{c.label}</Badge>;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to={`/entities/${campaign.entity.id}`}
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to {campaign.entity.name}
        </Link>
      </div>

      {/* Campaign Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <h1 className="text-3xl font-bold">{campaign.title}</h1>
          <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
          {campaign.status === CampaignStatus.DRAFT && (
            <Button size="sm" onClick={handlePublish}>
              Publish Campaign
            </Button>
          )}
        </div>
        {publishError && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{publishError}</AlertDescription>
          </Alert>
        )}
        {campaign.description && (
          <p className="text-muted-foreground">{campaign.description}</p>
        )}
      </div>

      {/* Progress */}
      <Card className="mb-8">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-muted-foreground">Funding Progress</span>
            <span className="text-sm font-medium">
              {formatCC(campaign.currentAmount)} / {formatCC(campaign.targetAmount)} CC
            </span>
          </div>
          <Progress value={progressPercent} />
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-2xl font-bold">{campaign._count?.backings ?? campaign.backings.length}</p>
            <p className="text-sm text-muted-foreground">Confirmed Backers</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-2xl font-bold">{pendingInterests.length}</p>
            <p className="text-sm text-muted-foreground">Pending Interests</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-2xl font-bold">
              {campaign.interests.filter((i) => i.status === InterestStatus.ACCEPTED).length}
            </p>
            <p className="text-sm text-muted-foreground">Accepted Interests</p>
          </CardContent>
        </Card>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Pending Interests */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">
          Pending Interests ({pendingInterests.length})
        </h2>
        {pendingInterests.length === 0 ? (
          <p className="text-muted-foreground">No pending interests to review.</p>
        ) : (
          <div className="space-y-4">
            {pendingInterests.map((interest) => (
              <Card key={interest.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="font-semibold">
                        {interest.user.name || interest.user.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Pledge: {formatCC(interest.pledgeAmount)} CC
                      </p>
                      {interest.message && (
                        <p className="text-sm mt-2 text-muted-foreground italic">
                          &ldquo;{interest.message}&rdquo;
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleReviewInterest(interest.id, "ACCEPTED")}
                        disabled={reviewingId === interest.id}
                      >
                        {reviewingId === interest.id ? "..." : "Accept"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReviewInterest(interest.id, "DECLINED")}
                        disabled={reviewingId === interest.id}
                      >
                        Decline
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Reviewed Interests */}
      {reviewedInterests.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">
            Reviewed Interests ({reviewedInterests.length})
          </h2>
          <div className="space-y-3">
            {reviewedInterests.map((interest) => (
              <Card key={interest.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">
                        {interest.user.name || interest.user.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCC(interest.pledgeAmount)} CC
                      </p>
                    </div>
                    {interestStatusBadge(interest.status)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Confirmed Backers */}
      <div>
        <h2 className="text-xl font-semibold mb-4">
          Confirmed Backers ({campaign.backings.length})
        </h2>
        {campaign.backings.length === 0 ? (
          <p className="text-muted-foreground">No confirmed backers yet.</p>
        ) : (
          <div className="space-y-3">
            {campaign.backings.map((backing) => (
              <Card key={backing.id}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{backing.user.name || "Anonymous"}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatCC(backing.amount)} CC
                      </p>
                    </div>
                    <Badge variant="success">{backing.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
