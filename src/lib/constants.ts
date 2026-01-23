// Canton Network CIP Requirements

// Minimum CC requirements (Phase 1)
export const MIN_CC_REQUIREMENTS = {
  FEATURED_APP: BigInt("10000000000000000000000000"), // 10M CC (with 18 decimals)
  VALIDATOR: BigInt("1000000000000000000000000"), // 1M CC (with 18 decimals)
} as const;

// Human-readable CC amounts (without decimals)
export const MIN_CC_DISPLAY = {
  FEATURED_APP: 10_000_000, // 10M CC
  VALIDATOR: 1_000_000, // 1M CC
} as const;

// Grace periods per entity type (in days)
export const GRACE_PERIOD_DAYS = {
  FEATURED_APP: 7,
  VALIDATOR: 30,
} as const;

// Unlock period (in days)
export const UNLOCK_PERIOD_DAYS = 365;

// CC decimals (like ETH has 18 decimals)
export const CC_DECIMALS = 18;

// Format CC amount for display
export function formatCC(amount: bigint | string | number): string {
  const value =
    typeof amount === "bigint"
      ? amount
      : BigInt(typeof amount === "string" ? amount : Math.floor(amount));
  const divisor = BigInt(10 ** CC_DECIMALS);
  const whole = value / divisor;
  return whole.toLocaleString();
}

// Parse CC amount from display value to raw
export function parseCC(displayAmount: number): bigint {
  return BigInt(displayAmount) * BigInt(10 ** CC_DECIMALS);
}
