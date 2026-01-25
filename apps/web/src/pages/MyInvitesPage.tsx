import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api, { ApiError } from "@/lib/api";
import { formatCC, InviteStatus, type InviteStatus as InviteStatusType } from "@backr/shared";

interface Invite {
  id: string;
  suggestedAmount?: string | null;
  message?: string | null;
  status: InviteStatusType;
  createdAt: string;
  campaign: {
    id: string;
    title: string;
    entity: {
      id: string;
      name: string;
      type: string;
      logoUrl?: string | null;
    };
  };
}

const statusConfig: Record<
  InviteStatusType,
  { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }
> = {
  [InviteStatus.PENDING]: { label: "Pending", variant: "warning" },
  [InviteStatus.ACCEPTED]: { label: "Accepted", variant: "success" },
  [InviteStatus.DECLINED]: { label: "Declined", variant: "destructive" },
  [InviteStatus.EXPIRED]: { label: "Expired", variant: "secondary" },
  [InviteStatus.CONVERTED]: { label: "Completed", variant: "success" },
};

export default function MyInvitesPage() {
  const { user } = useAuth();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [respondingId, setRespondingId] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    try {
      const data = await api.get<{ invites: Invite[] }>("/invites");
      setInvites(data.invites || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load invites");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const handleRespond = async (inviteId: string, response: "ACCEPTED" | "DECLINED") => {
    setRespondingId(inviteId);
    setError("");

    try {
      await api.patch(`/invites/${inviteId}/respond`, { response });
      await fetchInvites();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to respond to invite");
    } finally {
      setRespondingId(null);
    }
  };

  const pendingInvites = invites.filter((i) => i.status === InviteStatus.PENDING);
  const pastInvites = invites.filter((i) => i.status !== InviteStatus.PENDING);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Invites</h1>
        <p className="text-muted-foreground mt-1">
          Invitations to back campaigns from entity owners
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : invites.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium">No invites yet</h3>
          <p className="text-muted-foreground mt-1 mb-4">
            You haven&apos;t received any backing invites. Browse open campaigns to
            express interest directly.
          </p>
          <Link to="/campaigns">
            <Button>Browse Campaigns</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-8">
          {/* Pending Invites */}
          {pendingInvites.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Pending Invites ({pendingInvites.length})
              </h2>
              <div className="space-y-4">
                {pendingInvites.map((invite) => (
                  <Card key={invite.id}>
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        {invite.campaign.entity.logoUrl ? (
                          <img
                            src={invite.campaign.entity.logoUrl}
                            alt={invite.campaign.entity.name}
                            className="h-12 w-12 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <span className="text-lg font-semibold text-muted-foreground">
                              {invite.campaign.entity.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <Link
                            to={`/campaigns/${invite.campaign.id}`}
                            className="font-semibold hover:underline"
                          >
                            {invite.campaign.title}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {invite.campaign.entity.name}
                          </p>
                          {invite.suggestedAmount && (
                            <p className="text-sm mt-2">
                              Suggested amount:{" "}
                              <span className="font-semibold">
                                {formatCC(invite.suggestedAmount)} CC
                              </span>
                            </p>
                          )}
                          {invite.message && (
                            <p className="text-sm mt-2 text-muted-foreground italic">
                              &ldquo;{invite.message}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 mt-4 justify-end">
                        <Button
                          size="sm"
                          onClick={() => handleRespond(invite.id, "ACCEPTED")}
                          disabled={respondingId === invite.id}
                        >
                          {respondingId === invite.id ? "..." : "Accept"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRespond(invite.id, "DECLINED")}
                          disabled={respondingId === invite.id}
                        >
                          Decline
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Past Invites */}
          {pastInvites.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold mb-4">
                Past Invites ({pastInvites.length})
              </h2>
              <div className="space-y-3">
                {pastInvites.map((invite) => {
                  const config = statusConfig[invite.status];
                  return (
                    <Card key={invite.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <Link
                              to={`/campaigns/${invite.campaign.id}`}
                              className="font-medium hover:underline"
                            >
                              {invite.campaign.title}
                            </Link>
                            <p className="text-sm text-muted-foreground">
                              {invite.campaign.entity.name}
                              {invite.suggestedAmount && (
                                <> &middot; {formatCC(invite.suggestedAmount)} CC</>
                              )}
                            </p>
                          </div>
                          <Badge variant={config.variant}>{config.label}</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
