import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/db";
import {
  findCollaborations,
  getCollaborationSuggestions,
} from "../collaboration.service";

describe("collaboration.service", () => {
  const sourceEntity = {
    id: "entity-1",
    type: "FEATURED_APP",
    name: "DeFi App",
    description: "A decentralized lending and borrowing protocol for institutional users",
    backings: [{ userId: "user-1" }, { userId: "user-2" }],
  };

  describe("findCollaborations", () => {
    it("returns empty when source entity not found", async () => {
      (prisma.entity.findUnique as any).mockResolvedValue(null);

      const result = await findCollaborations("nonexistent");

      expect(result.suggestions).toHaveLength(0);
      expect(result.strategy).toBe("rules");
    });

    it("scores same-type entities with type bonus", async () => {
      (prisma.entity.findUnique as any).mockResolvedValue(sourceEntity);
      (prisma.entity.findMany as any).mockResolvedValue([
        {
          id: "entity-2",
          type: "FEATURED_APP",
          name: "Another App",
          description: "A trading platform",
          logoUrl: null,
          website: null,
          partyId: "party-2",
          backings: [],
        },
      ]);

      const result = await findCollaborations("entity-1");

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].score).toBeGreaterThanOrEqual(20); // same type bonus
    });

    it("scores complementary types (APP + VALIDATOR)", async () => {
      (prisma.entity.findUnique as any).mockResolvedValue(sourceEntity);
      (prisma.entity.findMany as any).mockResolvedValue([
        {
          id: "entity-3",
          type: "VALIDATOR",
          name: "Test Validator",
          description: "Infrastructure validator",
          logoUrl: null,
          website: null,
          partyId: "party-3",
          backings: [],
        },
      ]);

      const result = await findCollaborations("entity-1");

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].score).toBeGreaterThanOrEqual(15); // complementary bonus
    });

    it("scores shared backers", async () => {
      (prisma.entity.findUnique as any).mockResolvedValue(sourceEntity);
      (prisma.entity.findMany as any).mockResolvedValue([
        {
          id: "entity-4",
          type: "FEATURED_APP",
          name: "Shared Backer App",
          description: null,
          logoUrl: null,
          website: null,
          partyId: "party-4",
          backings: [{ userId: "user-1" }, { userId: "user-3" }], // user-1 is shared
        },
      ]);

      const result = await findCollaborations("entity-1");

      expect(result.suggestions).toHaveLength(1);
      // Score includes: same type (20) + 1 shared backer (7) = at least 27
      expect(result.suggestions[0].score).toBeGreaterThanOrEqual(27);
      expect(result.suggestions[0].reasons).toContain("1 shared backer");
    });

    it("scores keyword overlap in descriptions", async () => {
      (prisma.entity.findUnique as any).mockResolvedValue(sourceEntity);
      (prisma.entity.findMany as any).mockResolvedValue([
        {
          id: "entity-5",
          type: "FEATURED_APP",
          name: "Similar App",
          description: "Lending protocol with institutional compliance and borrowing features",
          logoUrl: null,
          website: null,
          partyId: "party-5",
          backings: [],
        },
      ]);

      const result = await findCollaborations("entity-1");

      expect(result.suggestions).toHaveLength(1);
      // Should have keyword overlap score for shared terms like "lending", "borrowing", "institutional"
      expect(result.suggestions[0].score).toBeGreaterThan(20);
    });

    it("respects limit parameter", async () => {
      (prisma.entity.findUnique as any).mockResolvedValue(sourceEntity);
      (prisma.entity.findMany as any).mockResolvedValue(
        Array.from({ length: 10 }, (_, i) => ({
          id: `entity-${i + 10}`,
          type: "FEATURED_APP",
          name: `App ${i}`,
          description: "Some defi lending app",
          logoUrl: null,
          website: null,
          partyId: `party-${i + 10}`,
          backings: [],
        }))
      );

      const result = await findCollaborations("entity-1", 3);

      expect(result.suggestions.length).toBeLessThanOrEqual(3);
    });

    it("sorts by score descending", async () => {
      (prisma.entity.findUnique as any).mockResolvedValue(sourceEntity);
      (prisma.entity.findMany as any).mockResolvedValue([
        {
          id: "low-score",
          type: "VALIDATOR",
          name: "Basic Validator",
          description: null,
          logoUrl: null,
          website: null,
          partyId: "party-low",
          backings: [],
        },
        {
          id: "high-score",
          type: "FEATURED_APP",
          name: "DeFi Partner",
          description: "Lending and borrowing with institutional custody and compliance",
          logoUrl: null,
          website: null,
          partyId: "party-high",
          backings: [{ userId: "user-1" }, { userId: "user-2" }],
        },
      ]);

      const result = await findCollaborations("entity-1");

      expect(result.suggestions.length).toBeGreaterThan(0);
      // First result should have higher score
      if (result.suggestions.length > 1) {
        expect(result.suggestions[0].score).toBeGreaterThanOrEqual(result.suggestions[1].score);
      }
    });
  });

  describe("getCollaborationSuggestions", () => {
    it("wraps findCollaborations with error handling", async () => {
      (prisma.entity.findUnique as any).mockRejectedValue(new Error("DB error"));

      const result = await getCollaborationSuggestions("entity-1");

      expect(result.suggestions).toHaveLength(0);
      expect(result.strategy).toBe("rules");
    });
  });
});
