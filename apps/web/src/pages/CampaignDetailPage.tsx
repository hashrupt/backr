import { useState, useEffect, FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { formatCC } from "@backr/shared";
import { useAuth } from "@/stores/authStore";
import api, { ApiError } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface CampaignDetail {
  id: string;
  title: string;
  description?: string | null;
  targetAmount: string;
  currentAmount: string;
  minContribution?: string | null;
  maxContribution?: string | null;
  endsAt?: string | null;
  terms?: string | null;
  status: string;
  entity: {
    id: string;
    name: string;
    type: string;
    description?: string | null;
    logoUrl?: string | null;
    partyId: string;
    website?: string | null;
    owner?: { id: string; name: string | null } | null;
  };
  backings: {
    id: string;
    amount: string;
    status: string;
    user: { id: string; name: string | null };
  }[];
  _count: { backings: number };
}

// ---------------------------------------------------------------------------
// Inline: InterestForm
// ---------------------------------------------------------------------------

function InterestForm({
  campaignId,
  entityOwnerId,
}: {
  campaignId: string;
  entityOwnerId: string | undefined;
}) {
  const { authenticated, user, login } = useAuth();
  const [pledgeAmount, setPledgeAmount] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  if (!authenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Register Interest</CardTitle>
          <CardDescription>
            Sign in to register your interest in this campaign
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => login()}>Sign In</Button>
        </CardContent>
      </Card>
    );
  }

  if (user && entityOwnerId && user.id === entityOwnerId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Register Interest</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            You own this entity and cannot register interest in your own
            campaign.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Register Interest</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="success">
            <AlertDescription>
              Your interest has been registered successfully!
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    try {
      await api.post("/interests", {
        campaignId,
        pledgeAmount: Number(pledgeAmount),
        message: message || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "Failed to register interest",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Register Interest</CardTitle>
        <CardDescription>
          Pledge your support for this campaign
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pledgeAmount">Pledge Amount (CC)</Label>
            <Input
              id="pledgeAmount"
              type="number"
              placeholder="Enter amount in CC"
              value={pledgeAmount}
              onChange={(e) => setPledgeAmount(e.target.value)}
              required
              min={1}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="message">Message (optional)</Label>
            <Textarea
              id="message"
              placeholder="Add a message to the entity owner..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Submitting..." : "Register Interest"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Inline: BackersList
// ---------------------------------------------------------------------------

function BackersList({
  backings,
}: {
  backings: CampaignDetail["backings"];
}) {
  if (backings.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Backers</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            No backers yet. Be the first to support this campaign!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Backers ({backings.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {backings.map((backing) => (
            <li
              key={backing.id}
              className="flex items-center justify-between py-3 first:pt-0 last:pb-0"
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-sm font-medium text-muted-foreground">
                    {(backing.user.name ?? "?").charAt(0).toUpperCase()}
                  </span>
                </div>
                <span className="font-medium">
                  {backing.user.name ?? "Anonymous"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">
                  {formatCC(backing.amount)} CC
                </span>
                <Badge
                  variant={
                    backing.status === "CONFIRMED"
                      ? "success"
                      : backing.status === "PENDING"
                        ? "warning"
                        : "secondary"
                  }
                >
                  {backing.status}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

const statusVariant: Record<string, "success" | "warning" | "secondary" | "destructive" | "info" | "default"> = {
  OPEN: "success",
  DRAFT: "secondary",
  SELECTING: "info",
  FUNDED: "default",
  CLOSED: "secondary",
  CANCELLED: "destructive",
};

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    setNotFound(false);

    api
      .get<CampaignDetail>(`/campaigns/${id}`)
      .then((data) => setCampaign(data))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Loading state
  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Skeleton className="h-6 w-32 mb-6" />
        <div className="flex items-center gap-4 mb-8">
          <Skeleton className="h-16 w-16 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  // Not found state
  if (notFound || !campaign) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          to="/campaigns"
          className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block"
        >
          &larr; Back to Campaigns
        </Link>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Campaign not found</h2>
          <p className="text-muted-foreground mt-2">
            The campaign you are looking for does not exist or has been removed.
          </p>
          <Link to="/campaigns">
            <Button variant="outline" className="mt-4">
              Browse Campaigns
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const { entity } = campaign;

  // Calculate progress
  const target = Number(formatCC(campaign.targetAmount).replace(/,/g, ""));
  const current = Number(formatCC(campaign.currentAmount).replace(/,/g, ""));
  const progressPercent = target > 0 ? (current / target) * 100 : 0;

  // Calculate days left
  let daysLeft: number | null = null;
  if (campaign.endsAt) {
    const diff = new Date(campaign.endsAt).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  const entityTypeLabel =
    entity.type === "FEATURED_APP" ? "Featured App" : "Validator";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        to="/campaigns"
        className="text-sm text-muted-foreground hover:text-foreground mb-6 inline-block"
      >
        &larr; Back to Campaigns
      </Link>

      {/* Entity header */}
      <div className="flex items-center gap-4 mb-8">
        {entity.logoUrl ? (
          <img
            src={entity.logoUrl}
            alt={entity.name}
            className="h-16 w-16 rounded-lg object-cover"
          />
        ) : (
          <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
            <span className="text-2xl font-semibold text-muted-foreground">
              {entity.name.charAt(0)}
            </span>
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold">{entity.name}</h1>
            <Badge variant={statusVariant[campaign.status] ?? "secondary"}>
              {campaign.status}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {entityTypeLabel}
            {entity.owner?.name && <> &middot; Owned by {entity.owner.name}</>}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Campaign details card */}
          <Card>
            <CardHeader>
              <CardTitle>{campaign.title}</CardTitle>
              {campaign.description && (
                <CardDescription>{campaign.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-muted-foreground">
                    {formatCC(campaign.currentAmount)} CC raised
                  </span>
                  <span className="font-medium">
                    {formatCC(campaign.targetAmount)} CC goal
                  </span>
                </div>
                <Progress value={progressPercent} />
                <p className="text-xs text-muted-foreground mt-1">
                  {progressPercent.toFixed(1)}% funded &middot;{" "}
                  {campaign._count.backings}{" "}
                  {campaign._count.backings === 1 ? "backer" : "backers"}
                </p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Min CC</p>
                  <p className="text-lg font-semibold">
                    {campaign.minContribution
                      ? formatCC(campaign.minContribution)
                      : "--"}
                  </p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Max CC</p>
                  <p className="text-lg font-semibold">
                    {campaign.maxContribution
                      ? formatCC(campaign.maxContribution)
                      : "--"}
                  </p>
                </div>
                <div className="rounded-lg border p-3 text-center">
                  <p className="text-xs text-muted-foreground">Days Left</p>
                  <p className="text-lg font-semibold">
                    {daysLeft !== null ? daysLeft : "--"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Terms section */}
          {campaign.terms && (
            <Card>
              <CardHeader>
                <CardTitle>Terms &amp; Conditions</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {campaign.terms}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Backers list */}
          <BackersList backings={campaign.backings} />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {campaign.status === "OPEN" && (
            <InterestForm
              campaignId={campaign.id}
              entityOwnerId={entity.owner?.id}
            />
          )}

          {campaign.status !== "OPEN" && (
            <Card>
              <CardHeader>
                <CardTitle>Campaign {campaign.status.toLowerCase()}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  This campaign is no longer accepting new interest
                  registrations.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
