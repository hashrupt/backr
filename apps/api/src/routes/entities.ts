import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";
import { cantonService } from "../services/canton/index.js";
import { getCollaborationSuggestions } from "../services/collaboration.service.js";

const updateEntitySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(2000).optional().nullable(),
  website: z.string().url().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
});

const entityRoutes: FastifyPluginAsync = async (app) => {
  // GET /entities — List all entities
  app.get("/", async (request) => {
    const { page = "1", limit = "20", type } = request.query as Record<string, string>;
    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    const where: Record<string, unknown> = {};
    if (type) where.type = type;

    const [entities, total] = await Promise.all([
      prisma.entity.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        select: {
          id: true,
          name: true,
          type: true,
          partyId: true,
          description: true,
          logoUrl: true,
          website: true,
          targetAmount: true,
          currentAmount: true,
          claimStatus: true,
          activeStatus: true,
          foundationStatus: true,
          createdAt: true,
          owner: { select: { id: true, name: true } },
          _count: { select: { campaigns: true, backings: true } },
        },
      }),
      prisma.entity.count({ where }),
    ]);

    return {
      entities,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
      },
    };
  });

  // GET /entities/search — Search entities
  app.get("/search", async (request) => {
    const { q = "", type, claimStatus } = request.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { partyId: { contains: q, mode: "insensitive" } },
      ];
    }
    if (type) where.type = type;
    if (claimStatus) where.claimStatus = claimStatus;

    const entities = await prisma.entity.findMany({
      where,
      orderBy: { name: "asc" },
      take: 20,
      select: {
        id: true,
        name: true,
        type: true,
        partyId: true,
        logoUrl: true,
        claimStatus: true,
        owner: { select: { id: true, name: true } },
      },
    });

    return { entities };
  });

  // GET /entities/:id — Get entity by ID
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const entity = await prisma.entity.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        campaigns: {
          where: { status: "OPEN" },
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: { select: { campaigns: true, backings: true } },
      },
    });

    if (!entity) {
      return reply.status(404).send({ error: "Entity not found" });
    }

    return { entity };
  });

  // PATCH /entities/:id — Update entity (owner only)
  app.patch("/:id", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const validated = updateEntitySchema.parse(request.body);

    const entity = await prisma.entity.findUnique({
      where: { id },
      select: { id: true, ownerId: true, claimStatus: true },
    });

    if (!entity) {
      return reply.status(404).send({ error: "Entity not found" });
    }

    if (entity.claimStatus !== "CLAIMED" && entity.claimStatus !== "SELF_REGISTERED") {
      return reply.status(400).send({ error: "Entity must be claimed before editing" });
    }

    if (entity.ownerId !== request.user!.sub) {
      return reply.status(403).send({ error: "You do not own this entity" });
    }

    const updateData: Record<string, unknown> = {};
    if (validated.name !== undefined) updateData.name = validated.name;
    if (validated.description !== undefined) updateData.description = validated.description;
    if (validated.website !== undefined) updateData.website = validated.website;
    if (validated.logoUrl !== undefined) updateData.logoUrl = validated.logoUrl;

    const updatedEntity = await prisma.entity.update({
      where: { id },
      data: updateData,
      include: { owner: { select: { id: true, name: true } } },
    });

    return { entity: updatedEntity };
  });

  // POST /entities/:id/claim — Claim an entity
  app.post("/:id/claim", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const entity = await prisma.entity.findUnique({
      where: { id },
      select: { id: true, partyId: true, claimStatus: true, ownerId: true },
    });

    if (!entity) {
      return reply.status(404).send({ error: "Entity not found" });
    }

    if (entity.claimStatus === "CLAIMED") {
      return reply.status(400).send({ error: "Entity is already claimed" });
    }

    const user = await prisma.user.findUnique({
      where: { id: request.user!.sub },
      select: { partyId: true },
    });

    const isOwner = await cantonService.verifyOwnership(
      user?.partyId || "",
      entity.partyId,
      ""
    );

    if (!isOwner) {
      return reply.status(403).send({
        error: "Ownership verification failed. Your PartyId does not match the entity.",
      });
    }

    const updatedEntity = await prisma.entity.update({
      where: { id },
      data: {
        claimStatus: "CLAIMED",
        ownerId: request.user!.sub,
        claimedAt: new Date(),
      },
      include: { owner: { select: { id: true, name: true } } },
    });

    return { entity: updatedEntity };
  });

  // GET /entities/:id/collaborations — Get collaboration suggestions
  app.get("/:id/collaborations", async (request) => {
    const { id } = request.params as { id: string };
    const { limit = "5" } = request.query as Record<string, string>;
    const validLimit = Math.min(Math.max(1, parseInt(limit, 10)), 10);

    return await getCollaborationSuggestions(id, validLimit);
  });
};

export default entityRoutes;
