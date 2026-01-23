"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Define entity type locally to avoid importing from Prisma in client component
type EntityType = "FEATURED_APP" | "VALIDATOR";

interface CollaborationEntity {
  id: string;
  name: string;
  type: EntityType;
  description: string | null;
  logoUrl: string | null;
  website: string | null;
  partyId: string;
}

interface CollaborationSuggestion {
  entity: CollaborationEntity;
  score: number;
  reasons: string[];
  matchType: "type" | "description" | "backers" | "complementary";
}

interface CollaborationResult {
  suggestions: CollaborationSuggestion[];
  strategy: "rules" | "ai";
}

interface CollaborationSuggestionsProps {
  entityId: string;
}

export function CollaborationSuggestions({
  entityId,
}: CollaborationSuggestionsProps) {
  const [data, setData] = useState<CollaborationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const response = await fetch(
          `/api/entities/${entityId}/collaborations?limit=5`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch suggestions");
        }
        const result = await response.json();
        setData(result);
      } catch {
        setError("Failed to load suggestions");
      } finally {
        setLoading(false);
      }
    }

    fetchSuggestions();
  }, [entityId]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Potential Collaboration Partners</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse flex items-center gap-4 p-3 rounded-lg border"
              >
                <div className="h-12 w-12 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return null;
  }

  if (data.suggestions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Potential Collaboration Partners</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            No collaboration suggestions found yet. As more entities join the
            platform, potential partners will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Potential Collaboration Partners</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {data.strategy === "ai" ? "AI-powered" : "Smart matching"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.suggestions.map((suggestion) => (
            <Link
              key={suggestion.entity.id}
              href={`/entities/${suggestion.entity.id}`}
              className="block"
            >
              <div className="flex items-start gap-4 p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                {/* Logo */}
                {suggestion.entity.logoUrl ? (
                  <img
                    src={suggestion.entity.logoUrl}
                    alt={suggestion.entity.name}
                    className="h-12 w-12 rounded-lg object-cover"
                  />
                ) : (
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <span className="text-lg font-bold text-primary">
                      {suggestion.entity.name.charAt(0)}
                    </span>
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium truncate">
                      {suggestion.entity.name}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {suggestion.entity.type === "FEATURED_APP"
                        ? "App"
                        : "Validator"}
                    </Badge>
                  </div>

                  {/* Match reasons */}
                  <div className="flex flex-wrap gap-1">
                    {suggestion.reasons.slice(0, 2).map((reason, idx) => (
                      <span
                        key={idx}
                        className="text-xs text-muted-foreground"
                      >
                        {idx > 0 && " · "}
                        {reason}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Score badge */}
                <div className="shrink-0">
                  <Badge
                    variant={
                      suggestion.score >= 50
                        ? "success"
                        : suggestion.score >= 30
                          ? "warning"
                          : "secondary"
                    }
                    className="text-xs"
                  >
                    {suggestion.score}% match
                  </Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
