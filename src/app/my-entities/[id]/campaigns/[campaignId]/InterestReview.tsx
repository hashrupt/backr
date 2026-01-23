"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCC } from "@/lib/constants";
import { InterestStatus, CampaignStatus } from "@/types/client";

interface Interest {
  id: string;
  pledgeAmount: string;
  message?: string | null;
  status: string;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
    bio?: string | null;
    partyId?: string | null;
    mockBalance: string;
  };
}

interface InterestReviewProps {
  interests: Interest[];
  campaignStatus: string;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }
> = {
  PENDING: { label: "Pending", variant: "warning" },
  ACCEPTED: { label: "Accepted", variant: "success" },
  DECLINED: { label: "Declined", variant: "destructive" },
  WITHDRAWN: { label: "Withdrawn", variant: "secondary" },
  CONVERTED: { label: "Completed", variant: "success" },
};

export function InterestReview({
  interests,
  campaignStatus,
}: InterestReviewProps) {
  const router = useRouter();
  const [processing, setProcessing] = useState<string | null>(null);

  const handleReview = async (
    interestId: string,
    status: "ACCEPTED" | "DECLINED"
  ) => {
    setProcessing(interestId);

    try {
      const response = await fetch(`/api/interests/${interestId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        router.refresh();
      }
    } catch (error) {
      console.error("Failed to review interest:", error);
    } finally {
      setProcessing(null);
    }
  };

  const pendingInterests = interests.filter(
    (i) => i.status === InterestStatus.PENDING
  );
  const otherInterests = interests.filter(
    (i) => i.status !== InterestStatus.PENDING
  );

  const canReview = campaignStatus === CampaignStatus.OPEN;

  return (
    <div className="space-y-6">
      {/* Pending Interests */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Interests ({pendingInterests.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {pendingInterests.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No pending interests to review
            </p>
          ) : (
            <div className="space-y-4">
              {pendingInterests.map((interest) => (
                <div
                  key={interest.id}
                  className="p-4 border rounded-lg space-y-3"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">
                        {interest.user.name || interest.user.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        PartyId:{" "}
                        {interest.user.partyId?.slice(0, 16) || "Not set"}...
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">
                        {formatCC(interest.pledgeAmount)} CC
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Balance: {formatCC(interest.user.mockBalance)} CC
                      </p>
                    </div>
                  </div>

                  {interest.message && (
                    <p className="text-sm bg-muted/50 p-3 rounded">
                      &quot;{interest.message}&quot;
                    </p>
                  )}

                  {interest.user.bio && (
                    <p className="text-sm text-muted-foreground">
                      Bio: {interest.user.bio}
                    </p>
                  )}

                  {canReview && (
                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        onClick={() => handleReview(interest.id, "ACCEPTED")}
                        disabled={processing === interest.id}
                      >
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleReview(interest.id, "DECLINED")}
                        disabled={processing === interest.id}
                      >
                        Decline
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Reviewed Interests */}
      {otherInterests.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reviewed Interests ({otherInterests.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {otherInterests.map((interest) => {
                const config = statusConfig[interest.status] || {
                  label: interest.status,
                  variant: "secondary" as const,
                };

                return (
                  <div
                    key={interest.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">
                        {interest.user.name || interest.user.email}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {formatCC(interest.pledgeAmount)} CC
                      </p>
                    </div>
                    <Badge variant={config.variant}>{config.label}</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
