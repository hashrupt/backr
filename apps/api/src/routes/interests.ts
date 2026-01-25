import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";

const registerInterestSchema = z.object({
  campaignId: z.string(),
  pledgeAmount: z.number().positive(),
  message: z.string().max(1000).optional(),
});

const reviewSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
  reviewNote: z.string().max(500).optional(),
});

const interestRoutes: FastifyPluginAsync = async (app) => {
  // GET /interests — Get user's interests
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const interests = await prisma.interest.findMany({
      where: { userId: request.user!.sub },
      orderBy: { createdAt: "desc" },
      include: {
        campaign: {
          include: {
            entity: {
              select: { id: true, name: true, type: true, logoUrl: true },
            },
          },
        },
      },
    });

    return { interests };
  });

  // POST /interests — Register interest in a campaign
  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const validated = registerInterestSchema.parse(request.body);

      const campaign = await prisma.campaign.findUnique({
        where: { id: validated.campaignId },
        select: {
          id: true,
          status: true,
          minContribution: true,
          maxContribution: true,
          entity: { select: { ownerId: true } },
        },
      });

      if (!campaign) {
        return reply.status(404).send({ error: "Campaign not found" });
      }

      if (campaign.status !== "OPEN") {
        return reply.status(400).send({ error: "Campaign is not accepting interests" });
      }

      if (campaign.entity.ownerId === request.user!.sub) {
        return reply.status(400).send({
          error: "You cannot register interest in your own campaign",
        });
      }

      if (campaign.minContribution && validated.pledgeAmount < Number(campaign.minContribution)) {
        return reply.status(400).send({
          error: `Minimum contribution is ${campaign.minContribution} CC`,
        });
      }

      if (campaign.maxContribution && validated.pledgeAmount > Number(campaign.maxContribution)) {
        return reply.status(400).send({
          error: `Maximum contribution is ${campaign.maxContribution} CC`,
        });
      }

      const existingInterest = await prisma.interest.findUnique({
        where: {
          userId_campaignId: {
            userId: request.user!.sub,
            campaignId: validated.campaignId,
          },
        },
      });

      if (existingInterest) {
        return reply.status(400).send({
          error: "You have already registered interest in this campaign",
        });
      }

      const interest = await prisma.interest.create({
        data: {
          userId: request.user!.sub,
          campaignId: validated.campaignId,
          pledgeAmount: validated.pledgeAmount,
          message: validated.message,
          status: "PENDING",
        },
        include: {
          campaign: {
            include: {
              entity: { select: { id: true, name: true } },
            },
          },
        },
      });

      return reply.status(201).send({ interest });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.issues[0].message });
      }
      throw error;
    }
  });

  // PATCH /interests/:id/review — Review an interest
  app.patch("/:id/review", { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const validated = reviewSchema.parse(request.body);

      const interest = await prisma.interest.findUnique({
        where: { id },
        include: {
          campaign: {
            include: {
              entity: { select: { ownerId: true } },
            },
          },
        },
      });

      if (!interest) {
        return reply.status(404).send({ error: "Interest not found" });
      }

      if (interest.campaign.entity.ownerId !== request.user!.sub) {
        return reply.status(403).send({ error: "You do not own this entity" });
      }

      if (interest.status !== "PENDING") {
        return reply.status(400).send({ error: "Only pending interests can be reviewed" });
      }

      const updatedInterest = await prisma.interest.update({
        where: { id },
        data: {
          status: validated.status,
          reviewedAt: new Date(),
          reviewNote: validated.reviewNote,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      });

      return { interest: updatedInterest };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.issues[0].message });
      }
      throw error;
    }
  });
};

export default interestRoutes;
