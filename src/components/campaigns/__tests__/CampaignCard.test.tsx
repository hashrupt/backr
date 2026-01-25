// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { CampaignCard } from "../CampaignCard";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

const baseCampaign = {
  id: "c-1",
  title: "Test Campaign",
  description: "A test campaign description",
  targetAmount: "10000",
  currentAmount: "5000",
  minContribution: null,
  maxContribution: null,
  endsAt: null,
  status: "OPEN" as const,
  entity: {
    id: "e-1",
    name: "Test Entity",
    type: "FEATURED_APP" as const,
    logoUrl: null,
  },
  _count: { backings: 5 },
};

describe("CampaignCard", () => {
  it("renders entity name and campaign title", () => {
    render(<CampaignCard campaign={baseCampaign} />);

    expect(screen.getByText("Test Entity")).toBeInTheDocument();
    expect(screen.getByText("Test Campaign")).toBeInTheDocument();
  });

  it("renders campaign description", () => {
    render(<CampaignCard campaign={baseCampaign} />);

    expect(screen.getByText("A test campaign description")).toBeInTheDocument();
  });

  it("shows OPEN status badge", () => {
    render(<CampaignCard campaign={baseCampaign} />);

    expect(screen.getByText("OPEN")).toBeInTheDocument();
  });

  it("calculates and displays percentage", () => {
    render(<CampaignCard campaign={baseCampaign} />);

    // 5000/10000 = 50%
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("displays backer count", () => {
    render(<CampaignCard campaign={baseCampaign} />);

    expect(screen.getByText("5 backers")).toBeInTheDocument();
  });

  it("shows entity type label", () => {
    render(<CampaignCard campaign={baseCampaign} />);

    expect(screen.getByText("Featured App")).toBeInTheDocument();
  });

  it("shows Validator type label", () => {
    const validatorCampaign = {
      ...baseCampaign,
      entity: { ...baseCampaign.entity, type: "VALIDATOR" as const },
    };
    render(<CampaignCard campaign={validatorCampaign} />);

    expect(screen.getByText("Validator")).toBeInTheDocument();
  });

  it("shows days left when endsAt is set", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);

    const campaign = {
      ...baseCampaign,
      endsAt: futureDate.toISOString(),
    };
    render(<CampaignCard campaign={campaign} />);

    expect(screen.getByText("10 days left")).toBeInTheDocument();
  });

  it("shows Ended when endsAt is in the past", () => {
    const pastDate = new Date("2020-01-01");
    const campaign = {
      ...baseCampaign,
      endsAt: pastDate.toISOString(),
    };
    render(<CampaignCard campaign={campaign} />);

    expect(screen.getByText("Ended")).toBeInTheDocument();
  });

  it("renders logo fallback with first letter when no logo", () => {
    render(<CampaignCard campaign={baseCampaign} />);

    expect(screen.getByText("T")).toBeInTheDocument(); // "T" from "Test Entity"
  });

  it("renders View Campaign link", () => {
    render(<CampaignCard campaign={baseCampaign} />);

    const link = screen.getByText("View Campaign").closest("a");
    expect(link).toHaveAttribute("href", "/campaigns/c-1");
  });

  it("handles zero target amount", () => {
    const zeroCampaign = {
      ...baseCampaign,
      targetAmount: "0",
      currentAmount: "0",
    };
    render(<CampaignCard campaign={zeroCampaign} />);

    expect(screen.getByText("0%")).toBeInTheDocument();
  });
});
