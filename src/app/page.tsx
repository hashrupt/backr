import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FeaturedCampaigns } from "@/components/landing/FeaturedCampaigns";

export default function HomePage() {
  return (
    <div>
      <Hero />
      <HowItWorks />
      <FeaturedCampaigns />
    </div>
  );
}
