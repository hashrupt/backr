import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCC } from "@/lib/constants";
import { InviteResponse } from "./InviteResponse";

async function getInvites(userId: string) {
  const invites = await prisma.campaignInvite.findMany({
    where: { recipientId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      campaign: {
        include: {
          entity: {
            select: { id: true, name: true, type: true },
          },
        },
      },
    },
  });

  return invites;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }
> = {
  PENDING: { label: "Pending", variant: "warning" },
  ACCEPTED: { label: "Accepted", variant: "success" },
  DECLINED: { label: "Declined", variant: "destructive" },
  EXPIRED: { label: "Expired", variant: "secondary" },
};

export default async function MyInvitesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/my-invites");
  }

  const invites = await getInvites(session.user.id);

  const pendingInvites = invites.filter((i) => i.status === "PENDING");
  const otherInvites = invites.filter((i) => i.status !== "PENDING");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Invites</h1>
        <p className="text-muted-foreground mt-1">
          Direct invitations to back campaigns
        </p>
      </div>

      {invites.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              You haven&apos;t received any invitations yet
            </p>
            <Link
              href="/campaigns"
              className="text-primary hover:underline"
            >
              Browse open campaigns
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pendingInvites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Pending Invites ({pendingInvites.length})</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {pendingInvites.map((invite) => (
                  <div
                    key={invite.id}
                    className="p-4 border rounded-lg space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <Link
                          href={`/campaigns/${invite.campaign.id}`}
                          className="font-semibold hover:underline"
                        >
                          {invite.campaign.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {invite.campaign.entity.name} &middot;{" "}
                          {invite.campaign.entity.type}
                        </p>
                      </div>
                      <Badge variant="warning">Pending</Badge>
                    </div>

                    {invite.suggestedAmount && (
                      <p className="text-sm">
                        Suggested amount:{" "}
                        <span className="font-semibold">
                          {formatCC(invite.suggestedAmount.toString())} CC
                        </span>
                      </p>
                    )}

                    {invite.message && (
                      <p className="text-sm bg-muted/50 p-3 rounded">
                        &quot;{invite.message}&quot;
                      </p>
                    )}

                    <InviteResponse inviteId={invite.id} />
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {otherInvites.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Past Invites ({otherInvites.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {otherInvites.map((invite) => {
                    const config = statusConfig[invite.status] || {
                      label: invite.status,
                      variant: "secondary" as const,
                    };

                    return (
                      <div
                        key={invite.id}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                      >
                        <div>
                          <Link
                            href={`/campaigns/${invite.campaign.id}`}
                            className="font-medium hover:underline"
                          >
                            {invite.campaign.title}
                          </Link>
                          <p className="text-sm text-muted-foreground">
                            {invite.campaign.entity.name}
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
      )}
    </div>
  );
}
