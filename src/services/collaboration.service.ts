// Collaboration Service - Find potential collaboration partners
// Rule-based matching algorithm with optional AI enhancement

import { prisma } from "@/lib/db";
import { EntityType } from "@/types";

export interface CollaborationSuggestion {
  entity: {
    id: string;
    name: string;
    type: EntityType;
    description: string | null;
    logoUrl: string | null;
    website: string | null;
    partyId: string;
  };
  score: number;
  reasons: string[];
  matchType: "type" | "description" | "backers" | "complementary";
}

export interface CollaborationResult {
  suggestions: CollaborationSuggestion[];
  strategy: "rules" | "ai";
}

// Common keywords that indicate collaboration potential
const COLLABORATION_KEYWORDS = [
  // DeFi
  "defi",
  "lending",
  "borrowing",
  "liquidity",
  "yield",
  "staking",
  "trading",
  "exchange",
  "swap",
  "amm",
  // Infrastructure
  "oracle",
  "bridge",
  "cross-chain",
  "infrastructure",
  "protocol",
  "network",
  // Finance
  "payment",
  "settlement",
  "clearing",
  "custody",
  "asset",
  "tokenization",
  // Enterprise
  "enterprise",
  "institutional",
  "compliance",
  "regulatory",
  "kyc",
  "aml",
  // Data
  "data",
  "analytics",
  "reporting",
  "audit",
  "verification",
];

/**
 * Find collaboration suggestions for an entity using rule-based matching
 */
export async function findCollaborations(
  entityId: string,
  limit: number = 5
): Promise<CollaborationResult> {
  // Get the source entity with its backers
  const sourceEntity = await prisma.entity.findUnique({
    where: { id: entityId },
    include: {
      backings: {
        select: { userId: true },
        where: { status: { in: ["PLEDGED", "LOCKED"] } },
      },
    },
  });

  if (!sourceEntity) {
    return { suggestions: [], strategy: "rules" };
  }

  // Get all other entities that could be collaboration partners
  const otherEntities = await prisma.entity.findMany({
    where: {
      id: { not: entityId },
      // Only include entities with some activity
      OR: [
        { description: { not: null } },
        { website: { not: null } },
        { campaigns: { some: {} } },
      ],
    },
    include: {
      backings: {
        select: { userId: true },
        where: { status: { in: ["PLEDGED", "LOCKED"] } },
      },
    },
  });

  // Score each potential partner
  const scoredEntities = otherEntities.map((candidate) => {
    const { score, reasons, matchType } = calculateMatchScore(
      sourceEntity,
      candidate
    );
    return {
      entity: {
        id: candidate.id,
        name: candidate.name,
        type: candidate.type as EntityType,
        description: candidate.description,
        logoUrl: candidate.logoUrl,
        website: candidate.website,
        partyId: candidate.partyId,
      },
      score,
      reasons,
      matchType,
    };
  });

  // Sort by score and take top matches
  const suggestions = scoredEntities
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return {
    suggestions,
    strategy: "rules",
  };
}

interface EntityWithBackings {
  id: string;
  type: string;
  name: string;
  description: string | null;
  backings: { userId: string }[];
}

/**
 * Calculate match score between two entities
 */
function calculateMatchScore(
  source: EntityWithBackings,
  candidate: EntityWithBackings
): { score: number; reasons: string[]; matchType: CollaborationSuggestion["matchType"] } {
  let score = 0;
  const reasons: string[] = [];
  let primaryMatchType: CollaborationSuggestion["matchType"] = "description";

  // 1. Same type bonus (+20 points)
  if (source.type === candidate.type) {
    score += 20;
    reasons.push(
      `Both are ${source.type === "FEATURED_APP" ? "Featured Apps" : "Validators"}`
    );
    primaryMatchType = "type";
  }

  // 2. Complementary types bonus (+15 points)
  // Apps and Validators can collaborate on infrastructure
  if (source.type !== candidate.type) {
    score += 15;
    reasons.push(
      source.type === "FEATURED_APP"
        ? "Could use their validation services"
        : "Could integrate with their application"
    );
    primaryMatchType = "complementary";
  }

  // 3. Description keyword overlap (+0-30 points)
  const keywordScore = calculateKeywordOverlap(
    source.description,
    candidate.description
  );
  if (keywordScore > 0) {
    score += keywordScore;
    reasons.push("Similar business focus based on description");
    if (keywordScore >= 15) {
      primaryMatchType = "description";
    }
  }

  // 4. Shared backers (+7 points per shared backer, max 35)
  const sourceBackerIds = new Set(source.backings.map((b) => b.userId));
  const sharedBackers = candidate.backings.filter((b) =>
    sourceBackerIds.has(b.userId)
  ).length;

  if (sharedBackers > 0) {
    const backerScore = Math.min(sharedBackers * 7, 35);
    score += backerScore;
    reasons.push(
      `${sharedBackers} shared backer${sharedBackers === 1 ? "" : "s"}`
    );
    if (sharedBackers >= 3) {
      primaryMatchType = "backers";
    }
  }

  return { score, reasons, matchType: primaryMatchType };
}

/**
 * Calculate keyword overlap score between two descriptions
 */
function calculateKeywordOverlap(
  desc1: string | null,
  desc2: string | null
): number {
  if (!desc1 || !desc2) return 0;

  const words1 = extractKeywords(desc1);
  const words2 = extractKeywords(desc2);

  if (words1.length === 0 || words2.length === 0) return 0;

  // Count matching keywords
  const matches = words1.filter((word) => words2.includes(word));

  // Score based on number of matches (up to 30 points)
  // 1 match = 5 points, 2 matches = 10 points, etc.
  return Math.min(matches.length * 5, 30);
}

/**
 * Extract relevant keywords from a description
 */
function extractKeywords(text: string): string[] {
  const normalized = text.toLowerCase();
  const words = normalized.split(/\W+/).filter((w) => w.length > 2);

  // Find collaboration keywords in the text
  const foundKeywords = COLLABORATION_KEYWORDS.filter(
    (keyword) => normalized.includes(keyword)
  );

  // Also extract any significant words (longer than 5 chars, not common)
  const commonWords = new Set([
    "about",
    "their",
    "there",
    "these",
    "those",
    "which",
    "would",
    "could",
    "should",
    "other",
    "being",
    "where",
    "after",
    "before",
    "between",
    "through",
  ]);

  const significantWords = words.filter(
    (w) => w.length > 5 && !commonWords.has(w)
  );

  return [...new Set([...foundKeywords, ...significantWords])];
}

/**
 * Get collaboration suggestions for display
 * Wraps findCollaborations with error handling
 */
export async function getCollaborationSuggestions(
  entityId: string,
  limit: number = 5
): Promise<CollaborationResult> {
  try {
    return await findCollaborations(entityId, limit);
  } catch (error) {
    console.error("Error finding collaborations:", error);
    return { suggestions: [], strategy: "rules" };
  }
}
