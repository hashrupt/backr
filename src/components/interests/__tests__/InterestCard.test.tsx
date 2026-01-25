// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { InterestCard } from "../InterestCard";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

// Mock formatCC
vi.mock("@/lib/constants", () => ({
  formatCC: (val: unknown) => `${val}`,
}));

const baseInterest = {
  id: "i-1",
  pledgeAmount: "1000000",
  status: "PENDING" as const,
  message: null,
  campaign: {
    id: "c-1",
    title: "Test Campaign",
    entity: {
      id: "e-1",
      name: "Test Entity",
      type: "FEATURED_APP" as const,
      logoUrl: null,
    },
  },
};

describe("InterestCard", () => {
  it("renders entity name and campaign title", () => {
    render(<InterestCard interest={baseInterest} />);

    expect(screen.getByText("Test Entity")).toBeInTheDocument();
    expect(screen.getByText("Test Campaign")).toBeInTheDocument();
  });

  it("renders pledge amount", () => {
    render(<InterestCard interest={baseInterest} />);

    expect(screen.getByText(/1000000/)).toBeInTheDocument();
  });

  it("shows Pending Review badge for PENDING status", () => {
    render(<InterestCard interest={baseInterest} />);

    expect(screen.getByText("Pending Review")).toBeInTheDocument();
  });

  it("shows Accepted badge for ACCEPTED status", () => {
    const interest = { ...baseInterest, status: "ACCEPTED" as const };
    render(<InterestCard interest={interest} />);

    expect(screen.getByText("Accepted")).toBeInTheDocument();
  });

  it("shows Declined badge for DECLINED status", () => {
    const interest = { ...baseInterest, status: "DECLINED" as const };
    render(<InterestCard interest={interest} />);

    expect(screen.getByText("Declined")).toBeInTheDocument();
  });

  it("shows Withdrawn badge for WITHDRAWN status", () => {
    const interest = { ...baseInterest, status: "WITHDRAWN" as const };
    render(<InterestCard interest={interest} />);

    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
  });

  it("shows Completed badge for CONVERTED status", () => {
    const interest = { ...baseInterest, status: "CONVERTED" as const };
    render(<InterestCard interest={interest} />);

    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("shows Withdraw button when PENDING and onWithdraw provided", () => {
    const onWithdraw = vi.fn();
    render(<InterestCard interest={baseInterest} onWithdraw={onWithdraw} />);

    const withdrawBtn = screen.getByText("Withdraw");
    expect(withdrawBtn).toBeInTheDocument();

    fireEvent.click(withdrawBtn);
    expect(onWithdraw).toHaveBeenCalledWith("i-1");
  });

  it("hides Withdraw button when PENDING but no onWithdraw", () => {
    render(<InterestCard interest={baseInterest} />);

    expect(screen.queryByText("Withdraw")).not.toBeInTheDocument();
  });

  it("shows Complete Pledge button when ACCEPTED", () => {
    const interest = { ...baseInterest, status: "ACCEPTED" as const };
    render(<InterestCard interest={interest} />);

    const completeBtn = screen.getByText("Complete Pledge");
    expect(completeBtn).toBeInTheDocument();
    expect(completeBtn.closest("a")).toHaveAttribute(
      "href",
      "/my-interests/i-1/complete"
    );
  });

  it("hides action buttons for DECLINED status", () => {
    const interest = { ...baseInterest, status: "DECLINED" as const };
    render(<InterestCard interest={interest} />);

    expect(screen.queryByText("Withdraw")).not.toBeInTheDocument();
    expect(screen.queryByText("Complete Pledge")).not.toBeInTheDocument();
  });

  it("renders logo fallback with first letter", () => {
    render(<InterestCard interest={baseInterest} />);

    expect(screen.getByText("T")).toBeInTheDocument(); // "T" from "Test Entity"
  });

  it("links entity name to campaign page", () => {
    render(<InterestCard interest={baseInterest} />);

    const link = screen.getByText("Test Entity").closest("a");
    expect(link).toHaveAttribute("href", "/campaigns/c-1");
  });
});
