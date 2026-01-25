import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";

const createCampaignSchema = z.object({
  entityId: z.string(),
  title: z.string().min(3).max(100),
  description: z.string().max(2000).optional(),
  targetAmount: z.number().positive(),
  minContribution: z.number().positive().optional(),
  maxContribution: z.number().positive().optional(),
  terms: z.string().optional(),
  endsAt: z.string().datetime().optional(),
});

const campaignRoutes: FastifyPluginAsync = async (app) => {
  // GET /campaigns — List campaigns
  app.get("/", async (request) => {
    const { status, entityType, search, sort = "newest" } = request.query as Record<string, string>;

    const where: Record<string, unknown> = {};
    if (status) {
      where.status = status;
    } else {
      where.status = "OPEN";
    }

    if (entityType) {
      where.entity = { type: entityType };
    }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: "insensitive" } },
        { entity: { name: { contains: search, mode: "insensitive" } } },
      ];
    }

    let orderBy: Record<string, string> = {};
    switch (sort) {
      case "ending":
        orderBy = { endsAt: "asc" };
        break;
      case "funded":
        orderBy = { currentAmount: "desc" };
        break;
      case "newest":
      default:
        orderBy = { createdAt: "desc" };
    }

    const campaigns = await prisma.campaign.findMany({
      where,
      orderBy,
      include: {
        entity: {
          select: {
            id: true,
            name: true,
            type: true,
            logoUrl: true,
            partyId: true,
            owner: { select: { id: true, name: true } },
          },
        },
        _count: { select: { backings: true } },
      },
    });

    return { campaigns };
  });

  // POST /campaigns — Create a new campaign
  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const validated = createCampaignSchema.parse(request.body);

      const entity = await prisma.entity.findUnique({
        where: { id: validated.entityId },
        select: { ownerId: true },
      });

      if (!entity) {
        return reply.status(404).send({ error: "Entity not found" });
      }

      if (entity.ownerId !== request.user!.sub) {
        return reply.status(403).send({ error: "You do not own this entity" });
      }

      const campaign = await prisma.campaign.create({
        data: {
          entityId: validated.entityId,
          title: validated.title,
          description: validated.description,
          targetAmount: validated.targetAmount,
          minContribution: validated.minContribution,
          maxContribution: validated.maxContribution,
          terms: validated.terms,
          endsAt: validated.endsAt ? new Date(validated.endsAt) : undefined,
          status: "DRAFT",
        },
        include: {
          entity: { select: { id: true, name: true, type: true } },
        },
      });

      return reply.status(201).send({ campaign });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.issues[0].message });
      }
      throw error;
    }
  });

  // GET /campaigns/:id — Get campaign details
  app.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: {
        entity: {
          select: {
            id: true,
            name: true,
            type: true,
            description: true,
            logoUrl: true,
            partyId: true,
            website: true,
            targetAmount: true,
            currentAmount: true,
            owner: { select: { id: true, name: true } },
          },
        },
        backings: {
          where: { status: { in: ["PLEDGED", "LOCKED"] } },
          select: {
            id: true,
            amount: true,
            status: true,
            user: { select: { id: true, name: true } },
          },
          orderBy: { amount: "desc" },
          take: 20,
        },
        _count: { select: { backings: true, interests: true } },
      },
    });

    if (!campaign) {
      return reply.status(404).send({ error: "Campaign not found" });
    }

    return { campaign };
  });

  // POST /campaigns/:id/publish — Publish a draft campaign
  app.post("/:id/publish", { preHandler: [authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };

    const campaign = await prisma.campaign.findUnique({
      where: { id },
      include: { entity: { select: { ownerId: true } } },
    });

    if (!campaign) {
      return reply.status(404).send({ error: "Campaign not found" });
    }

    if (campaign.entity.ownerId !== request.user!.sub) {
      return reply.status(403).send({ error: "You do not own this entity" });
    }

    if (campaign.status !== "DRAFT") {
      return reply.status(400).send({ error: "Only draft campaigns can be published" });
    }

    const updatedCampaign = await prisma.campaign.update({
      where: { id },
      data: { status: "OPEN", startsAt: new Date() },
    });

    return { campaign: updatedCampaign };
  });
};

export default campaignRoutes;
