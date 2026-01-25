import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api, { ApiError } from "@/lib/api";
import { formatCC, type InterestStatus, type EntityType } from "@backr/shared";

interface InterestDetail {
  id: string;
  pledgeAmount: string;
  status: InterestStatus;
  campaign: {
    id: string;
    title: string;
    entity: {
      id: string;
      name: string;
      type: EntityType;
      logoUrl?: string | null;
    };
  };
}

export default function CompleteBackingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [interest, setInterest] = useState<InterestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api
      .get<{ interest: InterestDetail }>(`/interests/${id}`)
      .then((data) => setInterest(data.interest))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load interest"),
      )
      .finally(() => setLoading(false));
  }, [id]);

  const handleLock = async () => {
    if (!interest) return;
    setSubmitting(true);
    setError("");

    try {
      await api.post("/backings", {
        interestId: interest.id,
        campaignId: interest.campaign.id,
        entityId: interest.campaign.entity.id,
        amount: interest.pledgeAmount,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete backing");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-4">
          <div className="h-6 w-32 bg-muted animate-pulse rounded" />
          <div className="h-64 bg-muted animate-pulse rounded-lg" />
        </div>
      </div>
    );
  }

  if (error && !interest) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!interest) return null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to="/my-interests"
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Back to My Interests
        </Link>
      </div>

      <div className="mb-8">
        <h1 className="text-3xl font-bold">Complete Your Backing</h1>
        <p className="text-muted-foreground mt-1">
          Lock your CC to confirm your backing pledge
        </p>
      </div>

      {success && (
        <Alert variant="success" className="mb-6">
          <AlertDescription>
            Your CC has been locked successfully! Your backing is now confirmed.{" "}
            <Link to="/my-backings" className="font-medium underline">
              View your backings
            </Link>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-4">
            {interest.campaign.entity.logoUrl ? (
              <img
                src={interest.campaign.entity.logoUrl}
                alt={interest.campaign.entity.name}
                className="h-16 w-16 rounded-lg object-cover"
              />
            ) : (
              <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                <span className="text-2xl font-semibold text-muted-foreground">
                  {interest.campaign.entity.name.charAt(0)}
                </span>
              </div>
            )}
            <div>
              <CardTitle>{interest.campaign.entity.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {interest.campaign.title}
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Pledge Amount</p>
                <p className="text-2xl font-bold">
                  {formatCC(interest.pledgeAmount)} CC
                </p>
              </div>
              <Badge variant="success">Accepted</Badge>
            </div>

            <div className="p-4 border rounded-lg bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Important:</strong> By locking your CC, you are committing
                your Canton Coin to back this entity. Locked CC will be held for the
                duration of the backing period and cannot be transferred or withdrawn
                until the unlock period.
              </p>
            </div>

            <Button
              className="w-full"
              size="lg"
              onClick={handleLock}
              disabled={submitting || success}
            >
              {submitting
                ? "Locking..."
                : success
                  ? "Locked Successfully"
                  : `Lock ${formatCC(interest.pledgeAmount)} CC`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
