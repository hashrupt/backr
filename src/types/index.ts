// Re-export Prisma types for convenience
export type {
  User,
  Entity,
  Campaign,
  Interest,
  CampaignInvite,
  Backing,
} from "@/generated/prisma/client";

export {
  EntityType,
  ClaimStatus,
  ImportSource,
  FoundationStatus,
  ActiveStatus,
  CampaignStatus,
  InterestStatus,
  InviteStatus,
  BackingStatus,
} from "@/generated/prisma/client";

// Extended session type for NextAuth
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
    };
  }
}

// API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Pagination types
export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
