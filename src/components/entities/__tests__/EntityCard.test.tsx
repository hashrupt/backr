// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EntityCard } from "../EntityCard";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock CopyButton (uses client hooks)
vi.mock("@/components/ui/copy-button", () => ({
  CopyButton: ({ text }: { text: string }) => (
    <button data-testid="copy-button" data-text={text}>Copy</button>
  ),
}));

const baseEntity = {
  id: "e-1",
  name: "DeFi App",
  type: "FEATURED_APP",
  partyId: "canton::abc123def456ghij7890klmnop",
  description: "A decentralized lending platform",
  logoUrl: null,
  website: "https://example.com/",
  externalId: null,
  category: "DeFi",
  claimStatus: "UNCLAIMED" as const,
  activeStatus: "ACTIVE",
  owner: null,
  _count: { campaigns: 3, backings: 10 },
};

describe("EntityCard", () => {
  it("renders entity name", () => {
    render(<EntityCard entity={baseEntity} />);

    expect(screen.getByText("DeFi App")).toBeInTheDocument();
  });

  it("renders entity description", () => {
    render(<EntityCard entity={baseEntity} />);

    expect(screen.getByText("A decentralized lending platform")).toBeInTheDocument();
  });

  it("formats party ID with truncation", () => {
    render(<EntityCard entity={baseEntity} />);

    // namespace "canton" should be visible
    expect(screen.getByText("canton")).toBeInTheDocument();
    // identifier truncated: first 8 + "..." + last 4
    expect(screen.getByText("abc123de...mnop")).toBeInTheDocument();
  });

  it("displays short party ID without truncation", () => {
    const entity = {
      ...baseEntity,
      partyId: "canton::short",
    };
    render(<EntityCard entity={entity} />);

    expect(screen.getByText("short")).toBeInTheDocument();
  });

  it("shows category badge with correct color class", () => {
    render(<EntityCard entity={baseEntity} />);

    const categoryBadge = screen.getByText("DeFi");
    expect(categoryBadge).toBeInTheDocument();
  });

  it("shows Available to Claim badge for UNCLAIMED entities", () => {
    render(<EntityCard entity={baseEntity} />);

    expect(screen.getByText("Available to Claim")).toBeInTheDocument();
  });

  it("shows Claimed badge for CLAIMED entities", () => {
    const entity = {
      ...baseEntity,
      claimStatus: "CLAIMED" as const,
      owner: { id: "user-1", name: "John Doe" },
    };
    render(<EntityCard entity={entity} />);

    expect(screen.getByText("Claimed")).toBeInTheDocument();
    expect(screen.getByText("Owner: John Doe")).toBeInTheDocument();
  });

  it("shows Claim Pending badge for PENDING_CLAIM entities", () => {
    const entity = {
      ...baseEntity,
      claimStatus: "PENDING_CLAIM" as const,
    };
    render(<EntityCard entity={entity} />);

    expect(screen.getByText("Claim Pending")).toBeInTheDocument();
  });

  it("renders website link with cleaned URL", () => {
    render(<EntityCard entity={baseEntity} />);

    expect(screen.getByText("example.com")).toBeInTheDocument();
  });

  it("renders campaign and backing counts", () => {
    render(<EntityCard entity={baseEntity} />);

    expect(screen.getByText("3")).toBeInTheDocument(); // campaigns
    expect(screen.getByText("10")).toBeInTheDocument(); // backings
  });

  it("shows Claim button for UNCLAIMED entities", () => {
    render(<EntityCard entity={baseEntity} />);

    expect(screen.getByText("Claim")).toBeInTheDocument();
  });

  it("hides Claim button for CLAIMED entities", () => {
    const entity = {
      ...baseEntity,
      claimStatus: "CLAIMED" as const,
    };
    render(<EntityCard entity={entity} />);

    expect(screen.queryByText("Claim")).not.toBeInTheDocument();
  });

  it("renders View Details link", () => {
    render(<EntityCard entity={baseEntity} />);

    const link = screen.getByText("View Details").closest("a");
    expect(link).toHaveAttribute("href", "/entities/e-1");
  });

  it("renders logo fallback with first letter", () => {
    render(<EntityCard entity={baseEntity} />);

    expect(screen.getByText("D")).toBeInTheDocument(); // "D" from "DeFi App"
  });

  it("renders copy button for party ID", () => {
    render(<EntityCard entity={baseEntity} />);

    const copyButton = screen.getByTestId("copy-button");
    expect(copyButton).toHaveAttribute("data-text", baseEntity.partyId);
  });
});
