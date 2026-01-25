import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/db.js";
import { authenticate } from "../lib/auth.js";

const sendInviteSchema = z.object({
  campaignId: z.string(),
  recipientEmail: z.string().email().optional(),
  recipientPartyId: z.string().optional(),
  message: z.string().max(500).optional(),
  suggestedAmount: z.number().positive().optional(),
});

const respondSchema = z.object({
  status: z.enum(["ACCEPTED", "DECLINED"]),
});

const inviteRoutes: FastifyPluginAsync = async (app) => {
  // GET /invites — Get user's received invites
  app.get("/", { preHandler: [authenticate] }, async (request) => {
    const invites = await prisma.campaignInvite.findMany({
      where: { recipientId: request.user!.sub },
      orderBy: { createdAt: "desc" },
      include: {
        campaign: {
          include: {
            entity: {
              select: { id: true, name: true, type: true, logoUrl: true },
            },
          },
        },
        sender: { select: { id: true, name: true } },
      },
    });

    return { invites };
  });

  // POST /invites — Send an invite
  app.post("/", { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const validated = sendInviteSchema.parse(request.body);

      const campaign = await prisma.campaign.findUnique({
        where: { id: validated.campaignId },
        include: { entity: { select: { ownerId: true } } },
      });

      if (!campaign) {
        return reply.status(404).send({ error: "Campaign not found" });
      }

      if (campaign.entity.ownerId !== request.user!.sub) {
        return reply.status(403).send({ error: "You do not own this campaign's entity" });
      }

      let recipientId: string | undefined;

      if (validated.recipientEmail) {
        const recipient = await prisma.user.findUnique({
          where: { email: validated.recipientEmail },
          select: { id: true },
        });
        recipientId = recipient?.id;
      } else if (validated.recipientPartyId) {
        const recipient = await prisma.user.findUnique({
          where: { partyId: validated.recipientPartyId },
          select: { id: true },
        });
        recipientId = recipient?.id;
      }

      const invite = await prisma.campaignInvite.create({
        data: {
          campaignId: validated.campaignId,
          senderId: request.user!.sub,
          recipientId,
          recipientEmail: validated.recipientEmail,
          recipientPartyId: validated.recipientPartyId,
          message: validated.message,
          suggestedAmount: validated.suggestedAmount,
          status: "PENDING",
        },
        include: {
          recipient: { select: { id: true, name: true, email: true } },
        },
      });

      return reply.status(201).send({ invite });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.issues[0].message });
      }
      throw error;
    }
  });

  // PATCH /invites/:id/respond — Respond to an invite
  app.patch("/:id/respond", { preHandler: [authenticate] }, async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const validated = respondSchema.parse(request.body);

      const invite = await prisma.campaignInvite.findUnique({
        where: { id },
        select: { id: true, recipientId: true, recipientEmail: true, status: true },
      });

      if (!invite) {
        return reply.status(404).send({ error: "Invite not found" });
      }

      if (invite.recipientId !== request.user!.sub) {
        return reply.status(403).send({ error: "This invite is not for you" });
      }

      if (invite.status !== "PENDING") {
        return reply.status(400).send({ error: "This invite has already been responded to" });
      }

      const updatedInvite = await prisma.campaignInvite.update({
        where: { id },
        data: {
          status: validated.status,
          respondedAt: new Date(),
        },
        include: {
          campaign: {
            include: {
              entity: { select: { id: true, name: true } },
            },
          },
        },
      });

      return { invite: updatedInvite };
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.issues[0].message });
      }
      throw error;
    }
  });
};

export default inviteRoutes;
