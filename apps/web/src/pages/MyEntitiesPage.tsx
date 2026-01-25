import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatCC } from "@backr/shared";
import { useAuth } from "@/stores/authStore";
import api from "@/lib/api";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface OwnedEntity {
  id: string;
  name: string;
  type: "FEATURED_APP" | "VALIDATOR";
  partyId: string;
  description?: string | null;
  logoUrl?: string | null;
  activeStatus: string;
  targetAmount: string;
  currentAmount: string;
  _count?: {
    campaigns: number;
    backings: number;
  };
}

export default function MyEntitiesPage() {
  const { user } = useAuth();
  const [entities, setEntities] = useState<OwnedEntity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ entities: OwnedEntity[] }>("/entities?owned=true")
      .then((data) => setEntities(data.entities))
      .catch(() => setEntities([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Entities</h1>
          <p className="text-muted-foreground mt-1">
            Manage your Featured Apps and Validators
          </p>
        </div>
        <Link to="/claim-entity">
          <Button>Claim Entity</Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : entities.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium">No entities yet</h3>
          <p className="text-muted-foreground mt-1 mb-6">
            You haven&apos;t claimed any Featured Apps or Validators yet.
          </p>
          <Link to="/claim-entity">
            <Button>Claim Your First Entity</Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {entities.map((entity) => {
            const target = Number(entity.targetAmount) || 1;
            const current = Number(entity.currentAmount) || 0;
            const progressPct = Math.min((current / target) * 100, 100);
            const isActive = entity.activeStatus === "ACTIVE";
            const isFoundation = entity.type === "VALIDATOR";

            return (
              <Card
                key={entity.id}
                className="hover:shadow-lg transition-shadow border-2 hover:border-primary/20"
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      {entity.logoUrl ? (
                        <img
                          src={entity.logoUrl}
                          alt={entity.name}
                          className="h-14 w-14 rounded-xl object-cover"
                        />
                      ) : (
                        <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                          <span className="text-2xl font-bold text-primary">
                            {entity.name.charAt(0)}
                          </span>
                        </div>
                      )}
                      <div>
                        <h3 className="font-semibold text-lg leading-tight">
                          {entity.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {entity.type === "FEATURED_APP"
                            ? "Featured App"
                            : "Validator"}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={isActive ? "success" : "warning"}>
                      {isActive ? "Active" : "Inactive"}
                    </Badge>
                    {isFoundation && (
                      <Badge variant="info">Foundation</Badge>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Backing</span>
                      <span className="font-medium">
                        {formatCC(entity.currentAmount)} /{" "}
                        {formatCC(entity.targetAmount)} CC
                      </span>
                    </div>
                    <Progress value={progressPct} />
                  </div>

                  {entity._count && (
                    <div className="flex gap-4 text-sm">
                      <div>
                        <span className="text-muted-foreground">Campaigns: </span>
                        <span className="font-medium">
                          {entity._count.campaigns}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Backings: </span>
                        <span className="font-medium">
                          {entity._count.backings}
                        </span>
                      </div>
                    </div>
                  )}

                  <Link to={`/my-entities/${entity.id}`}>
                    <Button variant="outline" className="w-full">
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
  );
}
