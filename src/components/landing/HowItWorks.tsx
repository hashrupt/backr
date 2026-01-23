const steps = [
  {
    number: 1,
    title: "Claim Entity",
    description:
      "If you operate a Featured App or Validator on Canton, claim your entity to start raising backing.",
  },
  {
    number: 2,
    title: "Create Campaign",
    description:
      "Set your target amount, contribution limits, and terms. Publish to start accepting interest.",
  },
  {
    number: 3,
    title: "Select Backers",
    description:
      "Review interests from the community. Accept backers who align with your vision.",
  },
  {
    number: 4,
    title: "Get Backed",
    description:
      "Accepted backers lock their CC to help you meet CIP requirements. Everyone benefits.",
  },
];

export function HowItWorks() {
  return (
    <section className="py-16 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold">How It Works</h2>
          <p className="mt-2 text-muted-foreground">
            Four simple steps to crowdsourced staking
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-4">
          {steps.map((step, index) => (
            <div key={step.number} className="relative">
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 left-full w-full h-0.5 bg-border -translate-x-1/2" />
              )}
              <div className="text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground text-2xl font-bold mb-4">
                  {step.number}
                </div>
                <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
