import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { InterestCard } from "@/components/interests/InterestCard";

async function getUserInterests(userId: string) {
  const interests = await prisma.interest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: {
      campaign: {
        include: {
          entity: {
            select: {
              id: true,
              name: true,
              type: true,
              logoUrl: true,
            },
          },
        },
      },
    },
  });

  return interests;
}

export default async function MyInterestsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/my-interests");
  }

  const interests = await getUserInterests(session.user.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">My Interests</h1>
        <p className="text-muted-foreground mt-1">
          Track your backing interests and complete pledges
        </p>
      </div>

      {interests.length === 0 ? (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <h3 className="text-lg font-medium">No interests yet</h3>
          <p className="text-muted-foreground mt-1">
            Browse campaigns and register your interest to start backing
          </p>
          <a
            href="/campaigns"
            className="inline-block mt-4 text-primary hover:underline"
          >
            Browse Campaigns
          </a>
        </div>
      ) : (
        <div className="space-y-4">
          {interests.map((interest) => (
            <InterestCard
              key={interest.id}
              interest={{
                ...interest,
                pledgeAmount: interest.pledgeAmount.toString(),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
