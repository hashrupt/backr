import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/stores/authStore";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api, { ApiError } from "@/lib/api";
import { formatCC, BackingStatus, type BackingStatus as BackingStatusType } from "@backr/shared";

interface Backing {
  id: string;
  amount: string;
  status: BackingStatusType;
  lockedAt?: string | null;
  unlockAt?: string | null;
  createdAt: string;
  campaign: {
    id: string;
    title: string;
    entity: {
      id: string;
      name: string;
    };
  };
}

const statusConfig: Record<
  BackingStatusType,
  { label: string; variant: "default" | "success" | "warning" | "secondary" }
> = {
  [BackingStatus.PLEDGED]: { label: "Pledged", variant: "warning" },
  [BackingStatus.LOCKED]: { label: "Locked", variant: "success" },
  [BackingStatus.UNLOCKING]: { label: "Unlocking", variant: "warning" },
  [BackingStatus.WITHDRAWN]: { label: "Withdrawn", variant: "secondary" },
};

export default function MyBackingsPage() {
  const { user } = useAuth();
  const [backings, setBackings] = useState<Backing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<{ backings: Backing[] }>("/backings")
      .then((data) => setBackings(data.backings || []))
      .catch((err) =>
        setError(err instanceof ApiError ? err.message : "Failed to load backings"),
      )
      .finally(() => setLoading(false));
  }, []);

  const totalCount = backings.length;
  const activeCount = backings.filter(
    (b) => b.status === BackingStatus.LOCKED || b.status === BackingStatus.PLEDGED,
  ).length;
  const totalBacked = backings.reduce((sum, b) => {
    const raw = BigInt(b.amount.split(".")[0] || "0");
    return sum + raw;
  }, BigInt(0));

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Backings</h1>
        <p className="text-muted-foreground mt-1">
          Track your CC backing commitments
        </p>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3 mb-8">
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-2xl font-bold">{totalCount}</p>
            <p className="text-sm text-muted-foreground">Total Backings</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-2xl font-bold">{activeCount}</p>
            <p className="text-sm text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <p className="text-2xl font-bold">{formatCC(totalBacked)} CC</p>
            <p className="text-sm text-muted-foreground">Total CC Backed</p>
          </CardContent>
        </Card>
      </div>

      {/* Backings List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : backings.length === 0 ? (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium">No backings yet</h3>
          <p className="text-muted-foreground mt-1">
            Your confirmed backings will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {backings.map((backing) => {
            const config = statusConfig[backing.status];
            return (
              <Card key={backing.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/campaigns/${backing.campaign.id}`}
                        className="font-semibold hover:underline"
                      >
                        {backing.campaign.title}
                      </Link>
                      <p className="text-sm text-muted-foreground">
                        {backing.campaign.entity.name}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>Created: {formatDate(backing.createdAt)}</span>
                        {backing.lockedAt && (
                          <span>Locked: {formatDate(backing.lockedAt)}</span>
                        )}
                        {backing.unlockAt && (
                          <span>Unlocks: {formatDate(backing.unlockAt)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right">
                        <p className="font-semibold">{formatCC(backing.amount)} CC</p>
                      </div>
                      <Badge variant={config.variant}>{config.label}</Badge>
                    </div>
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
