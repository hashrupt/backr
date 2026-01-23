import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { EntitySearch } from "./EntitySearch";

export default async function ClaimEntityPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/claim-entity");
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Claim Your Entity</h1>
        <p className="text-muted-foreground mt-1">
          Search for your Featured App or Validator in our registry
        </p>
      </div>

      <EntitySearch userId={session.user.id} />

      <div className="mt-8 p-6 bg-muted/30 rounded-lg">
        <h3 className="font-semibold mb-2">Can&apos;t find your entity?</h3>
        <p className="text-sm text-muted-foreground mb-4">
          If your Featured App or Validator isn&apos;t listed, it may not have
          been imported yet. Contact support to have your entity added to the
          registry.
        </p>
      </div>
    </div>
  );
}
