// @backr/shared — types, constants, and utilities shared across apps

// Client-safe enums (mirror Prisma enums for use in frontend)
export {
  InterestStatus,
  EntityType,
  CampaignStatus,
  BackingStatus,
  InviteStatus,
  ClaimStatus,
} from "./types/client";

// API response types
export type {
  ApiResponse,
  PaginationParams,
  PaginatedResponse,
} from "./types/index";

// Canton CC constants and utilities
export {
  MIN_CC_REQUIREMENTS,
  MIN_CC_DISPLAY,
  GRACE_PERIOD_DAYS,
  UNLOCK_PERIOD_DAYS,
  CC_DECIMALS,
  formatCC,
  parseCC,
} from "./constants";
