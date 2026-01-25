// Collaboration Service - Find potential collaboration partners
// Rule-based matching algorithm with optional AI enhancement

import { prisma } from "../lib/db.js";
import type { EntityType } from "@backr/shared";

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
  "defi", "lending", "borrowing", "liquidity", "yield", "staking", "trading", "exchange", "swap", "amm",
  // Infrastructure
  "oracle", "bridge", "cross-chain", "infrastructure", "protocol", "network",
  // Finance
  "payment", "settlement", "clearing", "custody", "asset", "tokenization",
  // Enterprise
  "enterprise", "institutional", "compliance", "regulatory", "kyc", "aml",
  // Data
  "data", "analytics", "reporting", "audit", "verification",
];

/**
 * Find collaboration suggestions for an entity using rule-based matching
 */
export async function findCollaborations(
  entityId: string,
  limit: number = 5
): Promise<CollaborationResult> {
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

  const otherEntities = await prisma.entity.findMany({
    where: {
      id: { not: entityId },
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

  const suggestions = scoredEntities
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return { suggestions, strategy: "rules" };
}

interface EntityWithBackings {
  id: string;
  type: string;
  name: string;
  description: string | null;
  backings: { userId: string }[];
}

function calculateMatchScore(
  source: EntityWithBackings,
  candidate: EntityWithBackings
): { score: number; reasons: string[]; matchType: CollaborationSuggestion["matchType"] } {
  let score = 0;
  const reasons: string[] = [];
  let primaryMatchType: CollaborationSuggestion["matchType"] = "description";

  if (source.type === candidate.type) {
    score += 20;
    reasons.push(
      `Both are ${source.type === "FEATURED_APP" ? "Featured Apps" : "Validators"}`
    );
    primaryMatchType = "type";
  }

  if (source.type !== candidate.type) {
    score += 15;
    reasons.push(
      source.type === "FEATURED_APP"
        ? "Could use their validation services"
        : "Could integrate with their application"
    );
    primaryMatchType = "complementary";
  }

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

function calculateKeywordOverlap(
  desc1: string | null,
  desc2: string | null
): number {
  if (!desc1 || !desc2) return 0;

  const words1 = extractKeywords(desc1);
  const words2 = extractKeywords(desc2);

  if (words1.length === 0 || words2.length === 0) return 0;

  const matches = words1.filter((word) => words2.includes(word));
  return Math.min(matches.length * 5, 30);
}

function extractKeywords(text: string): string[] {
  const normalized = text.toLowerCase();
  const words = normalized.split(/\W+/).filter((w) => w.length > 2);

  const foundKeywords = COLLABORATION_KEYWORDS.filter(
    (keyword) => normalized.includes(keyword)
  );

  const commonWords = new Set([
    "about", "their", "there", "these", "those", "which", "would", "could",
    "should", "other", "being", "where", "after", "before", "between", "through",
  ]);

  const significantWords = words.filter(
    (w) => w.length > 5 && !commonWords.has(w)
  );

  return [...new Set([...foundKeywords, ...significantWords])];
}

/**
 * Get collaboration suggestions for display
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
