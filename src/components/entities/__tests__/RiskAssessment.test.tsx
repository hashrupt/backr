// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { RiskAssessment } from "../RiskAssessment";

describe("RiskAssessment", () => {
  it("renders the Risk Assessment heading", () => {
    render(<RiskAssessment data={{}} />);
    expect(screen.getByText("Risk Assessment")).toBeInTheDocument();
  });

  it("shows high score for strong application data", () => {
    render(
      <RiskAssessment
        data={{
          codeRepository: "https://github.com/example",
          bonafideControls: "Comprehensive fraud controls with KYC and AML",
          noFAStatusImpact: "Minimal impact, can continue operating",
          firstCustomers: "Live customers confirmed and active",
          documentationUrls: ["https://docs.example.com"],
        }}
      />
    );

    // All low risks: base 50 + 12*5 = 110 → clamped to 100
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("Strong")).toBeInTheDocument();
  });

  it("shows low score for weak application data", () => {
    render(
      <RiskAssessment
        data={{
          // no code repo → high risk
          bonafideControls: "no", // high risk
          noFAStatusImpact: "critical dependency, cannot operate", // high risk
          firstCustomers: "none yet", // high risk
        }}
      />
    );

    // base 50 - 12*4 = 2
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Poor")).toBeInTheDocument();
  });

  it("shows unknown status for missing data fields", () => {
    render(<RiskAssessment data={{}} />);

    // No code repo → high, no controls → unknown, no FA → unknown, no customers → unknown
    // base 50 - 12 - 5 - 5 - 5 = 23
    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("Weak")).toBeInTheDocument();
  });

  it("shows Fair score for mixed data", () => {
    render(
      <RiskAssessment
        data={{
          codeRepository: "https://github.com/example",
          bonafideControls: "Basic controls in place for fraud prevention",
          noFAStatusImpact: "Some impact expected but manageable",
          firstCustomers: "In discussion with potential partners",
        }}
      />
    );

    // code: low(+12), controls: low(+12), FA: medium(0), customers: medium(0)
    // base 50 + 12 + 12 = 74
    expect(screen.getByText("74")).toBeInTheDocument();
    expect(screen.getByText("Good")).toBeInTheDocument();
  });

  it("renders all risk factor names", () => {
    render(
      <RiskAssessment
        data={{
          codeRepository: "https://github.com/test",
          bonafideControls: "yes controls are in place",
          noFAStatusImpact: "minimal",
          firstCustomers: "active users",
        }}
      />
    );

    expect(screen.getByText("Code Transparency")).toBeInTheDocument();
    expect(screen.getByText("Fraud Prevention")).toBeInTheDocument();
    expect(screen.getByText("FA Dependency")).toBeInTheDocument();
    expect(screen.getByText("Customer Traction")).toBeInTheDocument();
  });

  it("includes documentation risk when docs are provided", () => {
    render(
      <RiskAssessment
        data={{
          documentationUrls: ["https://docs.example.com", "https://api.example.com"],
        }}
      />
    );

    expect(screen.getByText("Documentation")).toBeInTheDocument();
    expect(screen.getByText("2 doc(s) available")).toBeInTheDocument();
  });

  it("shows disclaimer text", () => {
    render(<RiskAssessment data={{}} />);
    expect(
      screen.getByText(/Score calculated from self-reported/)
    ).toBeInTheDocument();
  });
});
