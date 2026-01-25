import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "../lib/db.js";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  bio: z.string().max(500).optional(),
  partyId: z.string().optional(),
});

const authRoutes: FastifyPluginAsync = async (app) => {
  // POST /auth/register
  app.post("/register", async (request, reply) => {
    try {
      const validated = registerSchema.parse(request.body);

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: validated.email },
      });

      if (existingUser) {
        return reply.status(400).send({ error: "User with this email already exists" });
      }

      // Check if partyId is already taken
      if (validated.partyId) {
        const existingPartyId = await prisma.user.findUnique({
          where: { partyId: validated.partyId },
        });

        if (existingPartyId) {
          return reply.status(400).send({
            error: "This PartyId is already associated with another account",
          });
        }
      }

      // Hash password
      const passwordHash = await hash(validated.password, 12);

      // Create user
      const user = await prisma.user.create({
        data: {
          name: validated.name,
          email: validated.email,
          passwordHash,
          bio: validated.bio,
          partyId: validated.partyId,
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      });

      return reply.status(201).send({ message: "User created successfully", user });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({ error: error.issues[0].message });
      }

      app.log.error(error, "Registration error");
      return reply.status(500).send({ error: "An error occurred during registration" });
    }
  });
};

export default authRoutes;
