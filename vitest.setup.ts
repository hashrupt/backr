import { vi } from "vitest";

// Mock @/lib/db to use the Prisma mock
vi.mock("@/lib/db", () => {
  return import("./src/__mocks__/db");
});
