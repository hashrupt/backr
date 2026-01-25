import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/stores/authStore";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import api, { ApiError } from "@/lib/api";

interface Entity {
  id: string;
  name: string;
  type: string;
  partyId: string;
  logoUrl?: string | null;
  claimStatus: string;
  owner?: { id: string; name: string | null } | null;
}

export default function ClaimEntityPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
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
      const data = await api.get<{ entities: Entity[] }>(
        `/entities/search?q=${encodeURIComponent(search)}`,
      );
      setEntities(data.entities);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async (entityId: string) => {
    setClaiming(entityId);
    setError("");
    setSuccess("");

    try {
      await api.post(`/entities/${entityId}/claim`);
      setSuccess("Entity claimed successfully!");
      setTimeout(() => navigate("/my-entities"), 1500);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to claim entity");
    } finally {
      setClaiming(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Claim Your Entity</h1>
        <p className="text-muted-foreground mt-1">
          Search for your Featured App or Validator in our registry
        </p>
      </div>

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
                          {entity.type === "FEATURED_APP"
                            ? "Featured App"
                            : "Validator"}{" "}
                          · {entity.partyId.slice(0, 12)}...
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {entity.claimStatus === "CLAIMED" ? (
                        <div className="text-right">
                          <Badge variant="secondary">Claimed</Badge>
                          {entity.owner && (
                            <p className="text-xs text-muted-foreground mt-1">
                              by {entity.owner.id === user?.id ? "you" : entity.owner.name}
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

      <div className="mt-8 p-6 bg-muted/30 rounded-lg">
        <h3 className="font-semibold mb-2">Can&apos;t find your entity?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          If your Featured App or Validator isn&apos;t listed, it may not have
          been imported yet. Contact support to have your entity added to the
          registry.
        </p>
      </div>
    </div>
  );
}
