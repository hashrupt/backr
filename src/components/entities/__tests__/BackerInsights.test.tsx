// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { BackerInsights } from "../BackerInsights";

describe("BackerInsights", () => {
  const strongData = {
    mainnetLaunchDate: "Live on mainnet",
    firstCustomers: "Active confirmed customers",
    codeRepository: "https://github.com/example",
    bonafideControls: "Full KYC and AML controls implemented",
    transactionScaling: "super-linear exponential growth",
    applicationSummary: "A revolutionary DeFi lending platform.",
  };

  it("renders Backer Score label", () => {
    render(<BackerInsights data={{}} />);
    expect(screen.getByText("Backer Score")).toBeInTheDocument();
  });

  it("shows high score for strong data", () => {
    render(<BackerInsights data={strongData} />);

    // 5 green indicators + 1 green scaling = 6 greens
    // base 50 + 10*6 = 110 → clamped to 100
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("shows low score for weak data", () => {
    render(<BackerInsights data={{}} />);

    // TBD: gray(0), No Users: red(-8), Closed: red(-8), No Controls: red(-8)
    // base 50 + 0 - 8 - 8 - 8 = 26
    expect(screen.getByText("26")).toBeInTheDocument();
    expect(screen.getByText("Weak")).toBeInTheDocument();
  });

  it("shows traffic light indicators", () => {
    render(<BackerInsights data={strongData} />);

    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Open Code")).toBeInTheDocument();
    expect(screen.getByText("Controls")).toBeInTheDocument();
    expect(screen.getByText("High Growth")).toBeInTheDocument();
  });

  it("shows red indicators for missing data", () => {
    render(<BackerInsights data={{}} />);

    expect(screen.getByText("TBD")).toBeInTheDocument();
    expect(screen.getByText("No Users")).toBeInTheDocument();
    expect(screen.getByText("Closed")).toBeInTheDocument();
    expect(screen.getByText("No Controls")).toBeInTheDocument();
  });

  it("shows yellow indicators for pipeline state", () => {
    render(
      <BackerInsights
        data={{
          mainnetLaunchDate: "Q2 2026",
          firstCustomers: "In discussion pipeline",
          transactionScaling: "linear growth",
        }}
      />
    );

    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.getByText("Steady")).toBeInTheDocument();
  });

  it("renders key insights", () => {
    render(<BackerInsights data={strongData} />);

    expect(screen.getByText("Already live on MainNet")).toBeInTheDocument();
    expect(screen.getByText("Has confirmed or active customers")).toBeInTheDocument();
  });

  it("shows warning insight for no code repository", () => {
    render(
      <BackerInsights
        data={{ mainnetLaunchDate: "live" }}
      />
    );

    expect(screen.getByText("No public code repository")).toBeInTheDocument();
  });

  it("extracts one-line highlight from summary", () => {
    render(<BackerInsights data={strongData} />);

    expect(
      screen.getByText(/A revolutionary DeFi lending platform/)
    ).toBeInTheDocument();
  });

  it("renders comparison bars", () => {
    render(<BackerInsights data={strongData} />);

    expect(screen.getByText("vs Network Average")).toBeInTheDocument();
    expect(screen.getByText("Transparency")).toBeInTheDocument();
    expect(screen.getByText("Traction")).toBeInTheDocument();
    expect(screen.getByText("Launch Ready")).toBeInTheDocument();
  });

  it("displays category when provided", () => {
    render(<BackerInsights data={{}} category="DeFi" />);

    expect(screen.getByText("DeFi")).toBeInTheDocument();
  });

  it("shows disclaimer text", () => {
    render(<BackerInsights data={{}} />);
    expect(
      screen.getByText(/Based on self-reported FA application data/)
    ).toBeInTheDocument();
  });
});
