import Link from "next/link";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section className="py-20 md:py-32 bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
          Back the Future of{" "}
          <span className="text-primary">Canton Network</span>
        </h1>
        <p className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto">
          Support Featured Apps with pooled Canton Coin (CC). Help promising
          projects get the funding and staking they need to succeed, while
          earning rewards.
        </p>
        <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
          <Link href="/campaigns">
            <Button size="lg" className="w-full sm:w-auto">
              Browse Campaigns
            </Button>
          </Link>
          <Link href="/entities">
            <Button variant="outline" size="lg" className="w-full sm:w-auto">
              Browse Apps
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
