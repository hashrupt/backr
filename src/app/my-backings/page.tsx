import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCC } from "@/lib/constants";

async function getBackings(userId: string) {
  const backings = await prisma.backing.findMany({
    where: { userId },
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

  return backings;
}

const statusConfig: Record<
  string,
  { label: string; variant: "default" | "success" | "warning" | "destructive" | "secondary" }
> = {
  PLEDGED: { label: "Pledged", variant: "warning" },
  LOCKED: { label: "Locked", variant: "success" },
  UNLOCKING: { label: "Unlocking", variant: "warning" },
  UNLOCKED: { label: "Unlocked", variant: "secondary" },
  WITHDRAWN: { label: "Withdrawn", variant: "secondary" },
};

export default async function MyBackingsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/my-backings");
  }

  const backings = await getBackings(session.user.id);

  const totalBacked = backings.reduce(
    (sum, b) => sum + Number(b.amount),
    0
  );

  const activeBackings = backings.filter(
    (b) => b.status === "PLEDGED" || b.status === "LOCKED"
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Backings</h1>
        <p className="text-muted-foreground mt-1">
          Your confirmed campaign backings
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{backings.length}</p>
            <p className="text-sm text-muted-foreground">Total Backings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{activeBackings.length}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-2xl font-bold">{formatCC(totalBacked.toString())}</p>
            <p className="text-sm text-muted-foreground">Total CC Backed</p>
          </CardContent>
        </Card>
      </div>

      {backings.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              You haven&apos;t backed any campaigns yet
            </p>
            <Link
              href="/my-interests"
              className="text-primary hover:underline"
            >
              Check your accepted interests
            </Link>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Backings</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {backings
                .filter((b) => b.campaign !== null)
                .map((backing) => {
                const config = statusConfig[backing.status] || {
                  label: backing.status,
                  variant: "secondary" as const,
                };
                const campaign = backing.campaign!;

                return (
                  <div
                    key={backing.id}
                    className="p-4 border rounded-lg"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <Link
                          href={`/campaigns/${campaign.id}`}
                          className="font-semibold hover:underline"
                        >
                          {campaign.title}
                        </Link>
                        <p className="text-sm text-muted-foreground">
                          {campaign.entity.name} &middot;{" "}
                          {campaign.entity.type}
                        </p>
                      </div>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>

                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        Backed on{" "}
                        {new Date(backing.createdAt).toLocaleDateString()}
                      </span>
                      <span className="font-semibold">
                        {formatCC(backing.amount.toString())} CC
                      </span>
                    </div>

                    {backing.status === "LOCKED" && backing.lockedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Locked since{" "}
                        {new Date(backing.lockedAt).toLocaleDateString()}
                      </p>
                    )}

                    {backing.status === "UNLOCKING" && backing.unlockRequestedAt && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Unlock requested{" "}
                        {new Date(backing.unlockRequestedAt).toLocaleDateString()}
                        {backing.unlockEffectiveAt && (
                          <> &middot; Available {new Date(backing.unlockEffectiveAt).toLocaleDateString()}</>
                        )}
                      </p>
                    )}
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
