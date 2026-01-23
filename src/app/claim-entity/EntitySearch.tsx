"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ClaimStatus, EntityType } from "@/types/client";

interface Entity {
  id: string;
  name: string;
  type: EntityType;
  partyId: string;
  logoUrl?: string | null;
  claimStatus: ClaimStatus;
  owner?: {
    id: string;
    name: string | null;
  } | null;
}

interface EntitySearchProps {
  userId: string;
}

export function EntitySearch({ userId }: EntitySearchProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [entities, setEntities] = useState<Entity[]>([]);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSearch = async () => {
    if (!search.trim()) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/entities/search?q=${encodeURIComponent(search)}`
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Search failed");
        return;
      }

      setEntities(data.entities);
    } catch {
      setError("An error occurred during search");
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (entityId: string) => {
    setClaiming(entityId);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/entities/${entityId}/claim`, {
        method: "POST",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to claim entity");
        return;
      }

      setSuccess("Entity claimed successfully!");
      router.refresh();

      // Redirect to my entities after a short delay
      setTimeout(() => {
        router.push("/my-entities");
      }, 1500);
    } catch {
      setError("An error occurred while claiming");
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Input
          type="text"
          placeholder="Search by name or PartyId..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          className="flex-1"
        />
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert variant="success">
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      {entities.length > 0 && (
        <div className="space-y-4">
          <h3 className="font-semibold">Search Results</h3>
          {entities.map((entity) => (
            <Card key={entity.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {entity.logoUrl ? (
                      <img
                        src={entity.logoUrl}
                        alt={entity.name}
                        className="h-12 w-12 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                        <span className="text-lg font-semibold text-muted-foreground">
                          {entity.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-semibold">{entity.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {entity.type === EntityType.FEATURED_APP
                          ? "Featured App"
                          : "Validator"}{" "}
                        · {entity.partyId.slice(0, 12)}...
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {entity.claimStatus === ClaimStatus.CLAIMED ? (
                      <div className="text-right">
                        <Badge variant="secondary">Claimed</Badge>
                        {entity.owner && (
                          <p className="text-xs text-muted-foreground mt-1">
                            by {entity.owner.id === userId ? "you" : entity.owner.name}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleClaim(entity.id)}
                        disabled={claiming === entity.id}
                      >
                        {claiming === entity.id ? "Claiming..." : "Claim This"}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {entities.length === 0 && search && !loading && (
        <p className="text-center text-muted-foreground py-8">
          No entities found matching &quot;{search}&quot;
        </p>
      )}
    </div>
  );
}
