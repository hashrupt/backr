import { PrismaClient } from "@/generated/prisma/client";
import { mockDeep, mockReset, DeepMockProxy } from "vitest-mock-extended";
import { beforeEach } from "vitest";

export type MockPrismaClient = DeepMockProxy<PrismaClient>;

export const prisma = mockDeep<PrismaClient>();

beforeEach(() => {
  mockReset(prisma);
});
