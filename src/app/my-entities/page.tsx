import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { formatCC } from "@/lib/constants";
import { EntityType } from "@/types";

async function getUserEntities(userId: string) {
  const entities = await prisma.entity.findMany({
    where: { ownerId: userId },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { campaigns: true, backings: true },
      },
    },
  });

  return entities;
}

export default async function MyEntitiesPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/my-entities");
  }

  const entities = await getUserEntities(session.user.id);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">My Entities</h1>
          <p className="text-muted-foreground mt-1">
            Manage your Featured Apps and Validators
          </p>
        </div>
        <Link href="/claim-entity">
          <Button>Claim Entity</Button>
        </Link>
      </div>

      {entities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium">No entities yet</h3>
            <p className="text-muted-foreground mt-1">
              Claim a Featured App or Validator to get started
            </p>
            <Link href="/claim-entity">
              <Button className="mt-4">Claim Your First Entity</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {entities.map((entity) => {
            const target = Number(entity.targetAmount);
            const current = Number(entity.currentAmount);
            const percentage = target > 0 ? (current / target) * 100 : 0;

            return (
              <Card key={entity.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                      {entity.logoUrl ? (
                        <img
                          src={entity.logoUrl}
                          alt={entity.name}
                          className="h-14 w-14 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center">
                          <span className="text-xl font-bold text-muted-foreground">
                            {entity.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <CardTitle className="text-xl">{entity.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {entity.type === EntityType.FEATURED_APP
                            ? "Featured App"
                            : "Validator"}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Badge
                        variant={
                          entity.activeStatus === "ACTIVE"
                            ? "success"
                            : "secondary"
                        }
                      >
                        {entity.activeStatus}
                      </Badge>
                      <Badge variant="outline">{entity.foundationStatus}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-muted-foreground">
                        Backing Progress
                      </span>
                      <span>{percentage.toFixed(0)}%</span>
                    </div>
                    <Progress value={current} max={target} />
                    <p className="text-sm text-muted-foreground mt-1">
                      {formatCC(current.toString())} /{" "}
                      {formatCC(target.toString())} CC
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex gap-6 text-sm text-muted-foreground">
                      <span>{entity._count.campaigns} campaigns</span>
                      <span>{entity._count.backings} backings</span>
                    </div>
                    <Link href={`/my-entities/${entity.id}`}>
                      <Button variant="outline" size="sm">
                        Manage
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
