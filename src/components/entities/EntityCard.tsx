import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

// Use string literal types to avoid importing from Prisma
type ClaimStatus = "UNCLAIMED" | "PENDING_CLAIM" | "CLAIMED" | "SELF_REGISTERED";

// Category color mapping
const categoryColors: Record<string, string> = {
  'DeFi': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100',
  'RWA': 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-100',
  'Data': 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-100',
  'Identity': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100',
  'Gaming': 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-100',
  'Other': 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100',
};

interface EntityCardProps {
  entity: {
    id: string;
    name: string;
    type: string;
    partyId: string;
    description?: string | null;
    logoUrl?: string | null;
    website?: string | null;
    externalId?: string | null;
    category?: string | null;
    claimStatus: ClaimStatus;
    activeStatus: string;
    owner?: {
      id: string;
      name: string | null;
    } | null;
    _count?: {
      campaigns: number;
      backings: number;
    };
  };
}

export function EntityCard({ entity }: EntityCardProps) {
  // Show first and last parts of party ID for readability
  const partyIdParts = entity.partyId.split("::");
  const namespace = partyIdParts[0] || "";
  const identifier = partyIdParts[1] || "";
  const shortId = identifier.length > 12
    ? `${identifier.slice(0, 8)}...${identifier.slice(-4)}`
    : identifier;

  return (
    <Card className="hover:shadow-lg transition-shadow border-2 hover:border-primary/20">
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
              <h3 className="font-semibold text-lg leading-tight">{entity.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-sm text-muted-foreground">Featured App</p>
                {entity.category && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${categoryColors[entity.category] || categoryColors['Other']}`}>
                    {entity.category}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Description */}
        {entity.description && (
          <p className="text-sm text-muted-foreground line-clamp-2">
            {entity.description}
          </p>
        )}

        {/* Website & CF Link */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {entity.website && (
            <a
              href={entity.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              {entity.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          )}
          {entity.externalId && (
            <a
              href={entity.externalId}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              CF Link
            </a>
          )}
        </div>

        {/* Party ID - more readable format */}
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">Party ID</p>
          <p className="text-sm font-mono">
            <span className="text-primary">{namespace}</span>
            <span className="text-muted-foreground">::</span>
            <span>{shortId}</span>
          </p>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-2">
          <Badge
            variant={
              entity.claimStatus === "CLAIMED"
                ? "success"
                : "outline"
            }
          >
            {entity.claimStatus === "CLAIMED"
              ? "Claimed"
              : entity.claimStatus === "PENDING_CLAIM"
              ? "Claim Pending"
              : "Available to Claim"}
          </Badge>
          {entity.owner && (
            <Badge variant="secondary">
              Owner: {entity.owner.name || "Anonymous"}
            </Badge>
          )}
        </div>

        {/* Stats */}
        {entity._count && (
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Campaigns: </span>
              <span className="font-medium">{entity._count.campaigns}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Backings: </span>
              <span className="font-medium">{entity._count.backings}</span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 pt-2">
          <Link href={`/entities/${entity.id}`} className="flex-1">
            <Button variant="outline" className="w-full">
              View Details
            </Button>
          </Link>
          {entity.claimStatus === "UNCLAIMED" && (
            <Link href={`/claim-entity?partyId=${encodeURIComponent(entity.partyId)}`}>
              <Button>
                Claim
              </Button>
            </Link>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
