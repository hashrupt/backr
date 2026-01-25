// Client-safe type definitions
// These mirror the Prisma enums but can be safely imported in client components

export const InterestStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  WITHDRAWN: "WITHDRAWN",
  CONVERTED: "CONVERTED",
} as const;

export type InterestStatus = (typeof InterestStatus)[keyof typeof InterestStatus];

export const EntityType = {
  FEATURED_APP: "FEATURED_APP",
  VALIDATOR: "VALIDATOR",
} as const;

export type EntityType = (typeof EntityType)[keyof typeof EntityType];

export const CampaignStatus = {
  DRAFT: "DRAFT",
  OPEN: "OPEN",
  SELECTING: "SELECTING",
  FUNDED: "FUNDED",
  CLOSED: "CLOSED",
  CANCELLED: "CANCELLED",
} as const;

export type CampaignStatus = (typeof CampaignStatus)[keyof typeof CampaignStatus];

export const BackingStatus = {
  PLEDGED: "PLEDGED",
  LOCKED: "LOCKED",
  UNLOCKING: "UNLOCKING",
  WITHDRAWN: "WITHDRAWN",
} as const;

export type BackingStatus = (typeof BackingStatus)[keyof typeof BackingStatus];

export const InviteStatus = {
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  DECLINED: "DECLINED",
  EXPIRED: "EXPIRED",
  CONVERTED: "CONVERTED",
} as const;

export type InviteStatus = (typeof InviteStatus)[keyof typeof InviteStatus];

export const ClaimStatus = {
  UNCLAIMED: "UNCLAIMED",
  PENDING_CLAIM: "PENDING_CLAIM",
  CLAIMED: "CLAIMED",
  SELF_REGISTERED: "SELF_REGISTERED",
} as const;

export type ClaimStatus = (typeof ClaimStatus)[keyof typeof ClaimStatus];
