"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InterestFormProps {
  campaignId: string;
  minContribution?: number;
  maxContribution?: number;
  entityOwnerId?: string;
}

export function InterestForm({
  campaignId,
  minContribution,
  maxContribution,
  entityOwnerId,
}: InterestFormProps) {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [pledgeAmount, setPledgeAmount] = useState(
    minContribution?.toString() || ""
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  // Check if user is the entity owner
  const isOwner = session?.user?.id === entityOwnerId;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/interests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          pledgeAmount: Number(pledgeAmount),
          message: message || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to register interest");
        return;
      }

      setSuccess(true);
      router.refresh();
    } catch {
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <Card className="mb-6">
        <CardContent className="py-8">
          <div className="h-8 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!session) {
    return (
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Register Your Interest</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">
            Sign in to register your interest in this campaign
          </p>
          <Link href={`/login?callbackUrl=/campaigns/${campaignId}`}>
            <Button>Sign In to Continue</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  if (isOwner) {
    return (
      <Card className="mb-6">
        <CardContent className="py-6">
          <p className="text-muted-foreground text-center">
            You own this entity and cannot register interest in your own
            campaign.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className="mb-6">
        <CardContent className="py-6">
          <Alert variant="success">
            <AlertDescription>
              Your interest has been registered! The entity owner will review
              your submission. You can track your interests in{" "}
              <Link href="/my-interests" className="font-medium underline">
                My Interests
              </Link>
              .
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Register Your Interest</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="pledgeAmount">Pledge Amount (CC)</Label>
            <Input
              id="pledgeAmount"
              type="number"
              placeholder={`Enter amount${minContribution ? ` (min ${minContribution})` : ""}`}
              value={pledgeAmount}
              onChange={(e) => setPledgeAmount(e.target.value)}
              min={minContribution}
              max={maxContribution}
              required
              disabled={loading}
            />
            {(minContribution || maxContribution) && (
              <p className="text-xs text-muted-foreground">
                {minContribution && `Minimum: ${minContribution} CC`}
                {minContribution && maxContribution && " · "}
                {maxContribution && `Maximum: ${maxContribution} CC`}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="message">
              Why do you want to back this entity?{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="message"
              placeholder="Share why you're interested in backing this campaign..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              disabled={loading}
              maxLength={1000}
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Submitting..." : "Submit Interest"}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By submitting, you&apos;re expressing interest to back this
            campaign. The entity owner will review and may accept or decline
            your interest.
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
