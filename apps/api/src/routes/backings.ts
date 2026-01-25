import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";
import { cantonService } from "../services/canton/index.js";

const createBackingSchema = z.object({
  interestId: z.string(),
  campaignId: z.string(),
  entityId: z.string(),
  amount: z.number().positive(),
});

const backingRoutes: FastifyPluginAsync = async (app) => {
  // POST /backings — Create a backing
  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const validated = createBackingSchema.parse(request.body);

      // Verify the interest exists and is accepted
      const interest = await prisma.interest.findFirst({
        where: {
          id: validated.interestId,
          userId: request.user!.sub,
          campaignId: validated.campaignId,
          status: "ACCEPTED",
        },
      });

      if (!interest) {
        return reply.status(404).send({ error: "Interest not found or not accepted" });
      }

      // Get user's partyId for Canton operations
      const user = await prisma.user.findUnique({
        where: { id: request.user!.sub },
        select: { partyId: true, mockBalance: true },
      });

      // Check mock balance (Web2 MVP)
      if (user && Number(user.mockBalance) < validated.amount) {
        return reply.status(400).send({ error: "Insufficient CC balance" });
      }

      // Mock Canton lock operation
      const lockResult = await cantonService.lockCC(
        user?.partyId || "mock-party-id",
        validated.entityId,
        BigInt(validated.amount)
      );

      if (!lockResult.success) {
        return reply.status(500).send({ error: "Failed to lock CC" });
      }

      // Create backing and update interest in a transaction
      const backing = await prisma.$transaction(async (tx) => {
        const newBacking = await tx.backing.create({
          data: {
            userId: request.user!.sub,
            entityId: validated.entityId,
            campaignId: validated.campaignId,
            amount: validated.amount,
            status: "LOCKED",
            lockedAt: new Date(),
            txHash: lockResult.txHash,
            lockedPartyId: lockResult.lockedPartyId,
          },
        });

        await tx.interest.update({
          where: { id: validated.interestId },
          data: { status: "CONVERTED" },
        });

        await tx.campaign.update({
          where: { id: validated.campaignId },
          data: { currentAmount: { increment: validated.amount } },
        });

        await tx.entity.update({
          where: { id: validated.entityId },
          data: { currentAmount: { increment: validated.amount } },
        });

        await tx.user.update({
          where: { id: request.user!.sub },
          data: { mockBalance: { decrement: validated.amount } },
        });

        return newBacking;
      });

      return reply.status(201).send({ backing });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.issues[0].message });
      }
      throw error;
    }
  });
};

export default backingRoutes;
